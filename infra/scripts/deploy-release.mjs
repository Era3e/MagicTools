import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { runtimeCatalog } from "./lib/runtime-artifacts.mjs";
import { digestBytes, releaseFiles, renderReleaseCompose, validateDeploymentConfig, validateReleaseManifest } from "./lib/release-artifacts.mjs";
import { deploymentFailed, deploymentSucceeded, rollbackTarget, validateDeploymentState } from "./lib/deployment-state.mjs";
import { bindRecoveryConnections, resolvedRecoveryEnvironment } from "./lib/recovery-connections.mjs";
import { assertRecoveryProjectOwnership, claimRestoredDatabase, verifyRestoredDatabase } from "./lib/recovery-database.mjs";
import { reserveRecoveryAttachment, recordRecoveryClaim, confirmRecoveryInitialValidation } from "./lib/recovery-attachment.mjs";

const exec = promisify(execFile);
export function isPathInside(directory, file) {
  const path = relative(directory, file);
  return !path || (!isAbsolute(path) && path !== ".." && !path.startsWith(".." + sep));
}
function jsonFile(file, label) {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error(label + "读取或JSON解析失败"); }
}
function atomicJson(file, value) {
  const temporary = file + "." + randomBytes(8).toString("hex") + ".tmp";
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  renameSync(temporary, file);
}
async function docker(args, env, timeout = 120_000) {
  try {
    const result = await exec("docker", args, { env, windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 });
    return result.stdout.trim();
  } catch (error) {
    // Docker的配置错误可能包含env原文；公开回执只保留阶段和退出码。
    const code = typeof error.code === "number" ? error.code : /^[A-Z_]+$/.test(error.code ?? "") ? error.code : "failed";
    const missing = String(error.stderr ?? "").match(/\b([A-Z][A-Z0-9_]+) is required\b/);
    throw new Error("Docker " + args[0] + "执行失败（" + code + "）" + (missing ? "：缺少 " + missing[1] : ""));
  }
}

async function assertOwnership({ composeArgs, env, owner }) {
  const ids = (await docker([...composeArgs, "ps", "--all", "--quiet"], env)).split(/\r?\n/).filter(Boolean);
  for (const id of ids) {
    const labels = JSON.parse(await docker(["inspect", id, "--format", '{{json (index .Config "Labels")}}'], env));
    if (labels?.["magictools.deployment"] !== owner) throw new Error("现有容器不属于此部署目录，请使用独立项目或先完成已有部署迁移");
  }
}

export async function executeCompose(context) {
  if (context.command[0] === "config") await assertOwnership(context);
  await docker([...context.composeArgs, ...context.command], context.env, (context.config.waitTimeoutSeconds + 300) * 1000);
}

export async function resolveCompose({ composeArgs, env }) {
  const value = await docker([...composeArgs, "config", "--format", "json"], env);
  try { return JSON.parse(value); } catch { throw new Error("恢复部署的私有连接配置无法解析"); }
}

export async function verifyDeployment({ composeArgs, env, owner, release, catalog, config }) {
  const ids = (await docker([...composeArgs, "ps", "--all", "--quiet"], env)).split(/\r?\n/).filter(Boolean);
  const services = [...catalog.map((item) => item.service), ...(config?.schema === "magictools-deployment-config/2" ? [] : ["postgres"])];
  if (ids.length !== services.length) throw new Error("部署容器数与制品清单不一致");
  const ready = [];
  for (const service of services) {
    const id = await docker([...composeArgs, "ps", "--quiet", service], env);
    if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error("部署服务未运行：" + service);
    const state = JSON.parse(await docker(["inspect", id, "--format", '{"image":{{json .Image}},"reference":{{json .Config.Image}},"health":{{json (index .State "Health")}},"labels":{{json (index .Config "Labels")}}}'], env));
    if (state.health?.Status !== "healthy" || state.labels?.["magictools.deployment"] !== owner) throw new Error("部署服务未就绪或所有权不符：" + service);
    if (service === "postgres") continue;
    const expected = release.images.find((item) => item.service === service);
    if (state.reference !== expected.reference) throw new Error("实际部署未固定预期digest：" + service);
    const image = JSON.parse(await docker(["image", "inspect", expected.reference, "--format", '{"id":{{json .Id}},"labels":{{json (index .Config "Labels")}},"os":{{json .Os}},"architecture":{{json .Architecture}}}'], env));
    // 跨Docker存储实现，本地ID可能指向manifest或config；与本机pull的身份核对。
    if (state.image !== image.id || image.labels?.["org.opencontainers.image.revision"] !== release.revision || image.os + "/" + image.architecture !== release.platform) throw new Error("实际部署镜像身份不符：" + service);
    ready.push({ service, reference: expected.reference, localImageId: image.id, platform: release.platform, healthy: true });
  }
  return ready;
}

