import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBackup, restoreBackup, verifyBackup } from "./lib/backup-local.mjs";
import { runtimeCatalog } from "./lib/runtime-artifacts.mjs";

export async function backupCommand(argv) {
  const [command, ...args] = argv;
  if (!["create", "verify", "restore"].includes(command)) throw new Error("备份操作必须为create、verify或restore");
  const accepted = command === "create" ? ["container", "directory", "key-file", "credentials-file", "catalog"] :
    command === "restore" ? ["backup", "key-file", "target"] : ["backup", "key-file"];
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.slice(2); const value = args[index + 1];
    if (!args[index]?.startsWith("--") || !accepted.includes(key) || Object.hasOwn(values, key) || !value || value.startsWith("--")) throw new Error("备份参数缺失、重复或未知");
    values[key] = value;
  }
  const required = accepted.filter((key) => key !== "catalog");
  if (required.some((key) => !values[key])) throw new Error("缺少参数：" + required.filter((key) => !values[key]).map((key) => "--" + key).join(", "));
  if (command === "create") {
    let ports;
    try {
      if (values.catalog) ports = JSON.parse(readFileSync(resolve(values.catalog), "utf8"));
      else {
        const { parse } = await import("yaml");
        ports = parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../ports.yaml"), "utf8"));
      }
    } catch { throw new Error("数据库所属应用清单无法读取；独立部署脚本须传--catalog ports.json"); }
    const databases = runtimeCatalog(ports).filter((item) => item.kind === "node" && item.app !== "gateway").map((item) => item.app);
    const result = await createBackup({ sourceContainer: values.container, directory: resolve(values.directory), keyFile: resolve(values["key-file"]), credentialsFile: resolve(values["credentials-file"]), databases });
    return { success: true, operation: command, backupId: result.backupId, directory: result.directory };
  }
  const options = { backupDirectory: resolve(values.backup), keyFile: resolve(values["key-file"]) };
  const result = command === "verify" ? await verifyBackup(options) : await restoreBackup({ ...options, targetName: values.target });
  return { success: true, operation: command, ...result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  backupCommand(process.argv.slice(2)).then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(JSON.stringify({ success: false, error: error.message, operationId: error.operationId, resources: error.resources })); process.exitCode = 1;
  });
}
