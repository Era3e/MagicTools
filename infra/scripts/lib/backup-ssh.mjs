import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalDirectory, hash, parseJson, privateFile, writeJson } from "./backup-store.mjs";
import { validateRetentionCount } from "./backup-retention.mjs";
import { receiveBackupExport } from "./backup-transfer.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const execute = promisify(execFile);
const quote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
const remotePath = (value) => typeof value === "string" && /^\/[A-Za-z0-9._/-]+$/.test(value) && !value.split("/").includes("..") && posix.normalize(value) !== "/";
const remoteWithin = (parent, value) => value === parent || value.startsWith(parent.replace(/\/$/, "") + "/");
const scripts = ["backup.mjs", "backup-export.mjs", ...["backup-store", "backup-retention", "backup-alerts", "backup-transfer", "backup-local", "backup-catalog", "backup-crypto", "backup-source", "backup-config-files", "backup-docker", "runtime-artifacts"].map((name) => "lib/" + name + ".mjs")];

async function executeTransport(command, args) {
  try { const result = await execute(command, args, { windowsHide: true, timeout: 40 * 60_000, maxBuffer: 4 * 1024 * 1024 }); return { exitCode: 0, stdout: result.stdout }; }
  catch (error) { return { exitCode: typeof error.code === "number" ? error.code : 1, stdout: "" }; }
}

