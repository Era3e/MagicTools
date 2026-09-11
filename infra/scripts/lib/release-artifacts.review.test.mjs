import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire, syncBuiltinESMExports } from "node:module";

const root = process.env.RUNTIME_REVIEW_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const work = join(dirname(root), "runtime-readiness-review", "release-fixtures");
fs.mkdirSync(work, { recursive: true });
const { parse } = createRequire(join(root, "package.json"))("yaml");
const { runtimeCatalog } = await import(pathToFileURL(join(root, "infra/scripts/lib/runtime-artifacts.mjs")));
const { validateReleaseManifest } = await import(pathToFileURL(join(root, "infra/scripts/lib/release-artifacts.mjs")));
const { captureValidationIdentity } = await import(pathToFileURL(join(root, "infra/scripts/lib/quality-evidence.mjs")));
const { publishImages } = await import(pathToFileURL(join(root, "infra/scripts/publish-images.mjs")));
const { validateRuntime } = await import(pathToFileURL(join(root, "infra/scripts/validate-runtime.mjs")));
const catalog = runtimeCatalog(parse(fs.readFileSync(join(root, "infra/ports.yaml"), "utf8")));

function releaseFixture() {
  const sha = "a".repeat(40);
  return { schema: "magictools-release/1", success: true, mode: "release", releaseId: sha + "-1234567890abcdef",
    revision: sha, platform: "linux/amd64", source: { clean: true, checkoutSha: sha, fingerprint: "b".repeat(64) },
    files: ["compose.json", "ports.json", "postgres-init.sql"].map((path) => ({ path, sha256: "c".repeat(64) })),
    images: catalog.map((item, index) => {
      const repository = "registry.example.invalid/team/" + item.service;
      const registryDigest = "sha256:" + (index + 100).toString(16).padStart(64, "0");
      return { service: item.service, repository, registryDigest, reference: repository + "@" + registryDigest,
        localImageId: "sha256:" + index.toString(16).padStart(64, "0"), revision: sha, platform: "linux/amd64", healthcheck: true };
    }) };
}

function buildFixture() {
  const source = captureValidationIdentity(root, {}, "independent-build");
  const revision = source.clean ? source.checkoutSha : "worktree-" + source.fingerprint;
  return { schema: "magictools-image-build/1", success: true, mode: "validation", runId: "independent-build", source,
    revision, platform: "linux/amd64", images: catalog.map((item, index) => ({ service: item.service,
      reference: "review-local/" + item.service + ":" + revision, localImageId: "sha256:" + index.toString(16).padStart(64, "0"),
      revision, platform: "linux/amd64", healthcheck: true })) };
}

function runtimeFixture(build) {
  const checks = ["cold-start-17-services", "isolated-images-and-nonroot-node", "eight-databases-and-migrations",
    "assistant-probes-container-services", "web-deep-links-and-assets", "manager-create-and-update",
    "designer-builds-real-preview", "database-outage-and-recovery", "persistent-volume-after-recreation"];
  const postgresReference = parse(fs.readFileSync(join(root, "infra/compose.prod.yml"), "utf8")).services.postgres.image;
  return { schema: "magictools-runtime-evidence/1", success: true, cleanup: "passed", runId: "runtime-" + "2".repeat(16),
    startedAt: "2026-09-12T00:00:00.000Z", finishedAt: "2026-09-12T00:01:00.000Z",
    source: structuredClone(build.source), revision: build.revision,
    mode: { database: "real", containers: "real", external: "not-invoked", liveModel: "not-run" },
    checks: checks.map((name) => ({ name, status: "passed", elapsedMs: 1 })),
    images: build.images.map((item) => ({ service: item.service, localImageId: item.localImageId })),
    postgres: { reference: postgresReference, localImageId: postgresReference.split("@")[1], platform: build.platform } };
}

