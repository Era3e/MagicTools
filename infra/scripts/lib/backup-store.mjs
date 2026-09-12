import { createHash, randomBytes } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { hostname } from "node:os";
import { MAX_BACKUP_FILE_BYTES } from "./backup-crypto.mjs";
import { isImageRepository } from "./runtime-artifacts.mjs";

export const BACKUP_FILES = ["base.tar", "pg_wal.tar", "backup_manifest"];
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const parseJson = (file, label) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { throw new Error(label + "无法读取或JSON无效"); } };
export const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
export const within = (parent, file) => { const path = relative(parent, file); return !path || (!path.startsWith(".." + sep) && path !== ".." && !isAbsolute(path)); };

export function canonicalDirectory(directory) {
  let current = resolve(directory); const suffix = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) throw new Error("备份目录无法规范化");
    suffix.unshift(basename(current)); current = parent;
  }
  return resolve(realpathSync(current), ...suffix);
}

export function privateFile(file, directory, sizeLimit) {
  const path = realpathSync(file);
  if (within(directory, resolve(file)) || within(directory, path) || !statSync(path).isFile() || statSync(path).size > sizeLimit) throw new Error("私有文件必须独立于备份目录且大小有效");
  return { path, bytes: readFileSync(path) };
}

export function acquireStore(directory, expected, operationId, create = false) {
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
  const lockIdentity = lstatSync(lock); const markerDigest = hash(readFileSync(marker));
  const assertOwned = () => {
    const current = lstatSync(lock); const owner = join(lock, "owner.json");
    if (realpathSync(root) !== root || current.isSymbolicLink() || !current.isDirectory() ||
      current.ino !== lockIdentity.ino || current.dev !== lockIdentity.dev ||
      lstatSync(owner).isSymbolicLink() || !lstatSync(owner).isFile() ||
      parseJson(owner, "备份锁").operationId !== operationId || lstatSync(marker).isSymbolicLink() || hash(readFileSync(marker)) !== markerDigest) throw new Error("备份锁归属或目录标识变化");
  };
  return { root, store, assertOwned, release() {
    assertOwned();
    unlinkSync(join(lock, "owner.json")); rmdirSync(lock);
  } };
}

export function validateBackup(manifest) {
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
