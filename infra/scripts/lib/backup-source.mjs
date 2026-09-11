import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { posix } from "node:path";
import { isImageRepository } from "./runtime-artifacts.mjs";
import { inspectConfigurationFiles } from "./backup-config-files.mjs";

const exec = promisify(execFile);
const SOURCE_QUERY = `SELECT json_build_object(
  'systemIdentifier',(SELECT system_identifier::text FROM pg_control_system()),
  'serverVersion',current_setting('server_version_num')::int,
  'inRecovery',pg_is_in_recovery(),
  'dataDirectory',current_setting('data_directory'),
  'configFile',current_setting('config_file'),
  'hbaFile',current_setting('hba_file'),
  'identFile',current_setting('ident_file'),
  'externalConfigurationFiles',(SELECT coalesce(json_agg(DISTINCT path ORDER BY path),'[]'::json)
    FROM (SELECT sourcefile AS path FROM pg_file_settings
      UNION SELECT file_name FROM pg_hba_file_rules
      UNION SELECT file_name FROM pg_ident_file_mappings) AS config_files
    WHERE left(path,length(current_setting('data_directory')) + 1) <> current_setting('data_directory') || '/'),
  'authenticationErrorCount',(SELECT count(*) FROM (SELECT error FROM pg_hba_file_rules
    UNION ALL SELECT error FROM pg_ident_file_mappings) AS config_errors WHERE error IS NOT NULL),
  'databases',(SELECT json_agg(json_build_object('name',datname,'bytes',pg_database_size(oid)) ORDER BY datname)
    FROM pg_database WHERE NOT datistemplate),
  'externalTablespaces',(SELECT coalesce(json_agg(spcname),'[]'::json) FROM pg_tablespace WHERE pg_tablespace_location(oid) <> ''),
  'role',(SELECT json_build_object('name',rolname,'replication',rolreplication,'superuser',rolsuper) FROM pg_roles WHERE rolname=current_user),
  'availableWalSenders',current_setting('max_wal_senders')::int - (SELECT count(*) FROM pg_stat_replication),
  'availableReplicationSlots',current_setting('max_replication_slots')::int - (SELECT count(*) FROM pg_replication_slots),
  'databaseTime',clock_timestamp());`;

