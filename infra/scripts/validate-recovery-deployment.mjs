import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { deployRelease } from "./deploy-release.mjs";
import { backupCommand } from "./backup.mjs";
import { digestBytes } from "./lib/release-artifacts.mjs";
import { recoveryConnectionFields } from "./lib/recovery-connections.mjs";
import { captureValidationIdentity } from "./lib/quality-evidence.mjs";
import { inspectRecoveryValidationReleases, parseRecoveryValidationArgs, RecoveryValidationResources } from "./lib/recovery-deployment-validation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const registryImage = "registry:2@sha256:a3d8aaa63ed8681a604f1dea0aa03f100d5895b6a58ace528858a7b332415373";
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const write = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
const uuid = (value) => { assert.match(value ?? "", /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/); return value; };
const mountOrder = (mounts) => [...mounts].sort((a, b) => a.Destination.localeCompare(b.Destination));

async function freePort(excluded = []) {
  for (;;) {
    const server = createServer();
    await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
    const port = server.address().port; await new Promise((done) => server.close(done));
    if (port !== 5432 && !excluded.includes(port)) return port;
  }
}
async function until(action, label, milliseconds = 30_000) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { if (await action()) return; await delay(500); }
  throw new Error(label + "未在限定时间内满足");
}

export async function validateRecoveryDeployment(previousDirectory, currentDirectory, options = {}) {
  // Files, immutable references, and local registry boundaries precede every Docker action.
  const input = inspectRecoveryValidationReleases(previousDirectory, currentDirectory, options);
  const { previous, current, catalog, databases } = input;
  const id = randomBytes(8).toString("hex"), namespace = "mt-validation-rec-" + id;
  const parent = join(root, ".qa/recovery-deployment"); mkdirSync(parent, { recursive: true });
  if (lstatSync(join(root, ".qa")).isSymbolicLink() || lstatSync(parent).isSymbolicLink()) throw new Error("验收输出目录不能为链接");
  const directory = join(parent, id); mkdirSync(directory);
  const sourceProject = namespace + "-src", targetProject = namespace + "-dst", restoreName = namespace + "-db";
  const sourceState = join(directory, "source-state"), targetState = join(directory, "target-state"), store = join(directory, "store");
  const secrets = join(directory, "private.env"), keyFile = join(directory, "private.key"), credentials = join(directory, "credentials.env");
  const password = randomBytes(24).toString("hex"), token = randomBytes(32).toString("hex"), privateFiles = new Set();
  const publicReceipts = join(directory, "receipts"); mkdirSync(publicReceipts);
  const report = { schema: "magictools-recovery-deployment-validation/1", id, success: false, stage: "preflight", startedAt: new Date().toISOString(),
    mode: { database: "real", containers: "real", registry: "local-real", releaseComparison: input.releaseComparison, externalServices: "owned-local-receiver-only", liveModel: "not-run", ssh: "not-run" },
    releases: [previous, current].map((item) => ({ releaseId: item.release.releaseId, revision: item.release.revision, mode: item.release.mode, manifestSha256: item.manifestSha256 })),
    checks: [], receipts: [], cleanup: "pending", privateFilesCleared: false };
  const redact = (value) => String(value).replaceAll(password, "[redacted]").replaceAll(token, "[redacted]").replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[database-url]").slice(0, 2400);
  const docker = (args, data, timeout = 120_000) => {
    try { return execFileSync("docker", args, { input: data, encoding: "utf8", windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }).trim(); }
    catch (error) { throw Object.assign(new Error("验收 Docker " + args[0] + " 失败"), { code: typeof error.status === "number" ? error.status : "DOCKER_FAILED" }); }
  };
  const resources = new RecoveryValidationResources(docker), backupOperations = new Set(), discoveryErrors = [];
  const validationLabel = { "magictools.recovery.validation": id };
  const sql = (container, database, query) => docker(["exec", "-i", "--user", "postgres", container, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], query);
  const state = () => read(join(targetState, "state.json"));
  const compose = (project, stateDirectory, attempt) => ["compose", "--project-name", project, "--env-file", secrets, "-f", join(stateDirectory, "attempts", attempt, "compose.json")];
  const inspect = (kind, name) => JSON.parse(docker([kind, "inspect", name]))[0];
  const checked = async (name, action) => { report.stage = name; console.log("RUN recovery:", id, name); await action(); report.checks.push({ name, status: "passed" }); console.log("PASS recovery:", name); };
  const privateFile = (file, bytes) => { privateFiles.add(file); writeFileSync(file, bytes, { flag: "wx", mode: 0o600 }); };
  const emptyNamespace = () => {
    for (const kind of ["container", "network", "volume"]) {
      const names = docker([kind, "ls", ...kind === "container" ? ["--all"] : [], "--format", kind === "container" ? "{{.Names}}" : "{{.Name}}"]);
      assert.ok(!names.split(/\r?\n/).some((name) => name.startsWith(namespace + "-") || name.startsWith(namespace + "_")), "验收命名空间存在既有资源");
    }
  };
  const rememberProject = (project, stateDirectory) => {
    if (!existsSync(stateDirectory)) return;
    const owner = digestBytes(realpathSync(stateDirectory));
    for (const kind of ["container", "network", "volume"]) {
      const names = docker([kind, "ls", ...kind === "container" ? ["--all", "--no-trunc"] : [], "--filter", "label=com.docker.compose.project=" + project, "--format", kind === "container" ? "{{.Names}}" : "{{.Name}}"]);
      for (const name of names.split(/\r?\n/).filter(Boolean)) {
        assert.ok(name.startsWith(project + "-") || name.startsWith(project + "_"));
        const labels = { "com.docker.compose.project": project };
        if (kind === "container" || project === targetProject) labels["magictools.deployment"] = owner;
        if (kind === "volume") { assert.equal(project, sourceProject); assert.equal(name, sourceProject + "_pgdata"); labels["com.docker.compose.volume"] = "pgdata"; }
        if (kind === "network") assert.ok([project + "_default", ...project === targetProject ? [project + "_ingress"] : []].includes(name));
        resources.remember(kind, name, labels);
      }
    }
  };
  const rememberBackup = () => {
    for (const operation of backupOperations) for (const kind of ["container", "network", "volume"]) {
      const names = docker([kind, "ls", ...kind === "container" ? ["--all"] : [], "--filter", "label=magictools.backup.operation=" + operation, "--format", kind === "container" ? "{{.Names}}" : "{{.Name}}"]);
      for (const name of names.split(/\r?\n/).filter(Boolean)) {
        assert.ok(name.startsWith("mt-backup-" + operation + "-") || name.startsWith(restoreName), "未知备份资源不能被验收清理接管");
        resources.remember(kind, name, { "magictools.backup.operation": operation });
      }
    }
  };
  const backup = async (args) => {
    try { const result = await backupCommand(args); if (/^[a-f0-9]{16}$/.test(result.operationId ?? result.backupId)) backupOperations.add(result.operationId ?? result.backupId); return result; }
    catch (error) { if (/^[a-f0-9]{16}$/.test(error.operationId ?? "")) backupOperations.add(error.operationId); throw error; }
    finally { rememberBackup(); }
  };
  const create = (kind, name, args, labels = validationLabel) => {
    assert.equal(resources.optional(kind, name), null, "验收资源已存在");
    try { docker(args); } finally { if (resources.optional(kind, name)) resources.remember(kind, name, labels); }
  };
  const saveAttempt = (project, stateDirectory) => {
    if (!existsSync(join(stateDirectory, "state.json"))) return;
    const last = read(join(stateDirectory, "state.json")).lastAttempt?.attemptId;
    if (!/^[a-f0-9]{16}$/.test(last ?? "")) return;
    const file = join(stateDirectory, "attempts", last, "receipt.json"); if (!existsSync(file)) return;
    const receipt = read(file), output = join(publicReceipts, project + "-" + last + ".json");
    if (!existsSync(output)) write(output, receipt);
    if (!report.receipts.some((entry) => entry.attemptId === last)) report.receipts.push({ attemptId: last, project, success: receipt.success, stage: receipt.stage, releaseId: receipt.releaseId, configVersion: receipt.configVersion });
  };
  let sourceReceipt, sourcePg, sourcePgBefore, restored, binding, sourceConfig, activeConfig, requirement, sinkName, sinkUrl, feed, initialRuns, sinkBaseline, sourceGatherer, faultTag;
  const targetA = join(directory, "target-a.json"), targetB = join(directory, "target-b.json");
  const request = (port, path, options = {}) => fetch("http://127.0.0.1:" + port + path, { ...options, headers: { "x-access-token": token, ...options.headers }, signal: AbortSignal.timeout(15_000) });
  const serviceContainer = (project, stateDirectory, attempt, service) => { const value = docker([...compose(project, stateDirectory, attempt), "ps", "--quiet", service]); assert.match(value, /^[a-f0-9]{64}$/); return value; };
  const appQuery = (attempt, service, variable, query) => {
    const container = serviceContainer(targetProject, targetState, attempt, service);
    const code = "const{createRequire}=require('node:module');const{Pool}=createRequire(require.resolve('@mt/db'))('pg');const p=new Pool({connectionString:process.env[" + JSON.stringify(variable) + "],connectionTimeoutMillis:5000,statement_timeout:5000});p.query(" + JSON.stringify(query) + ").then(r=>console.log(JSON.stringify(r.rows))).catch(e=>{console.error(JSON.stringify({name:e.name,code:e.code}));process.exitCode=1}).finally(()=>p.end());";
    return JSON.parse(docker(["exec", container, "node", "-e", code]));
  };
  const sinkStats = () => JSON.parse(docker(["exec", sinkName, "node", "-e", "fetch('http://127.0.0.1:8080/stats').then(r=>r.text()).then(console.log).catch(()=>process.exitCode=1)"]));
  const rememberClaim = () => {
    if (!binding || !existsSync(targetState)) return;
    const name = "mt-recovery-" + binding.restoreOperationId + "-claim";
    if (resources.optional("container", name)) resources.remember("container", name, { "magictools.recovery.claim": "1", "magictools.recovery.operation": binding.restoreOperationId,
      "magictools.recovery.binding": digestBytes(JSON.stringify(binding)), "magictools.deployment": digestBytes(realpathSync(targetState)), "magictools.recovery.project": targetProject });
  };
  const deployTarget = async (folder, configFile = targetA, secretsFile = secrets, allowValidation = options.allowValidation === true) => {
    try { const result = await deployRelease({ releaseDirectory: folder, configFile, secretsFile, stateDirectory: targetState, allowValidation }); activeConfig = read(configFile); return result; }
    finally { rememberProject(targetProject, targetState); rememberClaim(); saveAttempt(targetProject, targetState); }
  };
  const rollback = async () => {
    try { const result = await deployRelease({ stateDirectory: targetState, secretsFile: secrets, rollback: true, allowValidation: options.allowValidation === true }); activeConfig = read(join(targetState, "attempts", result.attemptId, "config.json")); return result; }
    finally { rememberProject(targetProject, targetState); rememberClaim(); saveAttempt(targetProject, targetState); }
  };
  const assertTarget = async (description) => {
    const pointer = state().current;
    for (const field of recoveryConnectionFields(catalog)) assert.deepEqual(appQuery(pointer.attemptId, field.service, field.field, "SELECT value FROM recovery_validation_marker ORDER BY value;"), [{ value: id }]);
    const response = await request(activeConfig.gatewayPort, "/api/manager/requirements/" + requirement.id); assert.equal(response.status, 200); assert.equal((await response.json()).description, description);
    assert.equal(inspect("container", restored.container).Id, binding.container.id);
  };
  const failedAttempt = async (action, expectedStage) => {
    const before = state().current; await assert.rejects(action); assert.deepEqual(state().current, before);
    const failed = read(join(targetState, "attempts", state().lastAttempt.attemptId, "receipt.json")); assert.equal(failed.success, false); assert.equal(failed.stage, expectedStage); return failed;
  };
  const artifact = (name, release) => {
    const path = join(directory, name); mkdirSync(path);
    for (const [file, content] of Object.entries(current.contents)) writeFileSync(join(path, file), content, { flag: "wx" });
    write(join(path, "release.json"), release); return path;
  };
  try {
    report.identity = captureValidationIdentity(root, process.env, id); emptyNamespace();
    const privateEnv = "GATEWAY_TOKEN=" + token + "\nPOSTGRES_PASSWORD=" + password + "\n" + databases.map((database) => database.toUpperCase() + "_DATABASE_URL=postgres://postgres:" + password + "@postgres:5432/" + database + "\n").join("");
    privateFile(secrets, privateEnv); privateFile(keyFile, randomBytes(32)); privateFile(credentials, JSON.stringify({ schema: "magictools-backup-credentials/1", user: "postgres", password }));
    sourceConfig = { schema: "magictools-deployment-config/1", project: sourceProject, gatewayBind: "127.0.0.1", gatewayPort: await freePort(), waitTimeoutSeconds: 120 };
    const targetBase = { ...sourceConfig, project: targetProject, gatewayPort: await freePort([sourceConfig.gatewayPort]) };
    const sourceConfigFile = join(directory, "source-config.json"), targetBaseFile = join(directory, "target-base.json"); write(sourceConfigFile, sourceConfig); write(targetBaseFile, targetBase);
    await checked("fresh-b-source-platform-eight-markers-and-manager-api", async () => {
      try { sourceReceipt = await deployRelease({ releaseDirectory: current.directory, configFile: sourceConfigFile, secretsFile: secrets, stateDirectory: sourceState, allowValidation: options.allowValidation === true }); }
      finally { rememberProject(sourceProject, sourceState); saveAttempt(sourceProject, sourceState); }
      assert.equal(sourceReceipt.ready.length, 17);
      sourcePg = serviceContainer(sourceProject, sourceState, sourceReceipt.attemptId, "postgres"); sourcePgBefore = inspect("container", sourcePg);
      report.sourceDatabase = { id: sourcePgBefore.Id, startedAt: sourcePgBefore.State.StartedAt, mounts: mountOrder(sourcePgBefore.Mounts) };
      for (const database of databases) sql(sourcePg, database, "CREATE TABLE recovery_validation_marker(value text PRIMARY KEY); INSERT INTO recovery_validation_marker VALUES ('" + id + "');");
      const response = await request(sourceConfig.gatewayPort, "/api/manager/requirements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "P04 recovery " + id, description: "source snapshot " + id, priority: "P2" }) });
      assert.equal(response.status, 201); requirement = await response.json(); uuid(requirement.id); report.requirementId = requirement.id;
    });
    const infrastructureNetwork = namespace + "-probe-net";
    await checked("owned-receiver-and-real-source-collect-positive-control", async () => {
      create("network", infrastructureNetwork, ["network", "create", "--label", "magictools.recovery.validation=" + id, infrastructureNetwork]);
      sinkName = namespace + "-receiver";
      const nodeImage = current.release.images.find((image) => image.service === "gateway").reference;
      const serverCode = "const http=require('node:http');let count=0;http.createServer((req,res)=>{res.setHeader('content-type','application/json');if(req.url==='/stats')res.end(JSON.stringify({count}));else{count++;res.end(JSON.stringify({items:[]}));}}).listen(8080,'0.0.0.0');";
      create("container", sinkName, ["run", "-d", "--pull", "never", "--name", sinkName, "--label", "magictools.recovery.validation=" + id, "--network", infrastructureNetwork, "--entrypoint", "node", nodeImage, "-e", serverCode]);
      await until(() => { try { return sinkStats().count === 0; } catch { return false; } }, "接收器就绪");
      const ip = inspect("container", sinkName).NetworkSettings.Networks[infrastructureNetwork].IPAddress; assert.match(ip, /^\d+\.\d+\.\d+\.\d+$/); sinkUrl = "http://" + ip + ":8080/feed/" + id;
      sourceGatherer = serviceContainer(sourceProject, sourceState, sourceReceipt.attemptId, "gatherer-server"); docker(["network", "connect", infrastructureNetwork, sourceGatherer]);
      const response = await request(sourceConfig.gatewayPort, "/api/gatherer/sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "recovery-cron-" + id, type: "json_api", url: sinkUrl, cron: "*/5 * * * * *", options: { llm: false, autoPush: false } }) });
      assert.equal(response.status, 201); feed = await response.json(); uuid(feed.id); assert.equal(feed.status, "active");
      const collect = await request(sourceConfig.gatewayPort, "/api/gatherer/sources/" + feed.id + "/collect", { method: "POST" }); assert.equal(collect.status, 201);
      sinkBaseline = sinkStats().count; assert.ok(sinkBaseline > 0);
      // SourceService.create does not register new cron jobs; only bootstrap does.
      await delay(6500); assert.equal(sinkStats().count, sinkBaseline);
      report.outboundControl = { sourceId: feed.id, receiver: sinkName, receiverBaseline: sinkBaseline, sourcePositive: "passed", targetNegative: "pending" };
    });
    let restorationStarted;
    await checked("physical-backup-restore-and-authenticated-handoff", async () => {
      const created = await backup(["create", "--container", sourcePg, "--directory", store, "--key-file", keyFile, "--credentials-file", credentials, "--catalog", join(current.directory, "ports.json"), "--events-dir", join(directory, "events")]);
      report.backup = { backupId: created.backupId, manifestSha256: digestBytes(readFileSync(join(created.directory, "backup.json"))) };
      for (const database of databases) sql(sourcePg, database, "INSERT INTO recovery_validation_marker VALUES ('post-backup');");
      restorationStarted = performance.now(); restored = await backup(["restore", "--backup", created.directory, "--key-file", keyFile, "--target", restoreName, "--events-dir", join(directory, "events")]); report.restore = restored;
      report.handoff = await backup(["handoff", "--backup", created.directory, "--key-file", keyFile, "--restore-receipt", join(store, "attempt-" + restored.operationId + ".json"), "--config", targetBaseFile, "--output", targetA, "--catalog", join(current.directory, "ports.json"), "--events-dir", join(directory, "events")]);
      const config = read(targetA); binding = config.database; write(targetB, { ...config, gatewayPort: await freePort([sourceConfig.gatewayPort, targetBase.gatewayPort]) });
      initialRuns = Number(sql(restored.container, "gatherer", "SELECT count(*) FROM runs WHERE source_id='" + feed.id + "';"));
    });
    await checked("a-seventeen-ready-twelve-real-connections-and-manager-isolation", async () => {
      const first = await deployTarget(previous.directory); assert.equal(first.ready.length, 17); assert.equal(first.databaseConnections.length, 12);
      await assertTarget("source snapshot " + id); report.platformRestoreMilliseconds = Math.round(performance.now() - restorationStarted);
      const changed = await request(activeConfig.gatewayPort, "/api/manager/requirements/" + requirement.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: requirement.revision, description: "restored change " + id }) }); assert.equal(changed.status, 200);
      const original = await request(sourceConfig.gatewayPort, "/api/manager/requirements/" + requirement.id); assert.equal(original.status, 200); assert.equal((await original.json()).description, "source snapshot " + id);
    });
    await checked("active-restored-cron-attempts-but-cannot-reach-owned-receiver", async () => {
      await until(() => Number(sql(restored.container, "gatherer", "SELECT count(*) FROM runs WHERE source_id='" + feed.id + "';")) > initialRuns, "恢复cron实际运行");
      const gatherer = serviceContainer(targetProject, targetState, state().current.attemptId, "gatherer-server");
      const probe = "fetch(" + JSON.stringify(sinkUrl) + ",{signal:AbortSignal.timeout(2000)}).then(r=>console.log(JSON.stringify({reachable:true,status:r.status}))).catch(()=>console.log(JSON.stringify({reachable:false})));";
      assert.deepEqual(JSON.parse(docker(["exec", gatherer, "node", "-e", probe])), { reachable: false });
      assert.equal(sinkStats().count, sinkBaseline);
      report.outboundControl.targetNegative = "passed"; report.outboundControl.restoredCronRuns = Number(sql(restored.container, "gatherer", "SELECT count(*) FROM runs WHERE source_id='" + feed.id + "';")) - initialRuns;
    });
    await checked("application-a-b-a-retains-data-and-restored-identity", async () => {
      const updated = await deployTarget(current.directory, targetB); assert.equal(updated.revision, current.release.revision); await assertTarget("restored change " + id);
      const rolled = await rollback(); assert.equal(rolled.revision, previous.release.revision); await assertTarget("restored change " + id);
    });
    await checked("bad-password-fails-without-advancing-current-and-rolls-back", async () => {
      const bad = join(directory, "bad-private.env"); privateFile(bad, privateEnv.replace(/MANAGER_DATABASE_URL=.*\n/, "MANAGER_DATABASE_URL=postgres://postgres:invalid-password@postgres:5432/manager\n"));
      const failed = await failedAttempt(() => deployTarget(current.directory, targetB, bad), "up");
      assert.ok(docker([...compose(targetProject, targetState, failed.attemptId), "logs", "--no-color", "manager-server"]).includes("password authentication failed"));
      await rollback(); await assertTarget("restored change " + id);
    });
    await checked("missing-fixed-digest-fails-pull-and-restores-last-success", async () => {
      const broken = structuredClone(current.release), manager = broken.images.find((image) => image.service === "manager-server");
      const missing = "sha256:" + randomBytes(32).toString("hex"), slash = manager.repository.indexOf("/");
      const response = await fetch("http://" + manager.repository.slice(0, slash).replace(/^localhost:/, "127.0.0.1:") + "/v2/" + manager.repository.slice(slash + 1) + "/manifests/" + missing, { method: "HEAD", signal: AbortSignal.timeout(10_000) }); assert.equal(response.status, 404);
      broken.mode = "validation"; broken.releaseId = current.release.revision + "-missing-" + id; manager.registryDigest = missing; manager.reference = manager.repository + "@" + missing;
      await failedAttempt(() => deployTarget(artifact("missing-image", broken), targetB, secrets, true), "pull"); report.pullFault = { reference: manager.reference, absenceHttpStatus: 404 };
      await rollback(); await assertTarget("restored change " + id);
    });
    await checked("owned-migration-fault-image-fails-and-rolls-back", async () => {
      const registry = namespace + "-registry", volume = registry + "-data", registryPort = await freePort([sourceConfig.gatewayPort, read(targetA).gatewayPort, read(targetB).gatewayPort]);
      docker(["pull", registryImage], undefined, 8 * 60_000);
      create("volume", volume, ["volume", "create", "--label", "magictools.recovery.validation=" + id, volume]);
      create("container", registry, ["run", "-d", "--name", registry, "--label", "magictools.recovery.validation=" + id, "--network", infrastructureNetwork, "-p", "127.0.0.1:" + registryPort + ":5000", "--mount", "type=volume,source=" + volume + ",target=/var/lib/registry", registryImage]);
      await until(async () => { try { return (await fetch("http://127.0.0.1:" + registryPort + "/v2/", { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; } }, "专用故障registry就绪");
      const base = current.release.images.find((image) => image.service === "manager-server"), context = join(directory, "fault-context"); mkdirSync(context);
      const failureSql = "SELECT 1 / 0;\n", tag = "localhost:" + registryPort + "/recovery-" + id + "/manager-server:failure";
      faultTag = tag;
      writeFileSync(join(context, "failure.sql"), failureSql, { flag: "wx" });
      writeFileSync(join(context, "Dockerfile"), "FROM " + base.reference + "\nLABEL magictools.recovery.validation=" + id + "\nCOPY --chown=node:node failure.sql /app/migrations/999_recovery_validation_failure.sql\n", { flag: "wx" });
      docker(["build", "--platform", current.release.platform, "-t", tag, context], undefined, 8 * 60_000); const faultImage = resources.remember("image", tag, validationLabel, { tag });
      docker(["push", tag], undefined, 8 * 60_000); const meta = inspect("image", tag), repository = tag.slice(0, tag.lastIndexOf(":"));
      const reference = meta.RepoDigests.find((value) => value.startsWith(repository + "@")); assert.ok(reference);
      faultImage.reference = reference;
      const broken = structuredClone(current.release), image = broken.images.find((item) => item.service === "manager-server");
      broken.mode = "validation"; broken.releaseId = current.release.revision + "-migration-" + id;
      Object.assign(image, { repository, reference, registryDigest: reference.slice(repository.length + 1), localImageId: meta.Id });
      const failed = await failedAttempt(() => deployTarget(artifact("migration-failure", broken), targetB, secrets, true), "up");
      assert.ok(docker([...compose(targetProject, targetState, failed.attemptId), "logs", "--no-color", "manager-server"]).includes("division by zero"));
      report.migrationFault = { baseReference: base.reference, faultReference: reference, imageId: meta.Id, sqlSha256: digestBytes(failureSql), registry: "owned-disposable", mode: "validation-fault-injection" };
      await rollback(); await assertTarget("restored change " + id);
    });
    await checked("same-name-different-id-is-rejected-without-double-mount", async () => {
      const before = state().current, preserved = restoreName + "-preserved"; let replacement;
      docker(["rename", binding.container.id, preserved]);
      try {
        const image = current.release.images.find((entry) => entry.service === "gateway").reference;
        create("container", restoreName, ["create", "--pull", "never", "--name", restoreName, "--label", "magictools.recovery.validation=" + id, "--network", "none", "--entrypoint", "node", image, "-e", "process.exit(0)"]);
        replacement = resources.records.findLast((entry) => entry.kind === "container" && entry.name === restoreName && entry.labels["magictools.recovery.validation"] === id);
        const meta = inspect("container", restoreName); assert.notEqual(meta.Id, binding.container.id); assert.equal(meta.Mounts.length, 0);
        await assert.rejects(deployTarget(current.directory, targetB)); assert.deepEqual(state().current, before);
        report.identityReplacement = { originalId: binding.container.id, rejectedId: meta.Id, replacementDataMounts: 0 };
      } finally {
        if (replacement) resources.remove(replacement);
        docker(["rename", binding.container.id, restoreName]);
      }
      await rollback(); await assertTarget("restored change " + id);
    });
    await checked("source-env-release-bundles-and-business-egress-remain-protected", async () => {
      assert.ok(readFileSync(secrets).equals(Buffer.from(privateEnv)), "私有env发生变化");
      const after = inspect("container", sourcePg); assert.equal(after.Id, sourcePgBefore.Id); assert.equal(after.State.StartedAt, sourcePgBefore.State.StartedAt); assert.deepEqual(mountOrder(after.Mounts), report.sourceDatabase.mounts);
      for (const database of databases) assert.equal(sql(sourcePg, database, "SELECT value FROM recovery_validation_marker ORDER BY value;"), id + "\npost-backup");
      for (const selected of [previous, current]) { assert.equal(digestBytes(readFileSync(join(selected.directory, "release.json"))), selected.manifestSha256); for (const file of selected.release.files) assert.equal(digestBytes(readFileSync(join(selected.directory, file.path))), file.sha256); }
      assert.equal(sinkStats().count, sinkBaseline);
    });
    report.success = true; report.stage = "complete";
  } catch (error) { report.error = { name: error.name, message: redact(error.message), code: error.code ?? null }; }
  finally {
    for (const action of [() => rememberProject(targetProject, targetState), () => rememberProject(sourceProject, sourceState), rememberBackup, rememberClaim,
      () => { if (faultTag && resources.optional("image", faultTag)) resources.remember("image", faultTag, validationLabel, { tag: faultTag }); }]) {
      try { action(); } catch { discoveryErrors.push({ error: "FINAL_RESOURCE_DISCOVERY_FAILED" }); }
    }
    const errors = [...discoveryErrors, ...resources.cleanup()];
    for (const file of privateFiles) {
      try {
        const path = relative(directory, file); assert.ok(path && path !== ".." && !path.startsWith(".." + sep) && !isAbsolute(path));
        if (existsSync(file)) { assert.equal(lstatSync(file).isSymbolicLink(), false); assert.equal(lstatSync(file).isFile(), true); unlinkSync(file); }
      } catch { errors.push({ error: "PRIVATE_FILE_CLEANUP_FAILED" }); }
    }
    // Only public backup manifests/attempt receipts survive; encrypted payloads are disposable test data.
    if (existsSync(store)) for (const name of readdirSync(store)) {
      if (!/^(?:backup-|\.pending-|\.pruning-)[a-f0-9-]+$/.test(name)) continue;
      const folder = join(store, name);
      try { assert.equal(lstatSync(folder).isSymbolicLink(), false); if (lstatSync(folder).isDirectory()) for (const file of readdirSync(folder).filter((entry) => entry.endsWith(".enc"))) { const path = join(folder, file); assert.equal(lstatSync(path).isSymbolicLink(), false); unlinkSync(path); } }
      catch { errors.push({ error: "CIPHERTEXT_CLEANUP_FAILED" }); }
    }
    try { emptyNamespace(); } catch { errors.push({ error: "VALIDATION_NAMESPACE_NOT_EMPTY" }); }
    report.privateFilesCleared = [...privateFiles].every((file) => !existsSync(file));
    if (!report.privateFilesCleared) errors.push({ error: "PRIVATE_FILES_REMAIN" });
    report.cleanup = errors.length ? "failed" : "passed"; report.cleanupErrors = errors;
    report.resources = resources.records.map(({ kind, name, identity, labels, tag, reference }) => ({ kind, name, identity, labels, tag, reference }));
    if (errors.length) report.success = false;
    if (report.identity) {
      try { const after = captureValidationIdentity(root, process.env, id); report.sourceUnchanged = after.fingerprint === report.identity.fingerprint && after.checkoutSha === report.identity.checkoutSha; if (!report.sourceUnchanged) report.success = false; }
      catch { report.sourceUnchanged = false; report.success = false; }
    }
    report.finishedAt = new Date().toISOString(); write(join(directory, "summary.json"), report);
  }
  if (!report.success) throw new Error("恢复部署验收失败，见 " + join(directory, "summary.json"));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const options = parseRecoveryValidationArgs(process.argv.slice(2)); await validateRecoveryDeployment(options.previousDirectory, options.currentDirectory, options).then((report) => console.log(JSON.stringify({ id: report.id, success: report.success, cleanup: report.cleanup, evidence: join(root, ".qa/recovery-deployment", report.id, "summary.json") }))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
