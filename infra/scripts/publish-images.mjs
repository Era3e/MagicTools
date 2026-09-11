import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { parse } from "yaml";
import { root, catalog, inspectImage } from "./build-images.mjs";
import { captureValidationIdentity } from "./lib/quality-evidence.mjs";
import { runProcess } from "./lib/validation-process.mjs";
import { isRegistryNamespace, validateBuildManifest } from "./lib/runtime-artifacts.mjs";
import { digestBytes, validateReleaseManifest } from "./lib/release-artifacts.mjs";
import { validateRuntimeEvidence } from "./lib/runtime-validation.mjs";

export async function publishImages({ buildManifest, runtimeManifest, registry, validation = false } = {}) {
  const runId = randomBytes(8).toString("hex");
  const directory = join(root, ".qa/releases", runId); mkdirSync(directory, { recursive: true });
  const receipt = { schema: "magictools-publish-evidence/1", success: false, runId, startedAt: new Date().toISOString(), images: [] };
  const docker = async (...args) => {
    const result = await runProcess("docker", args, { cwd: root });
    if (result.exitCode !== 0) throw new Error("镜像发布命令失败：" + args[0]);
  };
  try {
    if (!isRegistryNamespace(registry)) throw new Error("必须指定包含显式主机及命名空间的镜像仓库");
    const built = JSON.parse(readFileSync(buildManifest, "utf8"));
    const services = catalog(); validateBuildManifest(built, services);
    if (built.mode !== "release" && !validation) throw new Error("验证镜像需要显式 --validation，不能作为正式发布");
    const current = captureValidationIdentity(root, process.env, runId);
    if (current.checkoutSha !== built.source.checkoutSha || current.fingerprint !== built.source.fingerprint) throw new Error("当前源码与被发布的构建不一致");
    if (!runtimeManifest) throw new Error("必须提供同一批镜像的运行验收回执");
    const runtime = JSON.parse(readFileSync(runtimeManifest, "utf8"));
    validateRuntimeEvidence(runtime, built, services);
    receipt.runtimeRunId = runtime.runId;
    const release = { schema: "magictools-release/1", success: false, mode: validation ? "validation" : "release", releaseId: built.revision + "-" + runId,
      revision: built.revision, platform: built.platform, source: built.source, runtimeRunId: runtime.runId, createdAt: new Date().toISOString(), images: [], files: [] };
    receipt.source = built.source; receipt.releaseId = release.releaseId;
    for (const item of built.images) {
      const sourceImage = inspectImage(item.localImageId);
      if (sourceImage.labels?.["org.opencontainers.image.revision"] !== release.revision || sourceImage.os + "/" + sourceImage.architecture !== release.platform) throw new Error("待推送镜像与构建不符：" + item.service);
      const repository = registry + "/" + item.service;
      const tag = repository + ":" + release.revision;
      await docker("tag", item.localImageId, tag);
      await docker("push", tag);
      const digests = JSON.parse(execFileSync("docker", ["image", "inspect", tag, "--format", "{{json .RepoDigests}}"], { encoding: "utf8", windowsHide: true }));
      const reference = digests?.find((value) => value.startsWith(repository + "@sha256:"));
      if (!reference) throw new Error("推送后没有实际 registry digest：" + item.service);
      // 明确按仓库 digest 拉回并核对内容，不能把本地 image ID 写成 registry digest。
      await docker("pull", "--platform", release.platform, reference);
      const fetched = inspectImage(reference);
      if (fetched.id !== item.localImageId || fetched.labels?.["org.opencontainers.image.revision"] !== release.revision || fetched.os + "/" + fetched.architecture !== release.platform) throw new Error("仓库回读的镜像身份不符：" + item.service);
      const published = { ...item, repository, reference, registryDigest: reference.slice(repository.length + 1) };
      release.images.push(published); receipt.images.push(published);
    }
    const files = {
      "compose.json": JSON.stringify(parse(readFileSync(join(root, "infra/compose.prod.yml"), "utf8")), null, 2) + "\n",
      "ports.json": JSON.stringify(parse(readFileSync(join(root, "infra/ports.yaml"), "utf8")), null, 2) + "\n",
      "postgres-init.sql": readFileSync(join(root, "infra/postgres-init.sql")),
    };
    for (const [path, bytes] of Object.entries(files)) {
      writeFileSync(join(directory, path), bytes); release.files.push({ path, sha256: digestBytes(bytes) });
    }
    const finalSource = captureValidationIdentity(root, process.env, runId);
    if (finalSource.fingerprint !== built.source.fingerprint || finalSource.checkoutSha !== built.source.checkoutSha) throw new Error("发布期间源码发生变化");
    release.success = true; validateReleaseManifest(release, services, { allowValidation: validation });
    writeFileSync(join(directory, "release.json"), JSON.stringify(release, null, 2) + "\n");
    receipt.success = true;
    return { release, directory };
  } catch (error) { receipt.error = String(error); throw error; }
  finally {
    receipt.finishedAt = new Date().toISOString();
    writeFileSync(join(directory, "publish.json"), JSON.stringify(receipt, null, 2) + "\n");
    console.log("Publish evidence:", join(directory, "publish.json"));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2); const options = {};
    while (args.length) {
      const arg = args.shift();
      if (arg === "--validation") options.validation = true;
      else if (["--build-manifest", "--runtime-manifest", "--registry"].includes(arg) && args[0] && !args[0].startsWith("--")) options[{ "--registry": "registry", "--build-manifest": "buildManifest", "--runtime-manifest": "runtimeManifest" }[arg]] = args.shift();
      else throw new Error("用法：pnpm images:publish --build-manifest <build.json> --runtime-manifest <runtime.json> --registry <host/namespace> [--validation]");
    }
    await publishImages(options);
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