async function executeDocker(args) {
  try {
    const result = await exec("docker", args, { windowsHide: true, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    return { exitCode: 0, stdout: result.stdout };
  } catch (error) { return { exitCode: typeof error.code === "number" ? error.code : 1, stdout: "" }; }
}

export async function inspectBackupSource(options, dependencies = {}) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(options.container ?? "")) throw new Error("源容器标识非法");
  if (!Array.isArray(options.databases) || !options.databases.length || options.databases.some((name) => !/^[a-z][a-z0-9_]{0,62}$/.test(name))) throw new Error("业务库清单非法");
  const run = dependencies.executeDocker ?? executeDocker;
  const readJson = async (args, label) => {
    const result = await run(args);
    if (result.exitCode !== 0) throw new Error(label + "检查失败");
    try { return JSON.parse(result.stdout); } catch { throw new Error(label + "结果无效"); }
  };
  const container = await readJson(["container", "inspect", "--format",
    '{"id":{{json .Id}},"imageId":{{json .Image}},"running":{{json .State.Running}},"paused":{{json .State.Paused}}}', options.container], "备份源容器");
  if (!/^[a-f0-9]{64}$/.test(container?.id) || !/^sha256:[a-f0-9]{64}$/.test(container.imageId) || container.running !== true || container.paused !== false) throw new Error("备份源容器未运行或身份非法");
  const image = await readJson(["image", "inspect", "--format",
    '{"id":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}},"digests":{{json .RepoDigests}}}', container.imageId], "备份源镜像");
  if (image?.id !== container.imageId || image.os !== "linux" || !["amd64", "arm64"].includes(image.architecture) || !Array.isArray(image.digests) || !image.digests.length ||
    image.digests.some((reference) => typeof reference !== "string" || !/@sha256:[a-f0-9]{64}$/.test(reference) || !isImageRepository(reference.split("@")[0]))) throw new Error("备份源镜像缺少固定digest或平台不匹配");
  const source = await readJson(["exec", "--user", "postgres", container.id, "psql", "-X", "-q", "-A", "-t", "--no-password", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", SOURCE_QUERY], "备份源数据库");
  if (!Array.isArray(source?.databases) || !source.databases.length || source.databases.some((database) =>
    typeof database?.name !== "string" || !database.name.length || /[\0\r\n]/.test(database.name) || !Number.isSafeInteger(database.bytes) || database.bytes < 0) ||
    new Set(source.databases.map((database) => database.name)).size !== source.databases.length) throw new Error("备份源数据库清单缺失或无效");
  const totalDatabaseBytes = source.databases.reduce((sum, database) => sum + database.bytes, 0);
  if (!Number.isSafeInteger(totalDatabaseBytes)) throw new Error("备份源数据库容量超出可测量范围");
  const missing = options.databases.filter((name) => !source.databases.some((database) => database.name === name));
  if (missing.length) throw new Error("缺少业务库：" + missing.join(", "));
  if (typeof source.systemIdentifier !== "string" || !/^[1-9][0-9]{0,19}$/.test(source.systemIdentifier) || BigInt(source.systemIdentifier) > 18446744073709551615n ||
    typeof source.databaseTime !== "string" || !Number.isFinite(Date.parse(source.databaseTime))) throw new Error("备份源集群身份或时间无效");
  if (!Number.isInteger(source.serverVersion) || Math.floor(source.serverVersion / 10_000) !== 16 || source.inRecovery !== false) throw new Error("备份源必须为PostgreSQL16主库");
  if (typeof source.dataDirectory !== "string" || !source.dataDirectory.startsWith("/") || posix.normalize(source.dataDirectory) === "/") throw new Error("备份源数据目录非法");
  const insideData = (path) => typeof path === "string" && path.startsWith("/") && posix.normalize(path).startsWith(posix.normalize(source.dataDirectory).replace(/\/$/, "") + "/");
  if (![source.configFile, source.hbaFile, source.identFile].every(insideData) ||
    !Array.isArray(source.externalConfigurationFiles) || source.externalConfigurationFiles.length) throw new Error("备份源存在数据目录以外的配置，当前布局不支持");
  if (source.authenticationErrorCount !== 0) throw new Error("备份源磁盘认证配置存在解析错误或无法确认有效性");
  // pg_file_settings会把合法pending_restart也标记为未应用错误；用只读启动解析验证PG配置。
  const startupValue = async (setting) => {
    const parsed = await run(["exec", "--user", "postgres", container.id, "postgres", "-D", source.dataDirectory,
      "-c", "config_file=" + source.configFile, "-C", setting]);
    if (parsed.exitCode !== 0) throw new Error("备份源PG启动配置解析失败");
    return parsed.stdout.trim();
  };
  if (posix.normalize(await startupValue("data_directory")) !== posix.normalize(source.dataDirectory)) throw new Error("备份源启动配置指向不同数据目录");
  const startupConfiguration = { hbaFile: await startupValue("hba_file"), identFile: await startupValue("ident_file") };
  if (![startupConfiguration.hbaFile, startupConfiguration.identFile].every(insideData)) throw new Error("备份源启动配置引用数据目录以外的认证文件");
  if (!Array.isArray(source.externalTablespaces) || source.externalTablespaces.length) throw new Error("备份源含额外表空间，当前布局不支持");
  if (!Number.isInteger(source.availableWalSenders) || source.availableWalSenders < 2 || !Number.isInteger(source.availableReplicationSlots) || source.availableReplicationSlots < 1) throw new Error("备份源需要两个可用WAL sender及临时复制槽");
  if (source.role?.superuser !== true && source.role?.replication !== true) throw new Error("备份源角色缺少复制权限");
  const links = await run(["exec", "--user", "postgres", container.id, "find", source.dataDirectory, "-type", "l", "-print"]);
  if (links.exitCode !== 0) throw new Error("备份源文件布局检查失败");
  if (links.stdout.trim()) throw new Error("备份源数据目录含符号链接，当前完整备份布局不支持");
  const access = {
    readFile: async (file) => {
      const result = await run(["exec", "--user", "postgres", container.id, "sh", "-c",
        'if test -f "$1"; then cat -- "$1"; elif test ! -e "$1"; then exit 44; else exit 1; fi', "sh", file]);
      if (result.exitCode === 44) return null;
      if (result.exitCode !== 0) throw new Error("备份源配置依赖文件读取失败");
      return result.stdout;
    },
    listDirectory: async (directory) => {
      const result = await run(["exec", "--user", "postgres", container.id, "sh", "-c",
        'if test -d "$1"; then find "$1" -mindepth 1 -maxdepth 1 -type f -name "*.conf" ! -name ".*" -printf "%f\\0"; else exit 44; fi', "sh", directory]);
      if (result.exitCode !== 0) throw new Error("备份源配置依赖目录读取失败");
      return result.stdout.split("\0").filter(Boolean);
    },
  };
  const runningFiles = await inspectConfigurationFiles(source, access);
  const startupFiles = await inspectConfigurationFiles({ ...source, ...startupConfiguration }, access);
  const configurationFiles = { files: [...new Set([...runningFiles.files, ...startupFiles.files])].sort(),
    missingOptionalFiles: [...new Set([...runningFiles.missingOptionalFiles, ...startupFiles.missingOptionalFiles])].sort() };
  return { ...source, startupConfiguration, configurationFiles, containerId: container.id,
    image: { localImageId: image.id, reference: image.digests[0], platform: image.os + "/" + image.architecture },
    totalDatabaseBytes };
}
