import test from "node:test";
import assert from "node:assert/strict";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "yaml";
import { recoveryDatabaseFixture } from "./recovery-database-fixture.mjs";
import { digestBytes, validateDeploymentConfig } from "./release-artifacts.mjs";
import { runtimeCatalog } from "./runtime-artifacts.mjs";
import { recoveryConnectionFields } from "./recovery-connections.mjs";
import { deployRelease } from "../deploy-release.mjs";
import { deployRemote } from "../deploy-ssh.mjs";

function fixture(t) {
  const directory = mkdtempSync(join(realpathSync(tmpdir()), "mt-recovery-deploy-"));
  t.after(() => { assert.ok(resolve(directory).startsWith(realpathSync(tmpdir()) + sep + "mt-recovery-deploy-")); assert.equal(lstatSync(directory).isSymbolicLink(), false); rmSync(directory, { recursive: true }); });
  const world = recoveryDatabaseFixture(); const releaseDirectory = join(directory, "release"); mkdirSync(releaseDirectory);
  const ports = parse(readFileSync(new URL("../../ports.yaml", import.meta.url), "utf8")); const catalog = runtimeCatalog(ports);
  const compose = parse(readFileSync(new URL("../../compose.prod.yml", import.meta.url), "utf8"));
  const files = { "ports.json": JSON.stringify(ports), "compose.json": JSON.stringify(compose), "postgres-init.sql": "SELECT 1;\n" };
  for (const [name, value] of Object.entries(files)) writeFileSync(join(releaseDirectory, name), value);
  const revision = "a".repeat(40); const release = { schema: "magictools-release/1", success: true, mode: "release", releaseId: revision + "-1234567890abcdef", revision, platform: "linux/amd64",
    source: { clean: true, checkoutSha: revision, fingerprint: "b".repeat(64) }, files: Object.entries(files).map(([path, value]) => ({ path, sha256: digestBytes(value) })),
    images: catalog.map((item) => ({ service: item.service, repository: "localhost:55101/test/" + item.service, reference: "localhost:55101/test/" + item.service + "@sha256:" + "d".repeat(64),
      registryDigest: "sha256:" + "d".repeat(64), localImageId: "sha256:" + "e".repeat(64), revision, platform: "linux/amd64", healthcheck: true })) };
  writeFileSync(join(releaseDirectory, "release.json"), JSON.stringify(release));
  const configFile = join(directory, "config.json"); writeFileSync(configFile, JSON.stringify({ schema: "magictools-deployment-config/2", project: "mt-recovery-apps", gatewayBind: "127.0.0.1", gatewayPort: 55301, waitTimeoutSeconds: 120, database: world.binding }));
  const secretsFile = join(directory, "private.env"); const urls = Object.fromEntries(world.binding.databases.map((database) => [database.toUpperCase() + "_DATABASE_URL", "postgres://postgres:private-connection-secret@postgres:5432/" + database]));
  writeFileSync(secretsFile, Object.entries(urls).map(([key, value]) => key + "=" + value).join("\n") + "\nGATEWAY_TOKEN=private-gateway-secret\n");
  const resolved = structuredClone(compose);
  for (const field of recoveryConnectionFields(catalog)) resolved.services[field.service].environment[field.field] = urls[field.variable];
  const commands = [];
  const dependencies = { recoveryIo: world.deps, resolveCompose: async () => resolved,
    executeCompose: async (context) => {
      commands.push(context.command[0]);
      for (const database of world.binding.databases) assert.equal(new URL(context.env[database.toUpperCase() + "_DATABASE_URL"]).hostname, world.binding.container.name);
    }, verifyDeployment: async ({ release: selected }) => selected.images.map((item) => ({ service: item.service, reference: item.reference, healthy: true, platform: item.platform, localImageId: item.localImageId })) };
  return { options: { stateDirectory: join(directory, "state"), secretsFile, releaseDirectory, configFile }, world, dependencies, commands, files, release };
}

