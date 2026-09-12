import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBackup, restoreBackup, verifyBackup } from "./lib/backup-local.mjs";
import { runtimeCatalog } from "./lib/runtime-artifacts.mjs";
import { pruneBackups } from "./lib/backup-retention.mjs";
import { recordBackupFailure, validateBackupAlertConfiguration } from "./lib/backup-alerts.mjs";
import { canonicalDirectory, privateFile } from "./lib/backup-store.mjs";

async function executeBackupCommand(argv) {
  const [command, ...args] = argv;
  if (!["create", "verify", "restore", "prune", "ssh", "handoff"].includes(command)) throw new Error("备份操作必须为create、verify、restore、prune、ssh或handoff");
  const accepted = [...(command === "handoff" ? ["backup", "key-file", "restore-receipt", "config", "output", "catalog"] :
    command === "ssh" ? ["host", "container", "remote-directory", "remote-store", "remote-key-file", "remote-credentials-file", "directory", "key-file", "keep", "remote-keep", "ssh-config"] :
    command === "create" ? ["container", "directory", "key-file", "credentials-file", "catalog", "keep"] :
    command === "prune" ? ["directory", "key-file", "keep"] :
    command === "restore" ? ["backup", "key-file", "target"] : ["backup", "key-file"]), "notify-config", "events-dir"];
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.slice(2); const value = args[index + 1];
    if (!args[index]?.startsWith("--") || !accepted.includes(key) || Object.hasOwn(values, key) || !value || value.startsWith("--")) throw new Error("备份参数缺失、重复或未知");
    values[key] = value;
  }
  const required = accepted.filter((key) => !["catalog", "keep", "remote-keep", "notify-config", "events-dir", "ssh-config"].includes(key));
  if (required.some((key) => !values[key])) throw new Error("缺少参数：" + required.filter((key) => !values[key]).map((key) => "--" + key).join(", "));
  if (values.keep && !/^[1-9][0-9]*$/.test(values.keep)) throw new Error("--keep必须是正整数");
  const keep = values.keep ? Number(values.keep) : 15;
  if (command === "ssh") {
    if (values["remote-keep"] && !/^[1-9][0-9]*$/.test(values["remote-keep"])) throw new Error("--remote-keep必须是正整数");
    const { backupRemote } = await import("./lib/backup-ssh.mjs");
    return { operation: command, ...await backupRemote({ host: values.host, container: values.container, remoteDirectory: values["remote-directory"], remoteStore: values["remote-store"],
      remoteKeyFile: values["remote-key-file"], remoteCredentialsFile: values["remote-credentials-file"], directory: resolve(values.directory), keyFile: resolve(values["key-file"]),
      keep, remoteKeep: values["remote-keep"] ? Number(values["remote-keep"]) : 15, sshConfig: values["ssh-config"] }) };
  }
  if (command === "prune") return { success: true, operation: command, ...await pruneBackups({ directory: resolve(values.directory), keyFile: resolve(values["key-file"]), keep }) };
  if (command === "create" || command === "handoff") {
    let ports;
    try {
      if (values.catalog) ports = JSON.parse(readFileSync(resolve(values.catalog), "utf8"));
      else {
        const { parse } = await import("yaml");
        ports = parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../ports.yaml"), "utf8"));
      }
    } catch { throw new Error("数据库所属应用清单无法读取；独立部署脚本须传--catalog ports.json"); }
    const catalog = runtimeCatalog(ports);
    if (command === "handoff") {
      const { prepareRecoveryHandoff } = await import("./lib/backup-handoff.mjs");
      return { success: true, operation: command, ...await prepareRecoveryHandoff({ backupDirectory: resolve(values.backup), keyFile: resolve(values["key-file"]),
        restoreReceiptFile: resolve(values["restore-receipt"]), configFile: resolve(values.config), outputFile: resolve(values.output), catalog }) };
    }
    const databases = catalog.filter((item) => item.kind === "node" && item.app !== "gateway").map((item) => item.app);
    const result = await createBackup({ sourceContainer: values.container, directory: resolve(values.directory), keyFile: resolve(values["key-file"]), credentialsFile: resolve(values["credentials-file"]), databases, keep });
    return { success: true, operation: command, backupId: result.backupId, directory: result.directory, retention: result.retention };
  }
  const options = { backupDirectory: resolve(values.backup), keyFile: resolve(values["key-file"]) };
  const result = command === "verify" ? await verifyBackup(options) : await restoreBackup({ ...options, targetName: values.target });
  return { success: true, operation: command, ...result };
}

export async function backupCommand(argv) {
  let events = resolve(".qa/backup-events"); let configuration;
  // 错误参数仍可告警；只使用唯一且有值的公共选项，不猜测重复值。
  const value = (name) => {
    const indexes = argv.flatMap((arg, index) => arg === "--" + name ? [index] : []);
    const next = indexes.length === 1 ? argv[indexes[0] + 1] : undefined;
    return next && !next.startsWith("--") ? next : undefined;
  };
  try {
    if (value("events-dir")) events = resolve(value("events-dir"));
    const configFile = value("notify-config");
    if (configFile) {
      configuration = {}; // 已配置但无法读取时，不能回报为未配置。
      try {
        const bytes = privateFile(configFile, canonicalDirectory(events), 64 * 1024).bytes;
        const store = value("directory") ?? (value("backup") ? dirname(resolve(value("backup"))) : undefined);
        if (store) privateFile(configFile, canonicalDirectory(store), 64 * 1024);
        configuration = JSON.parse(bytes.toString("utf8"));
      } catch { throw new Error("备份告警配置无法读取，或未独立于备份/事件目录保存"); }
      if (validateBackupAlertConfiguration(configuration)) throw new Error("备份告警配置无效");
    }
    return await executeBackupCommand(argv);
  } catch (error) {
    const alert = await recordBackupFailure({ directory: events, configuration, operation: argv[0], operationId: error.operationId, backupId: error.backupId, stage: error.stage ?? "preflight" });
    error.operationId = alert.operationId; error.alert = alert;
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  backupCommand(process.argv.slice(2)).then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(JSON.stringify({ success: false, error: error.message, operationId: error.operationId, backupId: error.backupId, output: error.output, resources: error.resources, alert: error.alert })); process.exitCode = 1;
  });
}
