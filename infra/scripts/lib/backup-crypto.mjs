import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const FILES = ["base.tar", "pg_wal.tar", "backup_manifest"];
export const MAX_BACKUP_FILE_BYTES = 32 * 1024 ** 3;
function aad({ key, backupId, fileName }) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error("备份加密密钥必须为32字节");
  if (!/^[a-f0-9]{16}$/.test(backupId) || !FILES.includes(fileName)) throw new Error("备份文件身份非法");
  return Buffer.from(JSON.stringify({ schema: "magictools-backup-file/1", backupId, fileName }));
}

export async function encryptBackupStream(input, output, options) {
  const additionalData = aad(options);
  const limit = options.maxPlaintextBytes ?? MAX_BACKUP_FILE_BYTES;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BACKUP_FILE_BYTES) throw new Error("备份文件容量限制非法");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", options.key, nonce);
  cipher.setAAD(additionalData);
  let plainBytes = 0; let encryptedBytes = 0;
  const hash = createHash("sha256");
  const countPlain = new Transform({ transform(chunk, encoding, done) {
    plainBytes += chunk.length;
    if (plainBytes > limit) return done(new Error("备份文件超过认证加密容量限制"));
    done(null, chunk);
  } });
  const countEncrypted = new Transform({ transform(chunk, encoding, done) { encryptedBytes += chunk.length; hash.update(chunk); done(null, chunk); } });
  await pipeline(input, countPlain, cipher, countEncrypted, output);
  return { fileName: options.fileName, nonce: nonce.toString("hex"), tag: cipher.getAuthTag().toString("hex"),
    plainBytes, encryptedBytes, sha256: hash.digest("hex") };
}

// 输出只能写入隔离临时卷；调用者须等本函数认证成功后才能使用，失败时负责回收该卷。
export async function decryptBackupStream(input, output, options) {
  const additionalData = aad(options);
  const metadata = options.metadata;
  if (metadata?.fileName !== options.fileName || !/^[a-f0-9]{24}$/.test(metadata.nonce) || !/^[a-f0-9]{32}$/.test(metadata.tag) ||
    !/^[a-f0-9]{64}$/.test(metadata.sha256) || !Number.isSafeInteger(metadata.plainBytes) || metadata.plainBytes < 0 || metadata.plainBytes > MAX_BACKUP_FILE_BYTES ||
    metadata.encryptedBytes !== metadata.plainBytes) throw new Error("备份密文元数据非法");
  const decipher = createDecipheriv("aes-256-gcm", options.key, Buffer.from(metadata.nonce, "hex"));
  decipher.setAAD(additionalData); decipher.setAuthTag(Buffer.from(metadata.tag, "hex"));
  let encryptedBytes = 0; let plainBytes = 0;
  const hash = createHash("sha256");
  const checkCipher = new Transform({ transform(chunk, encoding, done) {
    encryptedBytes += chunk.length;
    if (encryptedBytes > metadata.encryptedBytes) return done(new Error("备份密文超过声明容量"));
    hash.update(chunk); done(null, chunk);
  } });
  const countPlain = new Transform({ transform(chunk, encoding, done) { plainBytes += chunk.length; done(null, chunk); } });
  await pipeline(input, checkCipher, decipher, countPlain, output);
  if (encryptedBytes !== metadata.encryptedBytes || plainBytes !== metadata.plainBytes || hash.digest("hex") !== metadata.sha256) throw new Error("备份密文大小或摘要不匹配");
  return { plainBytes, encryptedBytes };
}

function canonical(value, depth = 0) {
  if (depth > 40) throw new Error("备份清单结构过深");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) throw new Error("备份清单数组不能包含空位或额外属性");
    for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) throw new Error("备份清单数组不能包含空位");
    return "[" + value.map((item) => canonical(item, depth + 1)).join(",") + "]";
  }
  if (value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key], depth + 1)).join(",") + "}";
  }
  throw new Error("备份清单必须为有效JSON");
}

function manifestMac(manifest, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error("备份清单认证密钥必须为32字节");
  if (!manifest || typeof manifest !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(manifest)) ||
    manifest.schema !== "magictools-backup/1" || !/^[a-f0-9]{16}$/.test(manifest.backupId)) throw new Error("备份清单认证身份非法");
  const derived = hkdfSync("sha256", key, Buffer.from(manifest.backupId, "hex"), Buffer.from("magictools-backup-manifest/1"), 32);
  return createHmac("sha256", derived).update(canonical(manifest)).digest();
}

export function signBackupManifest(manifest, key) {
  if (manifest && Object.hasOwn(manifest, "authentication")) throw new Error("备份清单已经包含认证字段");
  const value = manifestMac(manifest, key).toString("hex");
  return { ...structuredClone(manifest), authentication: { scheme: "hkdf-sha256+hmac-sha256/1", value } };
}

export function verifyBackupManifest(signed, key) {
  if (signed?.authentication?.scheme !== "hkdf-sha256+hmac-sha256/1" || !/^[a-f0-9]{64}$/.test(signed.authentication.value)) throw new Error("备份清单认证缺失或非法");
  const { authentication, ...manifest } = signed;
  if (!timingSafeEqual(manifestMac(manifest, key), Buffer.from(authentication.value, "hex"))) throw new Error("备份清单认证失败");
  return manifest;
}