function remoteDeployment(context, receipt, rollback = false) {
  const options = rollback ? { rollback: true } : context.options;
  return deployRemote({ ...options, host: "restore-test", remoteDirectory: "/opt/deployer", stateDirectory: "/var/lib/deployment", secretsFile: "/private/config.env" }, {
    outputDirectory: join(dirname(context.options.stateDirectory), "remote-evidence"), executeTransport: async (command, args) => {
      if (command === "scp" && args.at(-1).endsWith("remote-receipt.json")) writeFileSync(args.at(-1), JSON.stringify(receipt));
      else if (command === "scp" && args.at(-2).startsWith("restore-test:/var/lib/deployment/attempts/")) {
        const suffix = args.at(-2).split("/" + receipt.attemptId + "/")[1];
        writeFileSync(args.at(-1), readFileSync(join(context.options.stateDirectory, "attempts", receipt.attemptId, suffix)));
      }
      return { exitCode: 0, stdout: command === "ssh" && args.at(-1).includes("node ") ? "Deployment attempt: " + receipt.attemptId + "\n" : "" };
    },
  });
}
const readState = (context, file = "state.json") => JSON.parse(readFileSync(join(context.options.stateDirectory, file), "utf8"));

// 真文件/状态机；Docker、PG与Compose为I/O替身，实际容器部署另行验证。
test("部署已恢复数据库只启动17应用，绑定12连接并保存验证阶段和不可变制品", async (t) => {
  const context = fixture(t); const before = readFileSync(context.options.secretsFile);
  const result = await deployRelease(context.options, context.dependencies);
  assert.equal(result.success, true); assert.equal(result.ready.length, 17); assert.equal(result.database.restoreOperationId, context.world.binding.restoreOperationId);
  assert.equal(result.databaseConnections.length, 12); assert.equal(result.database.internalNetwork, true);
  assert.deepEqual(context.commands, ["config", "pull", "up"]);
  assert.ok(readFileSync(context.options.secretsFile).equals(before));
  for (const [name, value] of Object.entries(context.files)) assert.equal(readFileSync(join(context.options.releaseDirectory, name), "utf8"), value);
  const attempt = join(context.options.stateDirectory, "attempts", result.attemptId);
  const rendered = JSON.parse(readFileSync(join(attempt, "compose.json"), "utf8"));
  assert.equal(rendered.services.postgres, undefined); assert.equal(rendered.networks.default.internal, true);
  const stored = JSON.parse(readFileSync(join(context.options.stateDirectory, "recovery-binding.json"), "utf8"));
  assert.equal(stored.phase, "initial-verified"); assert.equal(stored.claim.id, result.databaseClaim.id);
  for (const value of [JSON.stringify(result), readFileSync(join(attempt, "compose.json"), "utf8"), readFileSync(join(attempt, "config.json"), "utf8")]) {
    assert.ok(!value.includes("private-connection-secret") && !value.includes("private-gateway-secret"));
  }
});