export async function backupRemote(options, dependencies = {}) {
  const operationId = randomBytes(8).toString("hex");
  const directory = join(dependencies.outputDirectory ?? join(root, ".qa/backup-transfers"), operationId);
  const report = { schema: "magictools-backup-transport/1", operationId, success: false, copyVerified: false, remoteOutcome: "not-started",
    stage: "preflight", transport: "ssh", separatePhysicalHost: "not-verified", startedAt: new Date().toISOString() };
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const run = dependencies.executeTransport ?? executeTransport;
  try {
    if (!/^(?:[A-Za-z0-9_][A-Za-z0-9_.-]*@)?[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(options.host ?? "")) throw new Error("SSH主机参数无效");
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(options.container ?? "")) throw new Error("SSH源容器参数无效");
    for (const value of [options.remoteDirectory, options.remoteStore, options.remoteKeyFile, options.remoteCredentialsFile]) if (!remotePath(value)) throw new Error("远端路径必须是无跳转的绝对POSIX路径");
    const remoteDirectory = posix.normalize(options.remoteDirectory); const remoteStore = posix.normalize(options.remoteStore);
    const remoteKey = posix.normalize(options.remoteKeyFile); const remoteCredentials = posix.normalize(options.remoteCredentialsFile);
    if (remoteWithin(remoteStore, remoteDirectory) || remoteWithin(remoteDirectory, remoteStore) || remoteKey === remoteCredentials ||
      [remoteKey, remoteCredentials].some((file) => remoteWithin(remoteStore, file) || remoteWithin(remoteDirectory, file))) throw new Error("远端备份、脚本与私有文件路径必须分离");
    const keep = options.keep ?? 15; const remoteKeep = options.remoteKeep ?? 15;
    validateRetentionCount(keep); validateRetentionCount(remoteKeep);
    const privateKey = privateFile(options.keyFile, canonicalDirectory(options.directory), 32).bytes;
    try { if (privateKey.length !== 32) throw new Error("本地备份密钥必须为32字节"); } finally { privateKey.fill(0); }
    const payload = join(directory, "payload"); mkdirSync(join(payload, "scripts/lib"), { recursive: true, mode: 0o700 });
    const digests = [];
    for (const name of scripts) {
      const bytes = readFileSync(join(root, "infra/scripts", name)); writeFileSync(join(payload, "scripts", name), bytes, { flag: "wx", mode: 0o600 });
      digests.push(hash(bytes) + "  scripts/" + name);
    }
    const { parse } = await import("yaml");
    const catalog = Buffer.from(JSON.stringify(parse(readFileSync(join(root, "infra/ports.yaml"), "utf8"))) + "\n");
    writeFileSync(join(payload, "ports.json"), catalog, { flag: "wx", mode: 0o600 }); digests.push(hash(catalog) + "  ports.json");
    writeFileSync(join(payload, "SHA256SUMS"), digests.join("\n") + "\n", { flag: "wx", mode: 0o600 });
    let sshConfig;
    if (options.sshConfig) {
      sshConfig = privateFile(options.sshConfig, canonicalDirectory(options.directory), 64 * 1024).path;
      privateFile(sshConfig, canonicalDirectory(directory), 64 * 1024);
    }
    const connection = [...(sshConfig ? ["-F", sshConfig] : []), "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3"];
    const ssh = ["-T", ...connection, options.host];
    const parent = remoteDirectory.replace(/\/$/, "") + "/transfer-" + operationId;
    const remotePayload = parent + "/payload"; const remoteExport = parent + "/export";
    report.host = options.host; report.remoteExport = remoteExport;
    report.stage = "ssh-prepare";
    if ((await run("ssh", [...ssh, "umask 077 && mkdir -p " + quote(remoteDirectory) + " && mkdir " + quote(parent)])).exitCode !== 0) throw new Error("SSH准备目录失败");
    if ((await run("scp", [...connection, "-r", payload, options.host + ":" + parent + "/"])).exitCode !== 0) throw new Error("SSH公开脚本上传失败");
    if ((await run("ssh", [...ssh, "cd " + quote(remotePayload) + " && sha256sum --strict --check SHA256SUMS"])).exitCode !== 0) throw new Error("SSH公开脚本指纹校验失败");
    report.stage = "ssh-create"; report.remoteOutcome = "unknown";
    const remoteScript = remotePayload + "/scripts/backup-export.mjs";
    const remoteArgs = [remoteScript, "create", "--directory", remoteStore, "--export-dir", remoteExport, "--transfer-id", operationId,
      "--container", options.container, "--key-file", remoteKey, "--credentials-file", remoteCredentials, "--catalog", remotePayload + "/ports.json", "--keep", String(remoteKeep), "--events-dir", parent + "/events"];
    const creation = await run("ssh", [...ssh, "node " + remoteArgs.map(quote).join(" ")]);
    if (creation.exitCode !== 0) throw new Error("SSH源备份或导出未确认，源端结果未知");
    let remoteResult; try { remoteResult = JSON.parse(creation.stdout); } catch { throw new Error("SSH远端输出不是有效回执"); }
    if (remoteResult?.schema !== "magictools-backup-export/1" || remoteResult.success !== true || remoteResult.transferId !== operationId || !/^[a-f0-9]{16}$/.test(remoteResult.backupId)) throw new Error("SSH远端回执身份不符");
    report.backupId = remoteResult.backupId;
    report.stage = "ssh-download";
    const download = async (remote, local) => {
      if ((await run("scp", [...connection, options.host + ":" + remote, local])).exitCode !== 0) throw new Error("SSH备份文件下载失败，源副本已保留");
    };
    const receiptFile = join(directory, "remote-export.json"); await download(remoteExport + "/transfer.json", receiptFile);
    const transfer = parseJson(receiptFile, "远端导出回执");
    if (JSON.stringify(transfer) !== JSON.stringify(remoteResult)) throw new Error("SSH回读回执与执行结果不符");
    const manifestFile = join(directory, "backup.json");
    await download(remoteExport + "/backup-" + report.backupId + "/backup.json", manifestFile);
    report.remoteOutcome = "created-exported";
    const received = await receiveBackupExport({ directory: options.directory, keyFile: options.keyFile, keep, transfer, manifestBytes: readFileSync(manifestFile),
      downloadFile: (name, output) => download(remoteExport + "/backup-" + report.backupId + "/" + name, output) }, dependencies.receiveDependencies);
    report.copyVerified = true; report.copy = received;
    report.stage = "ssh-cleanup";
    const cleanupArgs = [remoteScript, "cleanup", "--export-dir", remoteExport, "--key-file", remoteKey, "--transfer-id", operationId, "--events-dir", parent + "/events"];
    const cleaned = await run("ssh", [...ssh, "node " + cleanupArgs.map(quote).join(" ")]);
    let cleanup; try { cleanup = JSON.parse(cleaned.stdout); } catch { /* 未确认则保留失败状态，不能推断远端已清理。 */ }
    if (cleaned.exitCode !== 0 || cleanup?.success !== true || cleanup.transferId !== operationId || cleanup.backupId !== report.backupId || cleanup.cleanup !== "passed") throw new Error("SSH副本已验证，但远端导出清理未确认");
    report.remoteExportCleanup = "passed"; report.success = true; report.stage = "complete";
    return report;
  } catch (error) {
    if (error.copy?.success === true) { report.copyVerified = true; report.copy = error.copy; }
    report.stage = error.stage ?? report.stage; report.errorCode = "BACKUP_SSH_FAILED";
    error.operationId = operationId; error.backupId ??= report.backupId; error.stage = report.stage; throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    try { writeJson(join(directory, "transport.json"), report); }
    catch (error) { error.operationId = operationId; error.backupId = report.backupId; error.stage = "receipt"; throw error; }
  }
}