// Redirect runtime receipts outside the frozen repository. Docker is always blocked or simulated.
async function isolated(action, runtimeProbe = false, postgresPlatform = "linux/amd64") {
  const directory = fs.mkdtempSync(join(work, "review-"));
  const qa = join(root, ".qa");
  const remap = (path) => typeof path === "string" && resolve(path).startsWith(resolve(qa) + sep)
    ? join(directory, "receipts", relative(qa, resolve(path))) : path;
  const original = { mkdir: fs.mkdirSync, write: fs.writeFileSync, copy: fs.copyFileSync,
    exec: childProcess.execFileSync, spawn: childProcess.spawn };
  const build = buildFixture();
  const input = join(directory, "build.json");
  fs.writeFileSync(input, JSON.stringify(build));
  const calls = [];
  let postgresPulled = false;
  const postgresImage = parse(fs.readFileSync(join(root, "infra/compose.prod.yml"), "utf8")).services.postgres.image;
  fs.mkdirSync = function (path, ...args) { return original.mkdir.call(fs, remap(path), ...args); };
  fs.writeFileSync = function (path, ...args) { return original.write.call(fs, remap(path), ...args); };
  fs.copyFileSync = function (from, to, ...args) { return original.copy.call(fs, from, remap(to), ...args); };
  childProcess.execFileSync = function (command, args, ...options) {
    if (command !== "docker") return original.exec.call(childProcess, command, args, ...options);
    calls.push({ type: "exec", args });
    if (!runtimeProbe) throw new Error("Independent test blocked Docker side effect");
    if (args[0] === "image" && args[1] === "inspect") {
      const reference = args[2];
      if (reference.includes("pgvector")) {
        if (!postgresPulled) throw new Error("No cached postgres image in clean CI runner");
        const [os, architecture] = postgresPlatform.split("/");
        return JSON.stringify({ id: reference.slice(reference.indexOf("@") + 1), labels: {}, os, architecture });
      }
      assert.ok(build.images.some((item) => item.localImageId === reference));
      return JSON.stringify({ id: reference, labels: { "org.opencontainers.image.revision": build.revision },
        os: "linux", architecture: "amd64", health: { Test: ["CMD", "healthcheck"] } });
    }
    if (args[0] === "compose") return "";
    throw new Error("Unexpected Docker read in independent test");
  };
  childProcess.spawn = function (command, args, ...options) {
    if (command !== "docker") return original.spawn.call(childProcess, command, args, ...options);
    calls.push({ type: "spawn", args });
    if (!runtimeProbe) throw new Error("Independent test blocked Docker side effect");
    const child = new EventEmitter(); child.kill = () => true;
    if (args[0] === "pull" && args.includes(postgresImage)) postgresPulled = true;
    const code = args[0] === "compose" && args.includes("up") ? 7 : 0;
    queueMicrotask(() => child.emit("exit", code, null));
    return child;
  };
  syncBuiltinESMExports();
  const receipt = (kind, file) => {
    const parent = join(directory, "receipts", kind);
    const entries = fs.readdirSync(parent);
    assert.equal(entries.length, 1);
    return { data: JSON.parse(fs.readFileSync(join(parent, entries[0], file), "utf8")), directory: join(parent, entries[0]) };
  };
  try { await action({ directory, input, build, calls, receipt, postgresImage }); }
  finally {
    fs.mkdirSync = original.mkdir; fs.writeFileSync = original.write; fs.copyFileSync = original.copy;
    childProcess.execFileSync = original.exec; childProcess.spawn = original.spawn;
    syncBuiltinESMExports();
  }
}

test("独立验收：完整发布正例通过，错误源码、漏服务、移动标签及无效配置清单拒绝", () => {
  assert.equal(catalog.length, 17);
  assert.doesNotThrow(() => validateReleaseManifest(releaseFixture(), catalog));
  for (const change of [
    (release) => { release.source.checkoutSha = "f".repeat(40); },
    (release) => { release.images.pop(); },
    (release) => { release.images[1] = { ...release.images[0] }; },
    (release) => { release.images[0].reference = release.images[0].repository + ":latest"; },
    (release) => { release.images[0].registryDigest = "sha256:" + "f".repeat(64); },
    (release) => { release.images[0].platform = "linux/arm64"; },
    (release) => { release.files[0].path = "../secret.env"; },
    (release) => { release.files.pop(); },
  ]) { const release = releaseFixture(); change(release); assert.throws(() => validateReleaseManifest(release, catalog)); }
});

test("独立验收：发布清单拒绝隐式 Docker Hub 地址", () => {
  const release = releaseFixture();
  for (const item of release.images) {
    item.repository = "implicit-team/namespace/" + item.service;
    item.reference = item.repository + "@" + item.registryDigest;
  }
  assert.throws(() => validateReleaseManifest(release, catalog), /仓库|主机|地址|镜像/);
});

test("独立验收：publisher 在读取构建和执行 Docker 前拒绝无显式主机的仓库参数", async () => {
  await isolated(async ({ directory, calls, receipt }) => {
    await assert.rejects(publishImages({ buildManifest: join(directory, "missing.json"), registry: "team/namespace", validation: true }), /主机|仓库/);
    assert.equal(calls.length, 0);
    assert.equal(receipt("releases", "publish.json").data.success, false);
  });
});

test("独立验收：构建清单读取失败仍保存失败回执，不生成 release.json", async () => {
  await isolated(async ({ directory, calls, receipt }) => {
    await assert.rejects(publishImages({ buildManifest: join(directory, "missing.json"), registry: "registry.example.invalid/team", validation: true }), /ENOENT/);
    const out = receipt("releases", "publish.json");
    assert.equal(out.data.success, false); assert.ok(out.data.error && out.data.finishedAt);
    assert.equal(fs.existsSync(join(out.directory, "release.json")), false);
    assert.equal(calls.length, 0);
  });
});

