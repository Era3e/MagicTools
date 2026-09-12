import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { backupCommand } from "./backup.mjs";
import { cleanupBackupExport, exportBackup } from "./lib/backup-transfer.mjs";
import { recordBackupFailure } from "./lib/backup-alerts.mjs";

export async function remoteBackupExport(argv) {
  const [command, ...args] = argv; const values = {};
  if (!["create", "cleanup"].includes(command)) throw new Error("远端导出动作无效");
  const accepted = command === "create" ? ["directory", "export-dir", "transfer-id", "container", "key-file", "credentials-file", "catalog", "keep", "events-dir"] : ["export-dir", "transfer-id", "key-file", "events-dir"];
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.slice(2); const value = args[index + 1];
    if (!args[index]?.startsWith("--") || !accepted.includes(key) || Object.hasOwn(values, key) || !value || value.startsWith("--")) throw new Error("远端导出参数无效");
    values[key] = value;
  }
  if (accepted.some((key) => !values[key])) throw new Error("远端导出缺少参数");
  if (!/^[a-f0-9]{16}$/.test(values["transfer-id"])) throw new Error("远端传输身份无效");
  const options = { directory: resolve(values["export-dir"]), keyFile: resolve(values["key-file"]), transferId: values["transfer-id"] };
  let created;
  try {
    if (command === "cleanup") return await cleanupBackupExport(options);
    created = await backupCommand(["create", ...["directory", "container", "key-file", "credentials-file", "catalog", "keep", "events-dir"].flatMap((key) => ["--" + key, values[key]])]);
    return await exportBackup({ ...options, backupDirectory: created.directory });
  } catch (error) {
    if (!error.alert) await recordBackupFailure({ directory: values["events-dir"] ?? resolve(dirname(options.directory), "events"), operation: "ssh",
      stage: command === "cleanup" ? "ssh-cleanup" : "ssh-export", operationId: options.transferId, backupId: created?.backupId });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  remoteBackupExport(process.argv.slice(2)).then((value) => console.log(JSON.stringify(value))).catch(() => {
    console.error(JSON.stringify({ success: false, errorCode: "REMOTE_BACKUP_EXPORT_FAILED" })); process.exitCode = 1;
  });
}
