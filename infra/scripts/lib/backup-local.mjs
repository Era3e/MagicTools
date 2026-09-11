import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { hostname } from "node:os";
import { inspectBackupSource } from "./backup-source.mjs";
import { BackupResources, databaseQuery, docker, dockerStream, runDocker, waitForDatabase } from "./backup-docker.mjs";
import { decryptBackupStream, encryptBackupStream, MAX_BACKUP_FILE_BYTES, signBackupManifest, verifyBackupManifest } from "./backup-crypto.mjs";
import { isImageRepository } from "./runtime-artifacts.mjs";

const BACKUP_FILES = ["base.tar", "pg_wal.tar", "backup_manifest"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const parseJson = (file, label) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { throw new Error(label + "无法读取或JSON无效"); } };
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
const within = (parent, file) => { const path = relative(parent, file); return !path || (!path.startsWith(".." + sep) && path !== ".." && !isAbsolute(path)); };

function canonicalDirectory(directory) {
  let current = resolve(directory); const suffix = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) throw new Error("备份目录无法规范化");
    suffix.unshift(basename(current)); current = parent;
  }
  return resolve(realpathSync(current), ...suffix);
}

function privateFile(file, directory, sizeLimit) {
  const path = realpathSync(file);
  if (within(directory, resolve(file)) || within(directory, path) || !statSync(path).isFile() || statSync(path).size > sizeLimit) throw new Error("私有文件必须独立于备份目录且大小有效");
  return { path, bytes: readFileSync(path) };
}

function acquireStore(directory, expected, operationId, create = false) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const root = realpathSync(directory); const marker = join(root, ".magictools-backups.json");
  if (!existsSync(marker)) {
    if (!create || readdirSync(root).length) throw new Error("备份目录不是本工具初始化的空目录");
    writeJson(marker, { schema: "magictools-backup-store/1", storeId: randomBytes(8).toString("hex"), ...expected });
  }
  if (lstatSync(marker).isSymbolicLink()) throw new Error("备份目录标识不能为链接");
  const store = parseJson(marker, "备份目录标识");
  if (store.schema !== "magictools-backup-store/1" || !/^[a-f0-9]{16}$/.test(store.storeId) ||
    Object.entries(expected).some(([key, value]) => store[key] !== value)) throw new Error("备份目录来源或密钥与本次操作不一致");
  const lock = join(root, ".lock");
  try { mkdirSync(lock); } catch { throw new Error("备份目录正被使用或锁状态待确认"); }
  try { writeJson(join(lock, "owner.json"), { operationId, pid: process.pid, host: hostname(), startedAt: new Date().toISOString() }); }
  catch (error) { try { rmdirSync(lock); } catch {} throw error; }
  return { root, store, release() {
    if (parseJson(join(lock, "owner.json"), "备份锁").operationId !== operationId) throw new Error("备份锁归属变化");
    unlinkSync(join(lock, "owner.json")); rmdirSync(lock);
  } };
}