test("SSH恢复部署必须核对实际数据库回执，17个镜像就绪不足以确认恢复成功", async (t) => {
  const context = fixture(t); const actual = await deployRelease(context.options, context.dependencies);
  const remote = (receipt) => remoteDeployment(context, receipt);
  const result = await remote(actual); assert.equal(result.success, true);
  assert.deepEqual(result.databaseConnections, actual.databaseConnections); assert.equal(result.databaseClaim.id, actual.databaseClaim.id);
  for (const change of [
    (receipt) => { delete receipt.database; },
    (receipt) => { receipt.database.container.id = "9".repeat(64); },
    (receipt) => { receipt.databaseClaim.bindingHash = "0".repeat(64); },
    (receipt) => { receipt.databaseInitialVerification.catalogSha256 = "0".repeat(64); },
    (receipt) => { receipt.databaseConnections.pop(); },
    (receipt) => { receipt.databaseConnections[0].host = "old-source"; },
    (receipt) => { receipt.database.network.id = "0".repeat(64); },
    (receipt) => { receipt.database.volume.createdAt = "2000-01-01T00:00:00Z"; },
    (receipt) => { receipt.database.databases[1] = receipt.database.databases[0]; },
    (receipt) => { receipt.database.systemIdentifier = "987654321"; },
    (receipt) => { receipt.database.running = false; },
    (receipt) => { receipt.database.internalNetwork = false; },
    (receipt) => { receipt.databaseClaim.owner = null; },
    (receipt) => { receipt.databaseClaim.project = "another-project"; },
    (receipt) => { receipt.databaseInitialVerification.verifiedAt = "invalid"; },
    (receipt) => { receipt.databaseInitialVerification.verifiedAt = "0"; },
    (receipt) => { receipt.databaseInitialVerification.verifiedAt = "2000-01-01T00:00:00Z"; },
    (receipt) => { receipt.databaseInitialVerification.verifiedAt = "2999-01-01T00:00:00Z"; },
    (receipt) => { receipt.databaseConnections[1] = receipt.databaseConnections[0]; },
    (receipt) => { receipt.databaseConnections[0].port = 5433; },
    (receipt) => { receipt.databaseConnections[0].url = "postgres://private@source/db"; },
  ]) { const invalid = structuredClone(actual); change(invalid); await assert.rejects(remote(invalid), /恢复.*回执|恢复.*连接/); }
  const migrated = structuredClone(actual); migrated.database.catalogSha256 = "9".repeat(64); migrated.database.privateExtra = "secret-extra";
  const afterMigration = await remote(migrated); assert.equal(afterMigration.success, true); assert.equal(afterMigration.database.catalogSha256, "9".repeat(64));
  assert.equal(JSON.stringify(afterMigration).includes("secret-extra"), false);
});

for (const variant of ["missing-db", "service-dns", "container-dns"]) test("SSH配置与回执一起伪造" + variant + "也必须符合应用契约", async (t) => {
  const context = fixture(t); const receipt = await deployRelease(context.options, context.dependencies);
  const config = JSON.parse(readFileSync(context.options.configFile, "utf8"));
  if (variant === "missing-db") config.database.databases = ["manager"];
  else {
    const name = variant === "service-dns" ? "manager-server" : config.project + "-manager-server-1";
    config.database.container.name = name; config.database.network.name = name + "-net"; config.database.volume.name = name + "-data";
    receipt.databaseConnections.forEach((item) => { item.host = name; });
  }
  const validated = validateDeploymentConfig(config); const bindingHash = digestBytes(JSON.stringify(validated.config.database));
  receipt.configVersion = validated.configVersion; receipt.databaseClaim.bindingHash = bindingHash;
  Object.assign(receipt.database, { bindingHash, container: config.database.container, network: config.database.network, volume: config.database.volume, databases: config.database.databases });
  writeFileSync(context.options.configFile, JSON.stringify(config));
  await assert.rejects(remoteDeployment(context, receipt), /恢复.*回执/);
});

test("SSH恢复回退从成功快照核对绑定，错误数据库回执仍拒绝", async (t) => {
  const context = fixture(t); await deployRelease(context.options, context.dependencies);
  await assert.rejects(deployRelease(context.options, { ...context.dependencies, executeCompose: async () => { throw new Error("injected pull failure"); } }));
  const rollback = await deployRelease({ stateDirectory: context.options.stateDirectory, secretsFile: context.options.secretsFile, rollback: true }, context.dependencies);
  assert.equal((await remoteDeployment(context, rollback, true)).success, true);
  const wrong = structuredClone(rollback); wrong.database.backupId = "0".repeat(16);
  await assert.rejects(remoteDeployment(context, wrong, true), /恢复.*回执/);
});