test("独立验收：验证构建不能默认正式发布，错误源码不能触发推送", async () => {
  await isolated(async ({ input, calls, receipt }) => {
    await assert.rejects(publishImages({ buildManifest: input, registry: "registry.example.invalid/team" }), /验证/);
    assert.equal(calls.length, 0); assert.equal(receipt("releases", "publish.json").data.success, false);
  });
  await isolated(async ({ input, build, calls, receipt }) => {
    build.source.checkoutSha = "f".repeat(40); fs.writeFileSync(input, JSON.stringify(build));
    await assert.rejects(publishImages({ buildManifest: input, registry: "registry.example.invalid/team", validation: true }), /源码|构建|提交/);
    assert.equal(calls.length, 0); assert.equal(receipt("releases", "publish.json").data.success, false);
  });
});

test("独立验收：缺少运行回执时在任何 Docker 发布操作前拒绝", async () => {
  await isolated(async ({ input, calls, receipt }) => {
    await assert.rejects(publishImages({ buildManifest: input, registry: "registry.example.invalid/team", validation: true }));
    assert.equal(calls.length, 0, "没有运行回执不能检查、标记或推送镜像");
    const out = receipt("releases", "publish.json");
    assert.equal(out.data.success, false);
    assert.equal(fs.existsSync(join(out.directory, "release.json")), false);
  });
});

test("独立验收：运行失败、清理失败或检查缺失均不能触发 Docker 发布", async () => {
  for (const change of [
    (runtime) => { runtime.success = false; },
    (runtime) => { runtime.cleanup = "failed"; },
    (runtime) => { runtime.checks.pop(); },
  ]) {
    await isolated(async ({ directory, input, build, calls, receipt }) => {
      const runtime = runtimeFixture(build); change(runtime);
      const runtimeManifest = join(directory, "runtime.json");
      fs.writeFileSync(runtimeManifest, JSON.stringify(runtime));
      await assert.rejects(publishImages({ buildManifest: input, runtimeManifest, registry: "registry.example.invalid/team", validation: true }));
      assert.equal(calls.length, 0);
      assert.equal(receipt("releases", "publish.json").data.success, false);
    });
  }
});

test("独立验收：有效运行回执通过前置门禁，错误镜像 ID 或源码指纹必须前置拒绝", async () => {
  await isolated(async ({ directory, input, build, calls }) => {
    const runtimeManifest = join(directory, "runtime.json");
    fs.writeFileSync(runtimeManifest, JSON.stringify(runtimeFixture(build)));
    await assert.rejects(publishImages({ buildManifest: input, runtimeManifest, registry: "registry.example.invalid/team", validation: true }), /Independent test blocked Docker side effect/);
    assert.equal(calls.length, 1, "有效回执应通过门禁进入只读镜像检查");
    assert.deepEqual(calls[0].args.slice(0, 2), ["image", "inspect"]);
  });
  for (const change of [
    (runtime) => { runtime.images.find((item) => item.service === "manager-server").localImageId = "sha256:" + "f".repeat(64); },
    (runtime) => { runtime.source.fingerprint = "f".repeat(64); },
  ]) {
    await isolated(async ({ directory, input, build, calls, receipt }) => {
      const runtime = runtimeFixture(build); change(runtime);
      const runtimeManifest = join(directory, "runtime.json");
      fs.writeFileSync(runtimeManifest, JSON.stringify(runtime));
      await assert.rejects(publishImages({ buildManifest: input, runtimeManifest, registry: "registry.example.invalid/team", validation: true }));
      assert.equal(calls.length, 0, "未验收的镜像或源码不能执行 Docker 发布");
      assert.equal(receipt("releases", "publish.json").data.success, false);
    });
  }
});

test("独立验收：干净 runner 在创建容器前拉取固定 PostgreSQL digest", async () => {
  await isolated(async ({ input, calls, receipt, postgresImage }) => {
    await assert.rejects(validateRuntime(input)); // Stop intentionally at simulated Compose up; never create a container.
    const pull = calls.findIndex((call) => call.type === "spawn" && call.args[0] === "pull" && call.args.includes(postgresImage));
    const up = calls.findIndex((call) => call.type === "spawn" && call.args[0] === "compose" && call.args.includes("up"));
    assert.ok(postgresImage.includes("@sha256:"));
    assert.ok(pull >= 0, "缺少固定 PostgreSQL 镜像的预拉取");
    assert.ok(up > pull, "必须先拉取依赖镜像再启动容器");
    assert.ok(calls[up].args.includes("never"), "应用镜像继续禁止漂移拉取");
    assert.equal(receipt("runtime", "runtime.json").data.success, false);
  }, true);
});

test("独立验收：依赖镜像实际平台不符时在启动容器前失败", async () => {
  await isolated(async ({ input, calls, receipt }) => {
    await assert.rejects(validateRuntime(input), /平台/);
    assert.equal(calls.some((call) => call.type === "spawn" && call.args[0] === "compose" && call.args.includes("up")), false);
    assert.equal(receipt("runtime", "runtime.json").data.success, false);
  }, true, "linux/arm64");
});
