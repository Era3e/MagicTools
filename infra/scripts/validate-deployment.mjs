import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { root, inspectImage } from "./build-images.mjs";
import { deployRelease } from "./deploy-release.mjs";
import { publishImages } from "./publish-images.mjs";
import { runtimeCatalog } from "./lib/runtime-artifacts.mjs";
import { digestBytes, validateReleaseManifest } from "./lib/release-artifacts.mjs";
import { runProcess } from "./lib/validation-process.mjs";
import { assertDeploymentValidationIsolation } from "./lib/deployment-validation.mjs";

const registryImage = "registry:2@sha256:a3d8aaa63ed8681a604f1dea0aa03f100d5895b6a58ace528858a7b332415373";
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", windowsHide: true, timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
async function runDocker(...args) {
  const result = await runProcess("docker", args, { cwd: root, timeoutMs: 8 * 60_000 });
  if (result.exitCode !== 0) throw new Error("验证Docker命令失败：" + args[0]);
}
async function freePort() {
  const server = createServer(); await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port; await new Promise((resolve) => server.close(resolve)); return port;
}
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

export async function validateDeployment(previousDirectory, currentDirectory, { distinctRevisions = false } = {}) {
  const previous = readJson(join(previousDirectory, "release.json")); const current = readJson(join(currentDirectory, "release.json"));
  const catalog = runtimeCatalog(readJson(join(currentDirectory, "ports.json")));
  for (const release of [previous, current]) {
    validateReleaseManifest(release, catalog, { allowValidation: true });
    if (release.images.some((item) => !/^(localhost|127\.0\.0\.1):[0-9]+\//.test(item.repository))) throw new Error("部署验证只能操作本机测试registry");
  }
  for (const [folder, release] of [[previousDirectory, previous], [currentDirectory, current]]) {
    for (const file of release.files) assert.equal(digestBytes(readFileSync(join(folder, file.path))), file.sha256, "制品文件校验失败");
    assertDeploymentValidationIsolation(readJson(join(folder, "compose.json")), catalog, release.images);
  }
  if (distinctRevisions && previous.revision === current.revision) throw new Error("两版验收必须提供不同源码版本");
  const id = randomBytes(8).toString("hex"); const project = "mt-validation-deploy-" + id;
  const directory = join(root, ".qa/deployment-validation", id); mkdirSync(directory, { recursive: true });
  const stateDirectory = join(directory, "state"); const secretsFile = join(directory, "private.env");
  const token = randomBytes(32).toString("hex");
  const privateEnv = "GATEWAY_TOKEN=" + token + "\nPOSTGRES_PASSWORD=postgres\n" + catalog.filter((item) => item.service.endsWith("-server")).map((item) =>
    item.app.toUpperCase() + "_DATABASE_URL=postgres://postgres:postgres@postgres:5432/" + item.app + "\n").join("");
  writeFileSync(secretsFile, privateEnv, { mode: 0o600 }); const originalSecrets = readFileSync(secretsFile);
  const firstConfig = { schema: "magictools-deployment-config/1", project, gatewayBind: "127.0.0.1", gatewayPort: await freePort(), waitTimeoutSeconds: 60 };
  const secondConfig = { ...firstConfig, gatewayPort: await freePort() };
  for (let attempt = 0; attempt < 5 && secondConfig.gatewayPort === firstConfig.gatewayPort; attempt++) secondConfig.gatewayPort = await freePort();
  assert.notEqual(secondConfig.gatewayPort, firstConfig.gatewayPort, "验证需要两个不同的可用端口");
  const firstConfigFile = join(directory, "first-config.json"); const secondConfigFile = join(directory, "second-config.json");
  writeFileSync(firstConfigFile, JSON.stringify(firstConfig)); writeFileSync(secondConfigFile, JSON.stringify(secondConfig));
  const report = { schema: "magictools-deployment-validation/1", id, project, success: false, startedAt: new Date().toISOString(),
    mode: { containers: "real", database: "real", registry: "real", ssh: "not-run", upgrade: distinctRevisions ? "distinct-revisions" : "config-change" },
    previousRevision: previous.revision, currentRevision: current.revision, checks: [] };
  const options = { stateDirectory, secretsFile, allowValidation: true };
  const state = () => readJson(join(stateDirectory, "state.json"));
  const checked = async (name, fn) => { await fn(); report.checks.push({ name, status: "passed" }); console.log("PASS deployment:", name); };
  const receipts = [];
  const deploy = async (releaseDirectory, configFile) => {
    const receipt = await deployRelease({ ...options, releaseDirectory, configFile }); receipts.push(receipt); return receipt;
  };
  const restore = async () => { const receipt = await deployRelease({ ...options, rollback: true }); receipts.push(receipt); return receipt; };
  let activeConfig = firstConfig; let requirementId; let initialPostgresId;
  const request = (path, init) => fetch("http://127.0.0.1:" + activeConfig.gatewayPort + path,
    { ...init, headers: { "x-access-token": token, ...init?.headers }, signal: AbortSignal.timeout(15_000) });
  const assertData = async () => {
    const response = await request("/api/manager/requirements/" + requirementId);
    assert.equal(response.status, 200); assert.equal((await response.json()).description, "persist across versions");
  };
  const artifact = (name, release) => {
    const folder = join(directory, name); mkdirSync(folder);
    for (const file of release.files) writeFileSync(join(folder, file.path), readFileSync(join(currentDirectory, file.path)));
    writeFileSync(join(folder, "release.json"), JSON.stringify(release)); return folder;
  };
  const composeArgs = (attemptId) => ["compose", "--project-name", project, "--env-file", secretsFile, "-f", join(stateDirectory, "attempts", attemptId, "compose.json")];
  try {
    await checked("first-deploy-and-data", async () => {
      const receipt = await deploy(previousDirectory, firstConfigFile);
      initialPostgresId = docker(...composeArgs(receipt.attemptId), "ps", "--quiet", "postgres");
      const response = await request("/api/manager/requirements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "P05 " + id, description: "persist across versions", priority: "P2" }) });
      assert.equal(response.status, 201); requirementId = (await response.json()).id; assert.ok(requirementId);
    });
    await checked("upgrade-and-config-version", async () => {
      const receipt = await deploy(currentDirectory, secondConfigFile); activeConfig = secondConfig;
      assert.notEqual(receipt.configVersion, receipts[0].configVersion); assert.equal(receipt.revision, current.revision); await assertData();
      assert.equal(docker(...composeArgs(receipt.attemptId), "ps", "--quiet", "postgres"), initialPostgresId, "初始化SQL未变化时不重建数据库");
    });
    await checked("moving-tag-does-not-change-digest-deployment", async () => {
      const after = current.images.find((image) => image.service === "manager-server");
      const previousManager = previous.images.find((image) => image.service === "manager-server");
      const before = previousManager.registryDigest === after.registryDigest ? current.images.find((image) => image.service === "gateway") : previousManager;
      assert.notEqual(before.registryDigest, after.registryDigest, "移动标签的两个目标必须不同");
      const alias = after.repository + ":validation-moving-" + id;
      const slash = after.repository.indexOf("/");
      const readDigest = async () => {
        const response = await fetch("http://" + after.repository.slice(0, slash).replace(/^localhost:/, "127.0.0.1:") + "/v2/" + after.repository.slice(slash + 1) + "/manifests/validation-moving-" + id,
          { headers: { accept: "application/vnd.oci.image.index.v1+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json" }, signal: AbortSignal.timeout(10_000) });
        assert.equal(response.status, 200); return response.headers.get("docker-content-digest");
      };
      await runDocker("tag", before.reference, alias); await runDocker("push", alias);
      assert.equal(await readDigest(), before.registryDigest);
      await runDocker("tag", after.reference, alias); await runDocker("push", alias);
      assert.equal(await readDigest(), after.registryDigest);
      report.tagMovement = { alias, beforeDigest: before.registryDigest, afterDigest: after.registryDigest, source: before.service === "manager-server" ? "previous-release" : "different-service-fixture" };
      const actual = docker(...composeArgs(state().current.attemptId), "ps", "--quiet", "manager-server");
      assert.equal(docker("inspect", actual, "--format", "{{.Config.Image}}"), after.reference); await assertData();
    });
    await checked("pull-failure-and-restore-last-success", async () => {
      const broken = structuredClone(current); const target = broken.images.find((image) => image.service === "manager-server");
      broken.mode = "validation"; broken.releaseId = current.revision + "-missing-" + id;
      target.registryDigest = "sha256:" + "0".repeat(64); target.reference = target.repository + "@" + target.registryDigest;
      report.pullFault = { reference: target.reference, mode: "validation-fault-injection" };
      const before = state().current;
      await assert.rejects(deploy(artifact("missing-image", broken), secondConfigFile));
      assert.equal(state().current.attemptId, before.attemptId);
      const failed = readJson(join(stateDirectory, "attempts", state().lastAttempt.attemptId, "receipt.json")); assert.equal(failed.stage, "pull"); assert.equal(failed.success, false);
      const recovered = await restore(); assert.equal(recovered.releaseId, current.releaseId); await assertData();
    });
    await checked("rollback-previous-version-and-data", async () => {
      const receipt = await restore(); activeConfig = firstConfig;
      assert.equal(receipt.releaseId, previous.releaseId); assert.equal(receipt.configVersion, receipts[0].configVersion); await assertData();
    });
    await checked("bad-credentials-fail-readiness-and-preserve-success", async () => {
      const badSecrets = join(directory, "bad-private.env");
      writeFileSync(badSecrets, privateEnv.replace(/MANAGER_DATABASE_URL=.*\n/, "MANAGER_DATABASE_URL=postgres://postgres:invalid-password@postgres:5432/manager\n"), { mode: 0o600 });
      const before = state().current;
      await assert.rejects(deployRelease({ ...options, secretsFile: badSecrets, releaseDirectory: currentDirectory, configFile: secondConfigFile }));
      assert.equal(state().current.attemptId, before.attemptId);
      const failed = readJson(join(stateDirectory, "attempts", state().lastAttempt.attemptId, "receipt.json")); assert.equal(failed.stage, "up");
      const logs = docker(...composeArgs(failed.attemptId), "logs", "--no-color", "manager-server");
      assert.ok(logs.includes("password authentication failed"), "必须实际复现数据库鉴权失败");
      assert.ok(!logs.includes(token), "故障日志不能包含运行令牌");
      const receipt = await restore(); activeConfig = firstConfig; assert.equal(receipt.releaseId, previous.releaseId); await assertData();
      unlinkSync(badSecrets);
    });
    await checked("migration-failure-is-not-success", async () => {
      const base = current.images.find((image) => image.service === "manager-server");
      const context = join(directory, "fault-context"); mkdirSync(context);
      const sql = "SELECT 1 / 0;\n"; writeFileSync(join(context, "failure.sql"), sql);
      writeFileSync(join(context, "Dockerfile"), "FROM " + base.reference + "\nCOPY --chown=node:node failure.sql /app/migrations/999_validation_failure.sql\n");
      const faultTag = base.repository + ":validation-failure-" + id;
      await runDocker("build", "--platform", current.platform, "-t", faultTag, context); await runDocker("push", faultTag);
      const reference = JSON.parse(docker("image", "inspect", faultTag, "--format", "{{json .RepoDigests}}" )).find((value) => value.startsWith(base.repository + "@"));
      assert.ok(reference);
      const broken = structuredClone(current); broken.mode = "validation"; broken.releaseId = current.revision + "-failure-" + id;
      const image = broken.images.find((item) => item.service === "manager-server");
      image.reference = reference; image.registryDigest = reference.slice(base.repository.length + 1); image.localImageId = inspectImage(reference).id;
      const before = state().current;
      await assert.rejects(deploy(artifact("migration-failure", broken), secondConfigFile));
      assert.equal(state().current.attemptId, before.attemptId);
      const failed = readJson(join(stateDirectory, "attempts", state().lastAttempt.attemptId, "receipt.json")); assert.equal(failed.stage, "up");
      const logs = docker(...composeArgs(failed.attemptId), "logs", "--no-color", "manager-server");
      assert.ok(logs.includes("division by zero")); assert.ok(!logs.includes(token), "故障日志不能包含运行令牌");
      report.migrationFault = { baseReference: base.reference, faultReference: reference, sqlSha256: digestBytes(sql), mode: "validation-fault-injection" };
      const receipt = await restore(); activeConfig = firstConfig; assert.equal(receipt.releaseId, previous.releaseId); await assertData();
    });
    await checked("existing-secrets-and-stable-database", async () => {
      assert.ok(readFileSync(secretsFile).equals(originalSecrets), "已有秘密文件被修改");
      assert.equal(docker(...composeArgs(state().current.attemptId), "ps", "--quiet", "postgres"), initialPostgresId);
    });
    report.success = true;
  } catch (error) { report.error = String(error); throw error; }
  finally {
    report.receipts = receipts.map((item) => ({ attemptId: item.attemptId, releaseId: item.releaseId, revision: item.revision, configVersion: item.configVersion }));
    try {
      const ids = docker("ps", "-aq", "--filter", "label=com.docker.compose.project=" + project).split(/\r?\n/).filter(Boolean);
      if (ids.length) {
        const owner = digestBytes(realpathSync(stateDirectory));
        for (const container of ids) assert.equal(JSON.parse(docker("inspect", container, "--format", '{{json (index .Config "Labels")}}'))["magictools.deployment"], owner);
      }
      const attemptsDirectory = join(stateDirectory, "attempts");
      const usableAttempt = existsSync(attemptsDirectory) && readdirSync(attemptsDirectory).find((attempt) => /^[a-f0-9]{16}$/.test(attempt) && existsSync(join(attemptsDirectory, attempt, "compose.json")));
      if (usableAttempt) await runDocker(...composeArgs(usableAttempt), "down", "--volumes", "--remove-orphans");
      assert.equal(docker("ps", "-aq", "--filter", "label=com.docker.compose.project=" + project), "");
      for (const kind of ["network", "volume"]) assert.equal(docker(kind, "ls", "--filter", "label=com.docker.compose.project=" + project, "--format", "{{.Name}}"), "");
      report.cleanup = "passed";
      for (const name of ["private.env", "bad-private.env"]) if (existsSync(join(directory, name))) unlinkSync(join(directory, name));
    } catch (error) { report.success = false; report.cleanup = "failed"; report.cleanupError = String(error); process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    writeFileSync(join(directory, "summary.json"), JSON.stringify(report, null, 2) + "\n");
    console.log("Deployment validation:", join(directory, "summary.json"));
  }
  return report;
}

export async function validateBuildDeployment(buildDirectory, runtime) {
  const id = "mt-deployment-registry-" + randomBytes(8).toString("hex");
  try {
    await runDocker("pull", registryImage);
    await runDocker("run", "-d", "--name", id, "--label", "magictools.validation=" + id, "-p", "127.0.0.1::5000", registryImage);
    const address = docker("port", id, "5000/tcp"); assert.match(address, /^127\.0\.0\.1:\d+$/);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { if ((await fetch("http://" + address + "/v2/", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* 容器启动后HTTP监听可能稍晚。 */ }
      await delay(200);
    }
    assert.equal(ready, true, "测试registry未就绪");
    const result = await publishImages({ buildManifest: join(buildDirectory, "build.json"), runtimeManifest: join(root, ".qa/runtime", runtime.runId, "runtime.json"), registry: "localhost:" + address.split(":")[1] + "/validation", validation: true });
    const report = await validateDeployment(result.directory, result.directory);
    if (!report.success) throw new Error("部署验证失败");
  } finally {
    if (docker("ps", "-aq", "--filter", "name=^/" + id + "$")) {
      assert.equal(JSON.parse(docker("inspect", id, "--format", '{{json (index .Config "Labels")}}'))["magictools.validation"], id);
      await runDocker("rm", "-f", "-v", id);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) throw new Error("用法：validate-deployment <上一版制品目录> <当前版制品目录>（不同源码版本）");
    const report = await validateDeployment(resolve(process.argv[2]), resolve(process.argv[3]), { distinctRevisions: true });
    if (!report.success) process.exitCode = 1;
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