export async function deployRelease(options, dependencies = {}) {
  if (!options.stateDirectory) throw new Error("必须指定部署状态目录");
  mkdirSync(resolve(options.stateDirectory), { recursive: true });
  const stateDirectory = realpathSync(resolve(options.stateDirectory));
  let secretsFile = options.secretsFile ? resolve(options.secretsFile) : null;
  const attemptId = randomBytes(8).toString("hex");
  const attemptDirectory = join(stateDirectory, "attempts", attemptId); mkdirSync(attemptDirectory, { recursive: true });
  const stateFile = join(stateDirectory, "state.json");
  const lock = join(stateDirectory, "deploy.lock");
  const lockOwnerFile = join(lock, "owner.json");
  const owner = digestBytes(stateDirectory);
  const receipt = { schema: "magictools-deployment-receipt/1", attemptId, success: false, action: options.rollback ? "rollback" : "deploy", startedAt: new Date().toISOString(), stage: "preflight", ready: [] };
  let previousState = null; let stateLoaded = false; let locked = false; let receiptWritten = false; let secretBefore; let config;
  const ownsLock = () => {
    try { return locked && jsonFile(lockOwnerFile, "部署锁").attemptId === attemptId; } catch { return false; }
  };
  const secretsPreserved = () => { try { return readFileSync(secretsFile).equals(secretBefore); } catch { return false; } };
  try {
    if (!secretsFile) throw new Error("必须指定独立秘密文件");
    secretsFile = realpathSync(secretsFile);
    if (isPathInside(stateDirectory, secretsFile)) throw new Error("秘密文件必须位于部署状态目录之外，避免与输出冲突");
    try { mkdirSync(lock); locked = true; }
    catch { throw new Error("部署锁已存在，另一部署可能正在运行"); }
    atomicJson(lockOwnerFile, { attemptId, pid: process.pid, startedAt: receipt.startedAt });
    if (existsSync(stateFile)) previousState = validateDeploymentState(jsonFile(stateFile, "部署状态"));
    stateLoaded = true;
    secretBefore = readFileSync(secretsFile);
    let releaseDirectory; let configFile; let target;
    if (options.rollback) {
      if (options.releaseDirectory || options.configFile) throw new Error("回退使用成功记录中的制品和公开配置，不能混入新参数");
      target = rollbackTarget(previousState);
      releaseDirectory = join(stateDirectory, "attempts", target.attemptId, "bundle");
      configFile = join(stateDirectory, "attempts", target.attemptId, "config.json");
    } else {
      if (!options.releaseDirectory || !options.configFile) throw new Error("部署必须指定制品目录和公开配置");
      releaseDirectory = resolve(options.releaseDirectory); configFile = resolve(options.configFile);
    }
    const manifestBytes = readFileSync(join(releaseDirectory, "release.json"));
    let release;
    try { release = JSON.parse(manifestBytes.toString("utf8")); } catch { throw new Error("发布清单JSON无效"); }
    const catalog = runtimeCatalog(jsonFile(join(releaseDirectory, "ports.json"), "端口配置"));
    validateReleaseManifest(release, catalog, { allowValidation: options.allowValidation === true });
    const validated = validateDeploymentConfig(jsonFile(configFile, "公开部署配置")); config = validated.config;
    const usingRestoredDatabase = config.schema === "magictools-deployment-config/2";
    const recoveryStateFile = join(stateDirectory, "recovery-binding.json");
    if (!usingRestoredDatabase && existsSync(recoveryStateFile)) throw new Error("部署目录已绑定恢复数据库，不能切换回自建数据库");
    if (options.allowValidation && (config.gatewayBind !== "127.0.0.1" || !config.project.startsWith("mt-validation-"))) throw new Error("工作树验证制品只能部署到独立本机验证项目");
    if (previousState?.project && previousState.project !== config.project) throw new Error("部署状态目录已绑定其他项目");
    const manifestSha256 = digestBytes(manifestBytes);
    if (target && (target.manifestSha256 !== manifestSha256 || target.configVersion !== validated.configVersion)) throw new Error("回退快照校验不符");
    const contents = {};
    for (const file of release.files) {
      const bytes = readFileSync(join(releaseDirectory, file.path));
      if (digestBytes(bytes) !== file.sha256) throw new Error("制品文件校验不符：" + file.path);
      contents[file.path] = bytes;
    }
    const rendered = renderReleaseCompose(JSON.parse(contents["compose.json"].toString("utf8")), release, catalog, config);
    for (const service of Object.values(rendered.services)) service.labels = { ...service.labels, "magictools.deployment": owner };
    if (usingRestoredDatabase) {
      rendered.networks.default.labels = { "magictools.deployment": owner };
      rendered.networks.ingress.labels = { ...rendered.networks.ingress.labels, "magictools.deployment": owner };
    }
    else {
      const bootstrapHash = digestBytes(contents["postgres-init.sql"]);
      const bootstrapDirectory = join(stateDirectory, "bootstrap", bootstrapHash); mkdirSync(bootstrapDirectory, { recursive: true });
      const bootstrapFile = join(bootstrapDirectory, "postgres-init.sql");
      if (!existsSync(bootstrapFile)) writeFileSync(bootstrapFile, contents["postgres-init.sql"], { flag: "wx" });
      if (digestBytes(readFileSync(bootstrapFile)) !== bootstrapHash) throw new Error("初始化脚本缓存校验失败");
      const initialMount = "./postgres-init.sql:/docker-entrypoint-initdb.d/init.sql:ro";
      if (!rendered.services.postgres.volumes?.includes(initialMount)) throw new Error("数据库初始化挂载与制品契约不符");
      rendered.services.postgres.volumes = rendered.services.postgres.volumes.map((volume) => volume === initialMount
        ? { type: "bind", source: bootstrapFile, target: "/docker-entrypoint-initdb.d/init.sql", read_only: true } : volume);
    }
    const bundleDirectory = join(attemptDirectory, "bundle"); mkdirSync(bundleDirectory);
    for (const name of releaseFiles) writeFileSync(join(bundleDirectory, name), contents[name]);
    writeFileSync(join(bundleDirectory, "release.json"), manifestBytes);
    writeFileSync(join(attemptDirectory, "config.json"), JSON.stringify(config, null, 2) + "\n");
    writeFileSync(join(attemptDirectory, "compose.json"), JSON.stringify(rendered, null, 2) + "\n");
    Object.assign(receipt, { project: config.project, releaseId: release.releaseId, revision: release.revision, mode: release.mode,
      manifestSha256, configVersion: validated.configVersion, previousSuccessfulRelease: previousState?.current?.releaseId ?? null });
    const env = { ...process.env };
    // 显式env文件决定插值，防止本机同名变量覆盖它。文件内容不复制进制品或回执。
    for (const match of JSON.stringify(rendered).matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)/g)) delete env[match[1]];
    const composeArgs = ["compose", "--project-name", config.project, "--env-file", secretsFile, "-f", join(attemptDirectory, "compose.json")];
    const context = { composeArgs, env, owner, release, catalog, config };
    let attachmentInput;
    if (usingRestoredDatabase) {
      receipt.stage = "recovery-connections";
      const secretCompose = await (dependencies.resolveCompose ?? resolveCompose)(context);
      const connections = bindRecoveryConnections(rendered, catalog, resolvedRecoveryEnvironment(secretCompose, catalog), config.database);
      Object.assign(env, connections.environment); receipt.databaseConnections = connections.connections;
      receipt.stage = "recovery-ownership";
      attachmentInput = { stateDirectory, attemptId, owner, project: config.project, binding: config.database, previousState };
      // 已有记录先核对绑定，避免用同一state-dir切换数据库。
      let attachment = existsSync(recoveryStateFile) ? reserveRecoveryAttachment(attachmentInput) : null;
      const resources = await assertRecoveryProjectOwnership(config.project, owner, dependencies.recoveryIo, { restoredBinding: config.database });
      attachment ??= reserveRecoveryAttachment({ ...attachmentInput, resources });
      const claim = await claimRestoredDatabase(config.database, { owner, project: config.project }, dependencies.recoveryIo);
      recordRecoveryClaim(attachmentInput, claim); receipt.databaseClaim = claim;
      receipt.stage = "recovery-initial-validation";
      const first = attachment.phase !== "initial-verified";
      const database = await verifyRestoredDatabase(config.database, { owner, project: config.project, initial: first }, dependencies.recoveryIo);
      if (first) attachment = confirmRecoveryInitialValidation(attachmentInput, database, claim);
      receipt.database = database;
      receipt.databaseInitialVerification = { verifiedAt: attachment.initialVerifiedAt, catalogSha256: config.database.catalogSha256 };
    }
    const execute = dependencies.executeCompose ?? executeCompose;
    for (const command of [["config", "--quiet"], ["pull"], ["up", "-d", "--wait", "--wait-timeout", String(config.waitTimeoutSeconds), "--pull", "never"]]) {
      receipt.stage = command[0];
      console.log("Deployment:", attemptId, receipt.stage);
      await execute({ ...context, command });
    }
    receipt.stage = "verify";
    receipt.ready = await (dependencies.verifyDeployment ?? verifyDeployment)(context);
    if (receipt.ready.length !== catalog.length || release.images.some((image) => !receipt.ready.some((item) => item.service === image.service && item.reference === image.reference && item.healthy === true))) throw new Error("部署就绪证据不完整");
    if (usingRestoredDatabase) {
      receipt.stage = "recovery-final-validation";
      await assertRecoveryProjectOwnership(config.project, owner, dependencies.recoveryIo, { restoredBinding: config.database });
      receipt.database = await verifyRestoredDatabase(config.database, { owner, project: config.project, initial: false }, dependencies.recoveryIo);
      const claim = await claimRestoredDatabase(config.database, { owner, project: config.project }, dependencies.recoveryIo);
      const recorded = recordRecoveryClaim(attachmentInput, claim);
      if (recorded.phase !== "initial-verified") throw new Error("恢复数据库首次验证记录丢失，不能记录成功");
    }
    if (!secretsPreserved()) throw new Error("部署期间秘密文件发生变化，未记录成功");
    if (!ownsLock()) throw new Error("部署锁所有权发生变化");
    const pointer = { attemptId, releaseId: release.releaseId, manifestSha256, configVersion: validated.configVersion };
    receipt.stage = "record-receipt";
    const successfulReceipt = { ...receipt, success: true, stage: "succeeded", secretsPreserved: true, finishedAt: new Date().toISOString() };
    // 成功状态只能指向已经原子落盘的成功回执；两次写入全程持锁。
    atomicJson(join(attemptDirectory, "receipt.json"), successfulReceipt);
    receiptWritten = true;
    receipt.stage = "record-state";
    atomicJson(stateFile, { ...deploymentSucceeded(previousState, pointer), project: config.project });
    Object.assign(receipt, successfulReceipt);
  } catch (error) {
    receipt.success = false; receiptWritten = false; receipt.error = String(error);
    if (stateLoaded && ownsLock()) atomicJson(stateFile, { ...deploymentFailed(previousState, attemptId), ...(previousState?.project ? { project: previousState.project } : {}) });
    throw error;
  } finally {
    if (!receiptWritten) receipt.secretsPreserved = secretBefore ? secretsPreserved() : null;
    receipt.finishedAt ??= new Date().toISOString();
    try { if (!receiptWritten) atomicJson(join(attemptDirectory, "receipt.json"), receipt); }
    finally { if (ownsLock()) { unlinkSync(lockOwnerFile); rmdirSync(lock); } }
    console.log("Deployment receipt:", join(attemptDirectory, "receipt.json"));
    console.log("Deployment attempt:", attemptId);
  }
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2); const options = {};
    const names = { "--release": "releaseDirectory", "--config": "configFile", "--secrets": "secretsFile", "--state-dir": "stateDirectory" };
    while (args.length) {
      const arg = args.shift();
      if (arg === "--rollback") options.rollback = true;
      else if (arg === "--validation") options.allowValidation = true;
      else if (names[arg] && args[0] && !args[0].startsWith("--")) options[names[arg]] = args.shift();
      else throw new Error("用法：deploy-release --release <制品目录> --config <公开配置> --secrets <已有env> --state-dir <状态目录>，回退时以--rollback替代release/config");
    }
    await deployRelease(options);
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
