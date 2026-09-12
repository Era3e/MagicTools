import { digestBytes } from "./release-artifacts.mjs";

// Fresh Docker and PostgreSQL I/O state for each test; no real resources are used.
export function recoveryDatabaseFixture({ name = "recovered-test" } = {}) {
  const databases = ["applicant", "assessor", "assistant", "designer", "gatherer", "investigator", "manager", "scholar"];
  const operation = "1".repeat(16), backupId = "2".repeat(16), id = "a".repeat(64), networkId = "b".repeat(64);
  const networkName = name + "-net", volumeName = name + "-data";
  const reference = "pgvector/pgvector@sha256:" + "c".repeat(64), imageId = "sha256:" + "e".repeat(64);
  const created = "2026-09-12T01:59:00Z", finished = "2026-09-12T02:00:00.000Z";
  const source = { systemIdentifier: "1234567890123456", serverVersion: 160015, image: { reference, platform: "linux/amd64" },
    dataDirectory: "/var/lib/postgresql/data", configFile: "/var/lib/postgresql/data/postgresql.conf" };
  const labels = { "magictools.backup.operation": operation };
  const volume = { Name: volumeName, Driver: "local", CreatedAt: created, Mountpoint: "/var/lib/docker/volumes/" + volumeName + "/_data", Labels: labels, Options: null };
  const container = { Id: id, Name: "/" + name, Created: created, Image: imageId,
    State: { Status: "running", Running: true, Paused: false, Restarting: false },
    Config: { Image: reference, Labels: labels, Env: ["PGDATA=" + source.dataDirectory], Entrypoint: ["docker-entrypoint.sh"], Cmd: ["postgres", "-c", "config_file=" + source.configFile] },
    HostConfig: { NetworkMode: networkName, Privileged: false, PublishAllPorts: false, PortBindings: {}, Tmpfs: null },
    Mounts: [{ Type: "volume", Name: volumeName, Driver: "local", Source: volume.Mountpoint, Destination: source.dataDirectory, RW: true }],
    NetworkSettings: { Networks: { [networkName]: { NetworkID: networkId } }, Ports: { "5432/tcp": null } } };
  const network = { Id: networkId, Name: networkName, Created: created, Internal: true, Driver: "bridge", Scope: "local", Labels: labels, Containers: { [id]: { Name: name } } };
  const image = { Id: imageId, Os: "linux", Architecture: "amd64", RepoDigests: [reference], Config: { Volumes: { "/var/lib/postgresql/data": {} } } };
  const global = { databases: [...databases, "postgres"].sort().map((db) => ({ name: db, owner: "postgres", encoding: "UTF8" })),
    roles: [{ rolname: "postgres", rolsuper: true }], memberships: [] };
  const extensions = global.databases.map(({ name: db }) => ({ database: db, extensions: [{ name: "plpgsql", version: "1.0" }] }));
  const catalog = { ...global, extensions };
  const manifest = { schema: "magictools-backup/1", status: "complete", backupId, source, databases, catalogSha256: digestBytes(JSON.stringify(catalog)) };
  const receipt = { schema: "magictools-backup-attempt/1", operation: "restore", success: true, stage: "complete", operationId: operation, backupId, finishedAt: finished,
    result: { operationId: operation, backupId, container: name, network: networkName, volume: volumeName, catalogVerified: true } };
  const binding = { schema: "magictools-restored-database/1", mode: "restored", restoreOperationId: operation, backupId, manifestSha256: "3".repeat(64), catalogSha256: manifest.catalogSha256, restoredAt: finished,
    container: { name, id }, network: { name: networkName, id: networkId }, volume: { name: volumeName, createdAt: created }, source, databases };
  const resources = { container: new Map([[name, container]]), network: new Map([[networkName, network]]), volume: new Map([[volumeName, volume]]), image: new Map([[reference, image], [imageId, image]]) };
  const calls = [], queries = [];
  const deps = {
    async runDocker(args) {
      calls.push(args);
      const [kind, command, target] = args;
      if (kind === "create") {
        const get = (key) => args[args.indexOf(key) + 1];
        const claimName = get("--name");
        if (resources.container.has(claimName)) return { exitCode: 1, stdout: "" };
        const claimLabels = Object.fromEntries(args.flatMap((arg, index) => arg === "--label" ? [args[index + 1].split(/=(.*)/s).slice(0, 2)] : []));
        const tmpfs = Object.fromEntries(args.flatMap((arg, index) => arg === "--tmpfs" ? [args[index + 1].split(/:(.*)/s).slice(0, 2)] : []));
        const claim = { Id: "f".repeat(64), Name: "/" + claimName, Created: finished, Image: imageId,
          State: { Status: "created", Running: false, Paused: false, Restarting: false },
          Config: { Image: args.at(-2), Labels: claimLabels, Entrypoint: [get("--entrypoint")], Cmd: [args.at(-1)] },
          HostConfig: { NetworkMode: get("--network"), PublishAllPorts: false, Privileged: false, PortBindings: {}, Tmpfs: tmpfs, Binds: null, VolumesFrom: null },
          Mounts: [], NetworkSettings: { Networks: { none: {} }, Ports: {} } };
        resources.container.set(claimName, claim);
        return { exitCode: 0, stdout: claim.Id };
      }
      if (command === "inspect") {
        const value = resources[kind]?.get(target) ?? [...(resources[kind]?.values() ?? [])].find((entry) => entry.Id === target || entry.Name === target);
        return value ? { exitCode: 0, stdout: JSON.stringify([value]) } : { exitCode: 1, stdout: "" };
      }
      if (command === "ls") {
        const filters = args.flatMap((arg, index) => arg === "--filter" ? [args[index + 1]] : []);
        const values = [...resources[kind].values()].filter((entry) => filters.every((filter) => {
          if (filter.startsWith("label=")) { const [key, ...rest] = filter.slice(6).split("="); return (kind === "container" ? entry.Config.Labels : entry.Labels)?.[key] === rest.join("="); }
          if (filter.startsWith("volume=")) return entry.Mounts?.some((mount) => mount.Name === filter.slice(7));
          throw new Error("Unexpected filter " + filter);
        }));
        const format = args[args.indexOf("--format") + 1];
        return { exitCode: 0, stdout: values.map((entry) => format === "{{.Name}}" ? entry.Name : format === "{{.Names}}" ? entry.Name.slice(1) : entry.Id).join("\n") };
      }
      throw new Error("Unexpected Docker I/O " + args.join(" "));
    },
    async databaseQuery(target, database, sql) {
      queries.push({ target, database, sql });
      if (sql.includes("pg_control_system()")) return JSON.stringify({ systemIdentifier: source.systemIdentifier, serverVersion: source.serverVersion, dataDirectory: source.dataDirectory, configFile: source.configFile, inRecovery: false });
      if (sql.includes("'databases'")) return JSON.stringify(global);
      if (sql.includes("pg_extension")) return JSON.stringify(extensions.find((entry) => entry.database === database)?.extensions ?? []);
      throw new Error("Unexpected database I/O");
    },
  };
  return { manifest, receipt, binding, container, network, volume, image, resources, calls, queries, deps, catalog, global, extensions };
}