function validateBackup(manifest) {
  if (manifest.schema !== "magictools-backup/1" || manifest.status !== "complete" || !/^[a-f0-9]{16}$/.test(manifest.backupId) || !/^[a-f0-9]{16}$/.test(manifest.storeId)) throw new Error("备份未完成或身份无效");
  const source = manifest.source;
  if (!source || !/^[1-9][0-9]{0,19}$/.test(source.systemIdentifier) || Math.floor(source.serverVersion / 10_000) !== 16 ||
    !/^linux\/(amd64|arm64)$/.test(source.image?.platform) || !/@sha256:[a-f0-9]{64}$/.test(source.image.reference) || !isImageRepository(source.image.reference.split("@")[0]) ||
    typeof source.dataDirectory !== "string" || !source.dataDirectory.startsWith("/") || posix.normalize(source.dataDirectory) === "/") throw new Error("备份源身份、平台或布局无效");
  if (!Array.isArray(manifest.files) || manifest.files.length !== 3 || JSON.stringify(manifest.files.map((file) => file.fileName).sort()) !== JSON.stringify([...BACKUP_FILES].sort()) ||
    new Set(manifest.files.map((file) => file.nonce)).size !== 3 || manifest.files.some((file) => !Number.isSafeInteger(file.plainBytes) || file.plainBytes < 1 || file.plainBytes > MAX_BACKUP_FILE_BYTES ||
      file.encryptedBytes !== file.plainBytes || !/^[a-f0-9]{64}$/.test(file.sha256) || !/^[a-f0-9]{24}$/.test(file.nonce) || !/^[a-f0-9]{32}$/.test(file.tag))) throw new Error("备份文件集合或密文元数据无效");
  if (!Array.isArray(manifest.databases) || !manifest.databases.length || manifest.databases.some((name) => !/^[a-z][a-z0-9_]{0,62}$/.test(name)) ||
    !/^[a-f0-9]{64}$/.test(manifest.catalogSha256) || !Array.isArray(manifest.walRanges) || !manifest.walRanges.length) throw new Error("备份数据库或恢复证据不完整");
  return manifest;
}

async function pullImage(source) {
  const args = ["image", "inspect", "--format", '{"os":{{json .Os}},"architecture":{{json .Architecture}}}', source.image.reference];
  const cached = await runDocker(args);
  let actual;
  try { if (cached.exitCode === 0) actual = JSON.parse(cached.stdout); } catch { /* 不能确认缓存身份时重新按固定digest拉取 */ }
  if (actual?.os + "/" + actual?.architecture !== source.image.platform) {
    await docker(["pull", "--platform", source.image.platform, source.image.reference], { timeout: 15 * 60_000 });
    actual = JSON.parse(await docker(args));
  }
  if (actual.os + "/" + actual.architecture !== source.image.platform) throw new Error("备份恢复镜像平台不符");
}

async function toolContainer(resources, source, network = "none", dataName) {
  const prefix = "mt-backup-" + resources.operationId;
  const archiveVolume = prefix + "-archive"; const volume = dataName ?? prefix + "-data"; const worker = prefix + "-worker";
  const scratch = "/mt-backup-" + resources.operationId;
  if (source.dataDirectory === scratch || source.dataDirectory.startsWith(scratch + "/") || scratch.startsWith(source.dataDirectory.replace(/\/$/, "") + "/")) throw new Error("备份工作目录与PGDATA冲突");
  for (const name of [archiveVolume, volume]) await resources.create("volume", name, ["volume", "create", "--label", resources.label, name]);
  await resources.create("container", worker, ["run", "-d", "--name", worker, "--label", resources.label, "--network", network,
    "--mount", "type=volume,source=" + archiveVolume + ",target=" + scratch,
    "--mount", "type=volume,source=" + volume + ",target=" + source.dataDirectory,
    "--tmpfs", scratch + "/secrets:rw,noexec,nosuid,size=65536", "--entrypoint", "sleep", "--platform", source.image.platform, source.image.reference, "infinity"]);
  await docker(["exec", worker, "chown", "postgres:postgres", scratch, source.dataDirectory]);
  await docker(["exec", worker, "chmod", "700", scratch, source.dataDirectory]);
  return { worker, archiveVolume, volume, scratch, archive: scratch + "/archive" };
}

async function unpackAndVerify(tool, source) {
  const run = (args) => docker(["exec", "--user", "postgres", tool.worker, ...args], { timeout: 15 * 60_000 });
  await run(["tar", "-xf", tool.archive + "/base.tar", "-C", source.dataDirectory]);
  await run(["tar", "-xf", tool.archive + "/pg_wal.tar", "-C", posix.join(source.dataDirectory, "pg_wal")]);
  await run(["cp", tool.archive + "/backup_manifest", posix.join(source.dataDirectory, "backup_manifest")]);
  await run(["pg_verifybackup", source.dataDirectory]);
}

