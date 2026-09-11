import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { parse } from "yaml";
import { captureValidationIdentity } from "./lib/quality-evidence.mjs";
import { runProcess } from "./lib/validation-process.mjs";
import { runtimeCatalog, validateBuildManifest, isImageRepository } from "./lib/runtime-artifacts.mjs";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const catalog = () => runtimeCatalog(parse(readFileSync(join(root, "infra/ports.yaml"), "utf8")));

export function inspectImage(reference) {
  const format = '{"id":{{json .Id}},"labels":{{json (index .Config "Labels")}},"os":{{json .Os}},"architecture":{{json .Architecture}},"health":{{json (index .Config "Healthcheck")}}}';
  return JSON.parse(execFileSync("docker", ["image", "inspect", reference, "--format", format], { encoding: "utf8", windowsHide: true }));
}

export async function buildImages({ validation = false, only, prefix = "magictools-local", platform = "linux/amd64" } = {}) {
  const runId = randomBytes(8).toString("hex");
  const directory = join(root, ".qa/images", runId); mkdirSync(directory, { recursive: true });
  const manifest = { schema: "magictools-image-build/1", success: false, mode: validation ? "validation" : "release", runId, platform,
    startedAt: new Date().toISOString(), source: null, revision: "", images: [] };
  try {
    if (!isImageRepository(prefix) || !["linux/amd64", "linux/arm64"].includes(platform)) throw new Error("镜像前缀或目标平台非法");
    const services = catalog();
    if (only && (!validation || !services.some((item) => item.service === only))) throw new Error("单服务构建仅用于明确的验证目标");
    const selected = services.filter((item) => !only || item.service === only);
    manifest.source = captureValidationIdentity(root, process.env, runId);
    if (!validation && !manifest.source.clean) throw new Error("发布镜像只能从干净提交构建；开发验证请显式使用 --validation");
    manifest.revision = manifest.source.clean ? manifest.source.checkoutSha : "worktree-" + manifest.source.fingerprint;
    for (const item of selected) {
      const reference = prefix + "/" + item.service + ":" + manifest.revision;
      const result = await runProcess("docker", ["build", "--pull=false", "--platform", platform, "--build-arg", "VCS_REF=" + manifest.revision,
        "-f", item.dockerfile, "-t", reference, "."], { cwd: root });
      if (result.exitCode !== 0) throw new Error("镜像构建失败：" + item.service);
      const inspected = inspectImage(reference);
      manifest.images.push({ service: item.service, reference, localImageId: inspected.id,
        revision: inspected.labels?.["org.opencontainers.image.revision"], platform: inspected.os + "/" + inspected.architecture,
        healthcheck: Boolean(inspected.health?.Test?.length && inspected.health.Test[0] !== "NONE") });
    }
    const current = captureValidationIdentity(root, process.env, runId);
    if (current.fingerprint !== manifest.source.fingerprint || current.checkoutSha !== manifest.source.checkoutSha) throw new Error("构建期间源码发生变化，禁止把混合版本发布");
    manifest.success = true;
    validateBuildManifest(manifest, services, { allowPartial: Boolean(only) });
  } catch (error) { manifest.success = false; manifest.error = String(error); throw error; }
  finally {
    manifest.finishedAt = new Date().toISOString();
    writeFileSync(join(directory, "build.json"), JSON.stringify(manifest, null, 2) + "\n");
    console.log("Image build manifest:", join(directory, "build.json"));
  }
  return { manifest, directory };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); const options = {};
  try {
    while (args.length) {
      const arg = args.shift();
      if (arg === "--validation") options.validation = true;
      else if (["--only", "--prefix", "--platform"].includes(arg) && args[0] && !args[0].startsWith("--")) options[arg.slice(2)] = args.shift();
      else throw new Error("未知或缺值的镜像构建参数");
    }
    await buildImages(options);
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
