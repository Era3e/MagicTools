import test from "node:test";
import assert from "node:assert/strict";
import { inspectBackupSource } from "./backup-source.mjs";

const databases = ["applicant", "assessor", "assistant", "designer", "gatherer", "investigator", "manager", "scholar"];
const source = () => ({ systemIdentifier: "7684395164077977644", serverVersion: 160015, inRecovery: false,
  dataDirectory: "/var/lib/postgresql/data", configFile: "/var/lib/postgresql/data/postgresql.conf",
  hbaFile: "/var/lib/postgresql/data/pg_hba.conf", identFile: "/var/lib/postgresql/data/pg_ident.conf",
  externalConfigurationFiles: [], authenticationErrorCount: 0, databases: databases.map((name) => ({ name, bytes: 8388608 })),
  externalTablespaces: [], role: { name: "postgres", replication: true, superuser: true },
  availableWalSenders: 10, availableReplicationSlots: 10, databaseTime: "2026-09-12T00:00:00.000Z" });

function dockerSource(metadata, overrides = {}) {
  return async (args) => {
    if (args[0] === "container") return { exitCode: 0, stdout: JSON.stringify({ id: "a".repeat(64), imageId: "sha256:" + "b".repeat(64), running: true, paused: false, ...overrides.container }) };
    if (args[0] === "image") return { exitCode: 0, stdout: JSON.stringify({ id: "sha256:" + "b".repeat(64), os: "linux", architecture: "amd64", digests: ["pgvector/pgvector@sha256:" + "c".repeat(64)], ...overrides.image }) };
    if (args[0] === "exec" && args.includes("psql")) return { exitCode: 0, stdout: JSON.stringify(metadata) };
    if (args[0] === "exec" && args.includes("-C")) return { exitCode: overrides.postgresExit ?? 0,
      stdout: (overrides.startup?.[args.at(-1)] ?? { data_directory: metadata.dataDirectory, hba_file: metadata.hbaFile, ident_file: metadata.identFile }[args.at(-1)]) + "\n" };
    if (args[0] === "exec" && args.includes("find")) return { exitCode: 0, stdout: overrides.links ?? "" };
    if (args[0] === "exec" && args.includes("sh")) {
      const file = args.at(-1);
      if (overrides.files && Object.hasOwn(overrides.files, file)) return { exitCode: 0, stdout: overrides.files[file] };
      if ([metadata.configFile, metadata.hbaFile, metadata.identFile].includes(file)) return { exitCode: 0, stdout: "# empty configuration\n" };
      return { exitCode: 44, stdout: "" };
    }
    throw new Error("Unexpected mutating command during source inspection");
  };
}

test("缺任意业务库就拒绝备份，不能仅备份magictools空库", async () => {
  const metadata = source(); metadata.databases = [{ name: "magictools", bytes: 8388608 }];
  await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata) }), /缺少业务库.*applicant/);
});

test("停止或暂停的源、无固定digest的镜像以及错误平台不能进入备份", async () => {
  for (const overrides of [{ container: { running: false } }, { container: { paused: true } },
    { image: { digests: ["pgvector/pgvector:pg16"] } }, { image: { architecture: "unknown" } },
    { image: { id: "sha256:" + "d".repeat(64) } }]) {
    await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(source(), overrides) }), /备份源/);
  }
});

test("完整备份源返回固定镜像、PG身份和八库规模用于恢复校验", async () => {
  const metadata = source();
  const actual = await inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata) });
  assert.equal(actual.systemIdentifier, metadata.systemIdentifier);
  assert.equal(actual.serverVersion, 160015);
  assert.equal(actual.containerId, "a".repeat(64));
  assert.equal(actual.image.reference, "pgvector/pgvector@sha256:" + "c".repeat(64));
  assert.equal(actual.image.platform, "linux/amd64");
  assert.equal(actual.totalDatabaseBytes, 8 * 8388608);
});

test("不支持的主库布局或复制条件必须明确拒绝，不能产出不完整备份", async () => {
  for (const mutate of [
    (value) => { value.serverVersion = 170001; },
    (value) => { value.inRecovery = true; },
    (value) => { value.externalTablespaces = ["external_data"]; },
    (value) => { value.configFile = "/etc/postgresql/postgresql.conf"; },
    (value) => { value.externalConfigurationFiles = ["/etc/postgresql/extra.conf"]; },
    (value) => { value.availableWalSenders = 1; },
    (value) => { value.availableReplicationSlots = 0; },
    (value) => { value.role = { name: "reader", superuser: false, replication: false }; },
  ]) {
    const metadata = source(); mutate(metadata);
    await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata) }), /备份源/);
  }
});

test("数据目录里的配置或WAL符号链接不能绕过完整备份布局检查", async () => {
  await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, {
    executeDocker: dockerSource(source(), { links: "/var/lib/postgresql/data/pg_wal\n" }),
  }), /备份源.*链接/);
});

test("无效的集群身份、时间或容量不能进入备份清单", async () => {
  for (const mutate of [
    (value) => { value.systemIdentifier = "unknown"; },
    (value) => { value.databaseTime = "invalid"; },
    (value) => { value.databases[0].bytes = -1; },
    (value) => { value.databases.push(value.databases[0]); },
  ]) {
    const metadata = source(); mutate(metadata);
    await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata) }), /备份源/);
  }
});

test("Docker或SQL失败的敏感输出不会出现在公开错误中", async () => {
  await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, {
    executeDocker: async () => ({ exitCode: 1, stdout: "postgres://user:private-password@server/database" }),
  }), (error) => /备份源容器检查失败/.test(error.message) && !error.message.includes("private-password"));
});

test("磁盘上的PG或认证配置有解析错误时拒绝备份，即使源进程仍可查询", async () => {
  const metadata = source(); metadata.authenticationErrorCount = 1;
  await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata) }), /配置.*错误/);
});

// 正常配置视图含待重启的值时，启动配置解析仍可成功；不能按reload未应用判定语法错误。
test("合法待重启配置通过启动解析，真正的PG配置错误仍拒绝", async () => {
  const metadata = source();
  await assert.doesNotReject(inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata, { postgresExit: 0 }) }));
  await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata, { postgresExit: 1 }) }), /配置.*错误|配置.*失败/);
});

test("备份入口不能仅相信PG配置视图，空的外部include也必须拒绝", async () => {
  const metadata = source();
  await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata,
    { files: { [metadata.configFile]: "include '/outside/empty.conf'\n" } }) }), /目录以外/);
});

test("同时检查恢复启动后生效的认证路径，内部变更保留、外部变更拒绝", async () => {
  const metadata = source();
  for (const setting of ["hba_file", "ident_file"]) {
    await assert.rejects(inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata,
      { startup: { [setting]: "/outside/new-auth.conf" } }) }), /目录以外/);
  }
  const next = "/var/lib/postgresql/data/next-hba.conf";
  const actual = await inspectBackupSource({ container: "owned-postgres", databases }, { executeDocker: dockerSource(metadata,
    { startup: { hba_file: next }, files: { [next]: "# new internal auth\n" } }) });
  assert.ok(actual.configurationFiles.files.includes(next));
  assert.ok(actual.configurationFiles.files.includes(metadata.hbaFile));
});