async function startDatabase(resources, source, volume, name, network) {
  await resources.create("container", name, ["run", "-d", "--name", name, "--label", resources.label, "--network", network,
    "--mount", "type=volume,source=" + volume + ",target=" + source.dataDirectory, "-e", "PGDATA=" + source.dataDirectory,
    "--platform", source.image.platform, source.image.reference, "postgres", "-c", "config_file=" + source.configFile]);
  await waitForDatabase(name);
  if (await databaseQuery(name, "postgres", "SELECT system_identifier::text FROM pg_control_system();") !== source.systemIdentifier) throw new Error("恢复数据库系统标识不符");
}

async function databaseCatalog(container, databases) {
  const global = JSON.parse(await databaseQuery(container, "postgres", `SELECT json_build_object(
    'databases',(SELECT json_agg(json_build_object('name',datname,'owner',pg_get_userbyid(datdba),'encoding',pg_encoding_to_char(encoding)) ORDER BY datname) FROM pg_database WHERE NOT datistemplate),
    'roles',(SELECT json_agg(row_to_json(r) ORDER BY rolname) FROM (SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,extract(epoch FROM rolvaliduntil) AS valid_until FROM pg_roles) r),
    'memberships',(SELECT coalesce(json_agg(row_to_json(m) ORDER BY roleid,member),'[]'::json) FROM (SELECT roleid,member,grantor,admin_option,inherit_option,set_option FROM pg_auth_members) m));`));
  if (databases.some((name) => !global.databases.some((database) => database.name === name))) throw new Error("恢复数据库未覆盖业务清单");
  const extensions = [];
  for (const database of global.databases) {
    extensions.push({ database: database.name, extensions: JSON.parse(await databaseQuery(container, database.name,
      "SELECT coalesce(json_agg(json_build_object('name',extname,'version',extversion) ORDER BY extname),'[]'::json) FROM pg_extension;")) });
  }
  return { ...global, extensions };
}

async function finishOperation(resources, store, report, key, result) {
  let failure;
  try { await resources.cleanup(); }
  catch (error) { failure = error; report.success = false; report.cleanupError = error.message; report.stage = "cleanup"; }
  try { store?.release(); }
  catch (error) { failure ??= error; report.success = false; report.lockError = error.message; report.stage = "unlock"; }
  report.finishedAt = new Date().toISOString();
  try { if (store) writeJson(join(store.root, "attempt-" + report.operationId + ".json"), { ...report, ...result ? { result } : {} }); }
  catch (error) { failure ??= error; }
  finally { key?.fill(0); }
  if (failure) {
    // 尚未向调用者确认的恢复目标属于本轮临时结果；持久回执失败时不能无声遗留。
    resources.preserved.clear();
    try { await resources.cleanup(); } catch (error) { report.cleanupError = error.message; }
    failure.operationId = report.operationId;
    failure.resources = resources.items.map(({ kind, name }) => ({ kind, name }));
    throw failure;
  }
}