for (const stage of ["config", "pull", "up", "verify"]) test("恢复部署在" + stage + "失败保持成功指针，并能用固定快照恢复", async (t) => {
  const context = fixture(t); const good = await deployRelease(context.options, context.dependencies);
  const before = readState(context); const original = readFileSync(context.options.secretsFile);
  await assert.rejects(deployRelease(context.options, { ...context.dependencies,
    executeCompose: async (input) => { if (input.command[0] === stage) throw new Error("injected " + stage); return context.dependencies.executeCompose(input); },
    verifyDeployment: async (input) => { if (stage === "verify") throw new Error("injected verify"); return context.dependencies.verifyDeployment(input); },
  }), /injected/);
  assert.deepEqual(readState(context).current, before.current); assert.equal(readState(context).lastAttempt.status, "failed");
  const restored = await deployRelease({ stateDirectory: context.options.stateDirectory, secretsFile: context.options.secretsFile, rollback: true }, context.dependencies);
  assert.equal(restored.success, true); assert.equal(restored.releaseId, good.releaseId); assert.deepEqual(restored.database.container, good.database.container);
  assert.ok(readFileSync(context.options.secretsFile).equals(original));
});

test("首次检查中断后的既有claim不能跳过备份目录匹配，修复后可重试", async (t) => {
  const context = fixture(t); const query = context.world.deps.databaseQuery;
  context.world.deps.databaseQuery = async () => { throw new Error("interrupted query"); };
  await assert.rejects(deployRelease(context.options, context.dependencies), /身份查询/);
  assert.equal(readState(context, "recovery-binding.json").phase, "reserved"); assert.equal(context.commands.length, 0);
  context.world.deps.databaseQuery = query; context.world.global.roles.push({ rolname: "unexpected", rolsuper: false });
  await assert.rejects(deployRelease(context.options, context.dependencies), /首次.*目录哈希/);
  assert.equal(readState(context).current, null); assert.equal(context.commands.length, 0);
  context.world.global.roles.pop(); const recovered = await deployRelease(context.options, context.dependencies);
  assert.equal(recovered.success, true); assert.equal(recovered.databaseClaim.reused, true);
  assert.equal(readState(context, "recovery-binding.json").phase, "initial-verified");
});

for (const variant of ["binding", "v1", "claim"]) test("既有恢复部署拒绝切换" + variant + "并保持成功状态", async (t) => {
  const context = fixture(t); await deployRelease(context.options, context.dependencies); const before = readState(context); context.commands.length = 0;
  if (variant === "claim") context.world.resources.container.get("mt-recovery-" + context.world.binding.restoreOperationId + "-claim").Id = "9".repeat(64);
  else {
    const config = JSON.parse(readFileSync(context.options.configFile, "utf8"));
    if (variant === "binding") config.database.container.id = "9".repeat(64);
    else { config.schema = "magictools-deployment-config/1"; delete config.database; }
    writeFileSync(context.options.configFile, JSON.stringify(config));
  }
  await assert.rejects(deployRelease(context.options, context.dependencies), /恢复|归属/);
  assert.equal(context.commands.length, 0); assert.deepEqual(readState(context).current, before.current);
});

for (const variant of ["container", "claim"]) test("17应用就绪后" + variant + "身份变化不能写成功回执", async (t) => {
  const context = fixture(t); const good = await deployRelease(context.options, context.dependencies); const before = readState(context);
  await assert.rejects(deployRelease(context.options, { ...context.dependencies, verifyDeployment: async (input) => {
    const ready = await context.dependencies.verifyDeployment(input);
    const name = variant === "container" ? context.world.binding.container.name : good.databaseClaim.name;
    context.world.resources.container.get(name).Id = "9".repeat(64); return ready;
  } }), /身份|不符/);
  assert.deepEqual(readState(context).current, before.current); assert.equal(readState(context).lastAttempt.status, "failed");
});
