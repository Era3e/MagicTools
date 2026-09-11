import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";
import { verifyBackupManifest } from "./lib/backup-crypto.mjs";
import { recoveryObservation } from "./lib/backup-metrics.mjs";
import { captureValidationIdentity } from "./lib/quality-evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function validateBackup() {
  const id = randomBytes(8).toString("hex"); const project = "mt-validation-backup-" + id;
  const parent = join(root, ".qa/backup-validation"); mkdirSync(parent, { recursive: true });
  const directory = join(parent, id); mkdirSync(directory);
  const keyFile = join(directory, "private.key"); const credentialsFile = join(directory, "private.env");
  const password = randomBytes(24).toString("hex");
  const report = { schema: "magictools-backup-validation/1", id, project, success: false, startedAt: new Date().toISOString(),
    mode: { database: "real", containers: "real", encryption: "real", offsite: "not-run" }, checks: [], cleanup: "pending" };
  const source = project + "-source"; const volume = project + "-source-data";
  const resources = []; let restored;
  const docker = (args, input) => execFileSync("docker", args, { input, encoding: "utf8", windowsHide: true, timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024, env: { ...process.env, POSTGRES_PASSWORD: password, PGPASSWORD: password }, stdio: ["pipe", "pipe", "pipe"] }).trim();
  const sql = (container, database, query) => docker(["exec", "-i", "--user", "postgres", container, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], query);
  try {
    report.identity = captureValidationIdentity(root, process.env, id);
    writeFileSync(keyFile, randomBytes(32), { flag: "wx", mode: 0o600 });
    writeFileSync(credentialsFile, JSON.stringify({ schema: "magictools-backup-credentials/1", user: "postgres", password }), { flag: "wx", mode: 0o600 });
    const databaseNames = Object.keys(parse(readFileSync(join(root, "infra/ports.yaml"), "utf8"))).filter((name) => name !== "gateway").sort();
    const image = parse(readFileSync(join(root, "infra/compose.prod.yml"), "utf8")).services.postgres.image;
    if (!/@sha256:[a-f0-9]{64}$/.test(image)) throw new Error("validation source image must have a fixed digest");
    if (docker(["volume", "ls", "-q", "--filter", "name=" + volume]) || docker(["container", "ls", "-a", "-q", "--filter", "name=" + source])) throw new Error("validation source resources already exist");
    docker(["volume", "create", "--label", "magictools.backup.validation=" + id, volume]); resources.push({ kind: "volume", name: volume });
    docker(["run", "-d", "--name", source, "--label", "magictools.backup.validation=" + id, "--network", "none", "-e", "POSTGRES_PASSWORD",
      "--mount", "type=volume,source=" + volume + ",target=/var/lib/postgresql/data", image]); resources.push({ kind: "container", name: source });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { ready = sql(source, "postgres", "SELECT NOT pg_is_in_recovery() AND current_setting('listen_addresses') <> '';") === "t"; } catch { /* 初始化临时服务仅监听Unix socket，不能开始播种 */ }
      if (ready) break;
      await new Promise((done) => setTimeout(done, 500));
    }
    if (!ready) throw new Error("validation source not ready");
    const markers = [];
    for (const database of databaseNames) {
      report.stage = "seed-" + database;
      sql(source, "postgres", `CREATE DATABASE "${database}";`);
      sql(source, database, `CREATE TABLE backup_validation_marker(value text PRIMARY KEY, recorded_at timestamptz DEFAULT clock_timestamp()); INSERT INTO backup_validation_marker(value) VALUES ('${id}');`);
      markers.push({ database, ...JSON.parse(sql(source, database, "SELECT json_build_object('recordedAt',recorded_at,'recordedEpochMicroseconds',(extract(epoch FROM recorded_at)*1000000)::bigint::text,'confirmedAt',clock_timestamp()) FROM backup_validation_marker;")) });
    }
    sql(source, "scholar", "CREATE EXTENSION vector; CREATE TABLE backup_vectors(value vector(3)); INSERT INTO backup_vectors VALUES ('[1,2,3]');");
    sql(source, "postgres", `CREATE ROLE backup_validation_reader LOGIN PASSWORD '${password}';`);
    sql(source, "manager", "GRANT SELECT ON backup_validation_marker TO backup_validation_reader;");
    report.stage = "backup-create";
    const command = (args) => JSON.parse(execFileSync(process.execPath, [join(root, "infra/scripts/backup.mjs"), ...args],
      { cwd: root, windowsHide: true, encoding: "utf8", timeout: 15 * 60_000, maxBuffer: 4 * 1024 * 1024 }));
    const created = command(["create", "--container", source, "--directory", join(directory, "store"), "--key-file", keyFile, "--credentials-file", credentialsFile]);
    if (created.success !== true) throw new Error("backup CLI did not confirm completion");
    const manifest = verifyBackupManifest(JSON.parse(readFileSync(join(created.directory, "backup.json"), "utf8")), readFileSync(keyFile));
    report.backupId = created.backupId;
    report.checks.push({ name: "create-authenticated-physical-backup", status: "passed", directory: created.directory });
    sql(source, "manager", "INSERT INTO backup_validation_marker(value) VALUES ('after-backup');");
    const missingMarker = JSON.parse(sql(source, "manager", "SELECT json_build_object('recordedAt',recorded_at,'confirmedAt',clock_timestamp()) FROM backup_validation_marker WHERE value='after-backup';"));
    report.simulatedIncidentAt = sql(source, "postgres", "SELECT clock_timestamp();");
    const restoreStarted = performance.now();
    report.stage = "backup-restore";
    restored = command(["restore", "--backup", created.directory, "--key-file", keyFile, "--target", project + "-restored"]);
    if (restored.success !== true) throw new Error("restore CLI did not confirm completion");
    for (const database of databaseNames) {
      if (sql(restored.container, database, "SELECT value FROM backup_validation_marker;") !== id) throw new Error("restored data boundary mismatch");
      const restoredTime = sql(restored.container, database, "SELECT (extract(epoch FROM recorded_at)*1000000)::bigint::text FROM backup_validation_marker;");
      if (restoredTime !== markers.find((marker) => marker.database === database).recordedEpochMicroseconds) throw new Error("restored marker timestamp mismatch");
    }
    if (sql(restored.container, "scholar", "SELECT value <-> '[1,2,3]'::vector FROM backup_vectors;") !== "0") throw new Error("restored vector mismatch");
    const reader = ["exec", "-i", "-e", "PGPASSWORD", restored.container, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-U", "backup_validation_reader", "-d", "manager"];
    if (docker(reader, "SELECT value FROM backup_validation_marker;") !== id) throw new Error("restored role password or read permission mismatch");
    let denied = false;
    try { docker(reader, "\\set VERBOSITY sqlstate\nINSERT INTO backup_validation_marker(value) VALUES ('forbidden');"); }
    catch (error) { denied = /\b42501\b/.test(String(error.stderr)); }
    if (!denied) throw new Error("restored role write denial not enforced");
    const restoreMilliseconds = Math.round(performance.now() - restoreStarted);
    const latest = [...markers].sort((a, b) => {
      const difference = BigInt(b.recordedEpochMicroseconds) - BigInt(a.recordedEpochMicroseconds);
      return difference < 0n ? -1 : difference > 0n ? 1 : 0;
    })[0];
    report.recovery = recoveryObservation({ incidentAt: report.simulatedIncidentAt, guaranteedCoverageAt: manifest.recoveryPointLowerBoundAt,
      restoredMarker: latest, missingMarker, restoreMilliseconds, encryptedBytes: manifest.files.reduce((total, file) => total + file.encryptedBytes, 0),
      databaseBytes: manifest.source.totalDatabaseBytes, businessDatabases: databaseNames.length, imageCache: "warm" });
    report.checks.push({ name: "restore-eight-databases-roles-vector-and-data-boundary", status: "passed", databases: databaseNames.length,
      elapsedMilliseconds: restoreMilliseconds, catalogVerified: restored.catalogVerified });
    report.stage = "verify-command";
    const verification = command(["verify", "--backup", created.directory, "--key-file", keyFile]);
    if (verification.success !== true || verification.cleanup !== "passed") throw new Error("verify CLI did not complete");
    for (const kind of ["container", "network", "volume"]) {
      if (docker([kind, "ls", ...(kind === "container" ? ["-a"] : []), "-q", "--filter", "label=magictools.backup.operation=" + verification.operationId])) throw new Error("verify CLI left owned resources");
    }
    report.checks.push({ name: "verify-command-and-resource-cleanup", status: "passed", operationId: verification.operationId });
    report.success = true; report.stage = "complete";
  } catch (error) {
    report.error = String(error.message).replaceAll(password, "[redacted]").split("\n")[0];
    if (error.stderr) report.processError = String(error.stderr).replaceAll(password, "[redacted]").split("\n")[0];
  }
  finally {
    const cleanupErrors = [];
    if (restored) {
      for (const [kind, name] of [["container", restored.container], ["network", restored.network], ["volume", restored.volume]]) {
        try {
          const meta = JSON.parse(docker([kind, "inspect", name]))[0];
          if ((kind === "container" ? meta.Config.Labels : meta.Labels)?.["magictools.backup.operation"] !== restored.operationId) throw new Error("ownership mismatch");
          docker(kind === "container" ? ["rm", "-f", "-v", name] : [kind, "rm", name]);
        } catch { cleanupErrors.push(kind + ":" + name); }
      }
    }
    for (const resource of resources.reverse()) {
      try {
        const meta = JSON.parse(docker([resource.kind, "inspect", resource.name]))[0];
        if ((resource.kind === "container" ? meta.Config.Labels : meta.Labels)?.["magictools.backup.validation"] !== id) throw new Error("ownership mismatch");
        docker(resource.kind === "container" ? ["rm", "-f", "-v", resource.name] : [resource.kind, "rm", resource.name]);
      } catch { cleanupErrors.push(resource.kind + ":" + resource.name); }
    }
    for (const file of [keyFile, credentialsFile]) try { if (existsSync(file)) unlinkSync(file); } catch { cleanupErrors.push("private-file"); }
    report.cleanup = cleanupErrors.length ? "failed" : "passed"; report.cleanupErrors = cleanupErrors;
    if (cleanupErrors.length) report.success = false;
    if (report.identity) {
      try {
        const current = captureValidationIdentity(root, process.env, id);
        if (current.fingerprint !== report.identity.fingerprint || current.checkoutSha !== report.identity.checkoutSha) throw new Error("validation source changed during execution");
      } catch (error) { report.success = false; report.identityError = error.message; }
    }
    report.finishedAt = new Date().toISOString();
    writeFileSync(join(directory, "summary.json"), JSON.stringify(report, null, 2) + "\n");
  }
  if (!report.success) throw new Error("备份恢复验证失败，见 " + join(directory, "summary.json"));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  validateBackup().then((report) => console.log(JSON.stringify(report))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