export async function createBackup(options) {
  const backupId = randomBytes(8).toString("hex"); const resources = new BackupResources(backupId);
  const report = { schema: "magictools-backup-attempt/1", operationId: backupId, operation: "create", success: false, stage: "preflight", startedAt: new Date().toISOString() };
  let key; let store; let pending; let result;
  try {
    const requested = canonicalDirectory(options.directory);
    const privateKey = privateFile(options.keyFile, requested, 32); key = privateKey.bytes;
    if (key.length !== 32) throw new Error("备份密钥必须为32字节");
    const privateCredentials = privateFile(options.credentialsFile, requested, 8192);
    let credentials; try { credentials = JSON.parse(privateCredentials.bytes.toString("utf8")); } catch { throw new Error("备份凭证JSON无效"); }
    if (credentials.schema !== "magictools-backup-credentials/1" || typeof credentials.user !== "string" || !credentials.user || Buffer.byteLength(credentials.user) > 63 ||
      typeof credentials.password !== "string" || !credentials.password || /[\0\r\n]/.test(credentials.user + credentials.password)) throw new Error("备份数据库凭证无效");
    const source = await inspectBackupSource({ container: options.sourceContainer, databases: options.databases });
    store = acquireStore(requested, { keyId: hash(key), systemIdentifier: source.systemIdentifier }, backupId, true);
    privateFile(privateKey.path, store.root, 32);
    privateFile(privateCredentials.path, store.root, 8192);
    pending = join(store.root, ".pending-" + backupId); mkdirSync(pending, { mode: 0o700 });
    report.stage = "physical-backup";
    await pullImage(source);
    const tool = await toolContainer(resources, source, "container:" + source.containerId);
    const free = await docker(["exec", tool.worker, "df", "-Pk", tool.scratch]);
    const available = Number(free.trim().split(/\r?\n/).at(-1).trim().split(/\s+/)[3]) * 1024;
    if (!Number.isFinite(available) || available < source.totalDatabaseBytes * 3 + 512 * 1024 * 1024) throw new Error("备份临时空间不足");
    const passFile = tool.scratch + "/secrets/pgpass";
    const escape = (value) => value.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
    await docker(["exec", "-i", tool.worker, "sh", "-c", 'umask 077; cat > "$1" && chown postgres:postgres "$1"', "sh", passFile],
      { input: "127.0.0.1:5432:*:" + escape(credentials.user) + ":" + escape(credentials.password) + "\n" });
    await docker(["exec", "--user", "postgres", "-e", "PGPASSFILE=" + passFile, tool.worker, "pg_basebackup", "-h", "127.0.0.1", "-p", "5432", "-U", credentials.user,
      "-D", tool.archive, "--format=tar", "--wal-method=stream", "--checkpoint=fast", "--manifest-checksums=SHA256", "--no-password"], { timeout: 30 * 60_000 });
    const nativeManifest = JSON.parse(await docker(["exec", "--user", "postgres", tool.worker, "cat", tool.archive + "/backup_manifest"]));
    report.stage = "restore-validation";
    await unpackAndVerify(tool, source);
    const probe = "mt-backup-" + backupId + "-probe";
    await startDatabase(resources, source, tool.volume, probe, "none");
    const catalog = await databaseCatalog(probe, options.databases);
    await resources.remove("container", probe);
    report.stage = "encrypt";
    const files = [];
    for (const fileName of BACKUP_FILES) {
      files.push(await dockerStream(["exec", "--user", "postgres", tool.worker, "cat", tool.archive + "/" + fileName], "read",
        (input) => encryptBackupStream(input, createWriteStream(join(pending, fileName + ".enc"), { flags: "wx", mode: 0o600 }), { key, backupId, fileName })));
    }
    report.stage = "cleanup"; await resources.cleanup();
    if (!readFileSync(privateKey.path).equals(key) || !readFileSync(privateCredentials.path).equals(privateCredentials.bytes)) throw new Error("备份期间私有配置发生变化");
    const manifest = validateBackup({ schema: "magictools-backup/1", backupId, storeId: store.store.storeId, status: "complete", source, databases: [...options.databases].sort(),
      startedAt: report.startedAt, completedAt: new Date().toISOString(), recoveryPointLowerBoundAt: source.databaseTime,
      walRanges: nativeManifest["WAL-Ranges"], catalogSha256: hash(JSON.stringify(catalog)), files,
      verification: { checksumAndWal: "passed", isolatedDatabaseStartup: "passed", catalog: "passed" } });
    writeJson(join(pending, "backup.json"), signBackupManifest(manifest, key));
    const destination = join(store.root, "backup-" + backupId);
    if (existsSync(destination)) throw new Error("目标备份已存在");
    renameSync(pending, destination); pending = null;
    report.success = true; report.stage = "complete";
    result = { backupId, directory: destination, manifest };
  } catch (error) { report.error = error.message; throw error; }
  finally { await finishOperation(resources, store, report, key); }
  return result;
}

export async function restoreBackup(options) {
  const operationId = randomBytes(8).toString("hex"); const resources = new BackupResources(operationId);
  const report = { schema: "magictools-backup-attempt/1", operationId, operation: options.verifyOnly ? "verify" : "restore", success: false, stage: "preflight", startedAt: new Date().toISOString() };
  let key; let store; let result;
  try {
    const backupDirectory = realpathSync(options.backupDirectory);
    key = privateFile(options.keyFile, dirname(backupDirectory), 32).bytes;
    if (key.length !== 32 || !/^[a-z][a-z0-9-]{2,62}$/.test(options.targetName ?? "")) throw new Error("恢复目标或密钥无效");
    if (lstatSync(join(backupDirectory, "backup.json")).isSymbolicLink()) throw new Error("备份清单不能为链接");
    const manifest = validateBackup(verifyBackupManifest(parseJson(join(backupDirectory, "backup.json"), "备份清单"), key));
    if (basename(backupDirectory) !== "backup-" + manifest.backupId) throw new Error("备份目录与清单身份不符");
    store = acquireStore(dirname(backupDirectory), { storeId: manifest.storeId, keyId: hash(key), systemIdentifier: manifest.source.systemIdentifier }, operationId);
    for (const file of manifest.files) {
      const path = join(backupDirectory, file.fileName + ".enc"); const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.encryptedBytes) throw new Error("备份文件缺失、大小错误或含链接");
    }
    const network = options.targetName + "-net"; const volume = options.targetName + "-data";
    for (const [kind, name] of [["container", options.targetName], ["network", network], ["volume", volume]]) if (await resources.inspect(kind, name)) throw new Error("恢复目标已存在，拒绝覆盖");
    report.stage = "decrypt";
    await pullImage(manifest.source);
    const tool = await toolContainer(resources, manifest.source, "none", volume);
    await docker(["exec", "--user", "postgres", tool.worker, "mkdir", "-m", "700", tool.archive]);
    for (const metadata of manifest.files) {
      await dockerStream(["exec", "-i", "--user", "postgres", tool.worker, "sh", "-c", 'cat > "$1"', "sh", tool.archive + "/" + metadata.fileName], "write",
        (output) => decryptBackupStream(createReadStream(join(backupDirectory, metadata.fileName + ".enc")), output,
          { key, backupId: manifest.backupId, fileName: metadata.fileName, metadata }));
    }
    report.stage = "physical-validation"; await unpackAndVerify(tool, manifest.source);
    await resources.create("network", network, ["network", "create", "--internal", "--label", resources.label, network]);
    report.stage = "database-startup";
    await startDatabase(resources, manifest.source, volume, options.targetName, network);
    const catalog = await databaseCatalog(options.targetName, manifest.databases);
    if (hash(JSON.stringify(catalog)) !== manifest.catalogSha256) throw new Error("恢复角色、数据库或扩展目录与备份不一致");
    report.success = true; report.stage = "complete"; report.backupId = manifest.backupId;
    result = { operationId, backupId: manifest.backupId, container: options.targetName, network, volume, catalogVerified: true };
    if (!options.verifyOnly) for (const [kind, name] of [["container", options.targetName], ["network", network], ["volume", volume]]) resources.preserve(kind, name);
  } catch (error) { report.error = error.message; throw error; }
  finally { await finishOperation(resources, store, report, key, result); }
  return result;
}

export async function verifyBackup(options) {
  const verified = await restoreBackup({ ...options, targetName: "mt-backup-verify-" + randomBytes(8).toString("hex"), verifyOnly: true });
  return { operationId: verified.operationId, backupId: verified.backupId, catalogVerified: verified.catalogVerified, cleanup: "passed" };
}
