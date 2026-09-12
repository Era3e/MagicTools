import { posix } from "node:path";
import { runDocker, databaseQuery } from "./backup-docker.mjs";
import { databaseCatalog } from "./backup-catalog.mjs";
import { digestBytes, validateRestoredBinding } from "./release-artifacts.mjs";

const DATABASES = ["applicant", "assessor", "assistant", "designer", "gatherer", "investigator", "manager", "scholar"];
const SERVICES = new Set(["gateway", ...DATABASES.flatMap((app) => [app + "-server", app + "-web"])]);
const id = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const labelsOf = (kind, value) => kind === "container" ? value.Config?.Labels : value.Labels;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const validTime = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const bindingHash = (binding) => digestBytes(JSON.stringify(binding));

function canonicalBinding(value) {
  const binding = validateRestoredBinding(value);
  if (!same(binding.databases, DATABASES)) throw new Error("恢复绑定必须覆盖完整八个业务库");
  return binding;
}
function ownership(owner, project) {
  if (!id(owner) || typeof project !== "string" || !/^[a-z][a-z0-9-]{2,48}$/.test(project)) throw new Error("恢复部署归属或项目名无效");
}
function io(dependencies) {
  const execute = dependencies.runDocker ?? runDocker;
  return {
    async run(args) {
      try {
        const result = await execute(args);
        if (!result || typeof result.stdout !== "string" || !Number.isInteger(result.exitCode)) throw new Error();
        return result;
      } catch { throw new Error("恢复资源 Docker 操作无法确认"); }
    },
    async inspect(kind, name) {
      const result = await this.run([kind, "inspect", name]);
      if (result.exitCode !== 0) throw new Error("恢复资源 " + kind + " 检查失败");
      try {
        const values = JSON.parse(result.stdout);
        if (!Array.isArray(values) || values.length !== 1 || !values[0] || typeof values[0] !== "object") throw new Error();
        return values[0];
      } catch { throw new Error("恢复资源 " + kind + " 元数据无效"); }
    },
    async query(container, database, sql) {
      try { return await (dependencies.databaseQuery ?? databaseQuery)(container, database, sql); }
      catch { throw new Error("恢复数据库查询失败"); }
    },
  };
}

function checkBackupLabel(kind, value, operation) {
  const labels = labelsOf(kind, value);
  if (labels?.["magictools.backup.operation"] !== operation || labels?.["com.docker.compose.project"]) throw new Error("恢复资源 " + kind + " operation 归属不符");
}

async function readResources(binding, access) {
  const container = await access.inspect("container", binding.container.name);
  const network = await access.inspect("network", binding.network.name);
  const volume = await access.inspect("volume", binding.volume.name);
  for (const [kind, value] of [["container", container], ["network", network], ["volume", volume]]) checkBackupLabel(kind, value, binding.restoreOperationId);
  if (container.Id !== binding.container.id || container.Name !== "/" + binding.container.name || !validTime(container.Created) ||
    container.State?.Running !== true || container.State?.Paused !== false || container.State?.Restarting !== false || container.State?.Status !== "running") throw new Error("恢复容器身份或运行状态不符");
  if (network.Id !== binding.network.id || network.Name !== binding.network.name || !validTime(network.Created) || network.Internal !== true || network.Driver !== "bridge" || network.Scope !== "local") throw new Error("恢复网络身份或内部 bridge 属性不符");
  if (volume.Name !== binding.volume.name || volume.CreatedAt !== binding.volume.createdAt || volume.Driver !== "local" ||
    !volume.Mountpoint || Object.keys(volume.Options ?? {}).length) throw new Error("恢复卷身份或存储配置不符");
  const mounts = container.Mounts;
  if (!Array.isArray(mounts) || mounts.length !== 1 || mounts[0].Type !== "volume" || mounts[0].Name !== binding.volume.name ||
    mounts[0].Source !== volume.Mountpoint || mounts[0].Destination !== binding.source.dataDirectory || mounts[0].RW !== true) throw new Error("恢复数据卷实际挂载不符");
  const users = await resourceList(access, "container", ["volume=" + binding.volume.name], "{{.ID}}");
  if (!same(users, [binding.container.id])) throw new Error("恢复数据卷被其它容器使用或挂载状态无法确认");
  if (!same(Object.keys(container.NetworkSettings?.Networks ?? {}), [binding.network.name]) ||
    container.NetworkSettings.Networks[binding.network.name].NetworkID !== binding.network.id ||
    ![binding.network.name, binding.network.id].includes(container.HostConfig?.NetworkMode) || container.HostConfig?.PublishAllPorts !== false ||
    Object.keys(container.HostConfig?.PortBindings ?? {}).length || Object.values(container.NetworkSettings?.Ports ?? {}).some((ports) => Array.isArray(ports) && ports.length)) throw new Error("恢复数据库必须仅连接指定内部网络且不发布宿主端口");
  if (container.Config?.Image !== binding.source.image.reference || !/^sha256:[a-f0-9]{64}$/.test(container.Image ?? "")) throw new Error("恢复容器固定镜像不符");
  const image = await access.inspect("image", binding.source.image.reference);
  if (image.Id !== container.Image || image.Os + "/" + image.Architecture !== binding.source.image.platform || !image.RepoDigests?.includes(binding.source.image.reference)) throw new Error("恢复镜像身份或平台不符");
  const dataVariables = (container.Config.Env ?? []).filter((entry) => typeof entry === "string" && entry.startsWith("PGDATA="));
  if (!same(dataVariables, ["PGDATA=" + binding.source.dataDirectory]) ||
    !same(container.Config.Cmd, ["postgres", "-c", "config_file=" + binding.source.configFile])) throw new Error("恢复容器 PGDATA 或 config_file 启动配置不符");
  return { container, network, volume };
}

async function verify(binding, { owner, project, initial }, access) {
  const resources = await readResources(binding, access);
  const members = resources.network.Containers;
  if (!members || typeof members !== "object" || Array.isArray(members) || members[binding.container.id]?.Name !== binding.container.name) throw new Error("恢复网络缺少预期数据库成员");
  for (const [memberId, member] of Object.entries(members)) {
    if (memberId === binding.container.id) continue;
    if (initial || !id(memberId)) throw new Error("首次交接网络必须仅包含恢复数据库");
    const application = await access.inspect("container", memberId);
    const labels = application.Config?.Labels;
    if (application.Id !== memberId || application.Name !== "/" + member.Name || labels?.["magictools.deployment"] !== owner ||
      labels?.["com.docker.compose.project"] !== project || !DATABASES.some((app) => app + "-server" === labels?.["com.docker.compose.service"]) ||
      application.NetworkSettings?.Networks?.[binding.network.name]?.NetworkID !== binding.network.id) throw new Error("恢复网络存在非本部署后端成员");
    if (Object.keys(application.NetworkSettings.Networks).some((name) => ![binding.network.name, project + "_default"].includes(name))) throw new Error("恢复网络应用存在额外网络连接");
  }
  let actual;
  try {
    actual = JSON.parse(await access.query(binding.container.id, "postgres", `SELECT json_build_object(
      'systemIdentifier',(SELECT system_identifier::text FROM pg_control_system()),
      'serverVersion',current_setting('server_version_num')::int,
      'inRecovery',pg_is_in_recovery(),'dataDirectory',current_setting('data_directory'),'configFile',current_setting('config_file'));`));
  } catch { throw new Error("恢复数据库身份查询失败"); }
  if (actual?.systemIdentifier !== binding.source.systemIdentifier || actual.serverVersion !== binding.source.serverVersion || actual.inRecovery !== false ||
    actual.dataDirectory !== binding.source.dataDirectory || actual.configFile !== binding.source.configFile) throw new Error("恢复数据库系统标识、版本或运行配置不符");
  let catalog;
  try { catalog = await databaseCatalog(binding.container.id, binding.databases, (container, database, sql) => access.query(container, database, sql)); }
  catch { throw new Error("恢复数据库八库目录检查失败"); }
  const catalogSha256 = digestBytes(JSON.stringify(catalog));
  if (initial && catalogSha256 !== binding.catalogSha256) throw new Error("首次恢复数据库目录哈希与备份不符");
  return { bindingHash: bindingHash(binding), restoreOperationId: binding.restoreOperationId, backupId: binding.backupId,
    container: binding.container, network: binding.network, volume: binding.volume,
    systemIdentifier: actual.systemIdentifier, serverVersion: actual.serverVersion, databases: binding.databases,
    catalogSha256, initialCatalogMatched: initial ? true : null, running: true, internalNetwork: true };
}

export async function captureRestoredBinding({ manifest, manifestSha256, restoreReceipt }, dependencies = {}) {
  const receipt = restoreReceipt, result = receipt?.result;
  if (manifest?.schema !== "magictools-backup/1" || manifest.status !== "complete" || receipt?.schema !== "magictools-backup-attempt/1" ||
    receipt.operation !== "restore" || receipt.success !== true || receipt.stage !== "complete" || receipt.backupId !== manifest.backupId ||
    result?.catalogVerified !== true || result.operationId !== receipt.operationId || result.backupId !== manifest.backupId ||
    receipt.error || receipt.cleanupError || receipt.lockError) throw new Error("成功恢复回执与已认证备份不匹配");
  const access = io(dependencies);
  const source = manifest.source;
  // Validate every user-controlled name before the first Docker/PG operation.
  const template = canonicalBinding({ schema: "magictools-restored-database/1", mode: "restored", restoreOperationId: receipt.operationId,
    backupId: manifest.backupId, manifestSha256, catalogSha256: manifest.catalogSha256, restoredAt: receipt.finishedAt,
    container: { name: result.container, id: "0".repeat(64) }, network: { name: result.network, id: "0".repeat(64) },
    volume: { name: result.volume, createdAt: receipt.finishedAt },
    source: { systemIdentifier: source?.systemIdentifier, serverVersion: source?.serverVersion, image: { reference: source?.image?.reference, platform: source?.image?.platform },
      dataDirectory: source?.dataDirectory, configFile: source?.configFile }, databases: manifest.databases });
  const container = await access.inspect("container", template.container.name);
  const network = await access.inspect("network", template.network.name);
  const volume = await access.inspect("volume", template.volume.name);
  const binding = canonicalBinding({ ...template, container: { name: template.container.name, id: container.Id }, network: { name: template.network.name, id: network.Id },
    volume: { name: template.volume.name, createdAt: volume.CreatedAt } });
  await verify(binding, { initial: true }, access);
  return binding;
}

export async function verifyRestoredDatabase(value, { owner, project, initial = false }, dependencies = {}) {
  ownership(owner, project);
  if (typeof initial !== "boolean") throw new Error("恢复数据库初次校验模式无效");
  return verify(canonicalBinding(value), { owner, project, initial }, io(dependencies));
}

const TMPFS_OPTIONS = "rw,noexec,nosuid,size=1048576";
function temporaryImageVolumes(image) {
  if (!image.Config || typeof image.Config !== "object" || Array.isArray(image.Config) ||
    (image.Config.Volumes != null && (typeof image.Config.Volumes !== "object" || Array.isArray(image.Config.Volumes)))) throw new Error("声明镜像的卷定义无效");
  const paths = Object.keys(image.Config.Volumes ?? {}).sort();
  if (paths.some((path) => !path.startsWith("/") || path === "/" || posix.normalize(path) !== path || /[:\0\r\n]/.test(path))) throw new Error("声明镜像的卷路径无效");
  return paths;
}

function verifyClaim(claim, binding, { owner, project, hash, name }, image, temporaryVolumes) {
  const labels = claim.Config?.Labels;
  if (!id(claim.Id) || claim.Name !== "/" + name || !validTime(claim.Created) ||
    labels?.["magictools.recovery.claim"] !== "1" || labels?.["magictools.recovery.binding"] !== hash ||
    labels?.["magictools.recovery.operation"] !== binding.restoreOperationId || labels?.["magictools.recovery.project"] !== project ||
    labels?.["magictools.deployment"] !== owner || labels?.["com.docker.compose.project"] || labels?.["magictools.backup.operation"]) throw new Error("恢复实例已被其它部署占用，或声明身份不符");
  if (claim.State?.Status !== "created" || claim.State?.Running !== false || claim.State?.Paused !== false || claim.State?.Restarting !== false ||
    claim.Config.Image !== binding.source.image.reference || claim.Image !== image.Id ||
    !same(claim.Config.Entrypoint, ["sleep"]) || !same(claim.Config.Cmd, ["infinity"])) throw new Error("恢复归属声明已被启动或运行配置变化，拒绝复用");
  const host = claim.HostConfig;
  const networks = Object.keys(claim.NetworkSettings?.Networks ?? {});
  if (host?.NetworkMode !== "none" || (networks.length && !same(networks, ["none"])) || host.Privileged !== false ||
    host.PublishAllPorts !== false || Object.keys(host.PortBindings ?? {}).length || (host.Binds ?? []).length || (host.VolumesFrom ?? []).length || (host.Mounts ?? []).length ||
    !Array.isArray(claim.Mounts) || claim.Mounts.some((mount) => mount.Type !== "tmpfs" || !temporaryVolumes.includes(mount.Destination)) ||
    !same(Object.keys(host.Tmpfs ?? {}).sort(), temporaryVolumes) || Object.values(host.Tmpfs ?? {}).some((options) => options !== TMPFS_OPTIONS)) throw new Error("恢复归属声明包含数据挂载或网络访问，拒绝复用");
}

async function claimImage(binding, access) {
  const image = await access.inspect("image", binding.source.image.reference);
  if (!/^sha256:[a-f0-9]{64}$/.test(image.Id ?? "") || image.Os + "/" + image.Architecture !== binding.source.image.platform || !image.RepoDigests?.includes(binding.source.image.reference)) throw new Error("恢复归属声明镜像或平台不符");
  return { image, temporaryVolumes: temporaryImageVolumes(image) };
}

export async function claimRestoredDatabase(value, { owner, project }, dependencies = {}) {
  ownership(owner, project);
  const binding = canonicalBinding(value), access = io(dependencies), hash = bindingHash(binding);
  const name = "mt-recovery-" + binding.restoreOperationId + "-claim";
  const { image, temporaryVolumes } = await claimImage(binding, access);
  const labels = { "magictools.recovery.claim": "1", "magictools.recovery.binding": hash, "magictools.recovery.operation": binding.restoreOperationId,
    "magictools.recovery.project": project, "magictools.deployment": owner };
  // Docker's unique container name is the atomic cross-state-directory claim.
  // A created-only placeholder is never started or attached to the restored data.
  const result = await access.run(["create", "--pull", "never", "--name", name, "--network", "none", "--platform", binding.source.image.platform,
    ...Object.entries(labels).flatMap(([key, label]) => ["--label", key + "=" + label]),
    ...temporaryVolumes.flatMap((path) => ["--tmpfs", path + ":" + TMPFS_OPTIONS]),
    "--entrypoint", "sleep", binding.source.image.reference, "infinity"]);
  const claim = await access.inspect("container", name);
  verifyClaim(claim, binding, { owner, project, hash, name }, image, temporaryVolumes);
  if (result.exitCode === 0 && result.stdout.trim() !== claim.Id) throw new Error("恢复归属声明创建结果与实际身份不符");
  return { name, id: claim.Id, owner, project, bindingHash: hash, reused: result.exitCode !== 0 };
}

async function resourceList(access, kind, filters, format) {
  const result = await access.run([kind, "ls", ...kind === "container" ? ["--all", "--no-trunc"] : kind === "network" ? ["--no-trunc"] : [],
    ...filters.flatMap((filter) => ["--filter", filter]), "--format", format]);
  if (result.exitCode !== 0) throw new Error("恢复项目资源清单无法确认");
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

export async function assertRecoveryProjectOwnership(project, owner, dependencies = {}, { restoredBinding } = {}) {
  ownership(owner, project);
  const access = io(dependencies), result = { containers: [], networks: [], volumes: [] };
  const binding = restoredBinding === undefined ? null : canonicalBinding(restoredBinding);
  const ingressName = project + "_ingress";
  // The optional exception is a verified resource identity, never a name allowlist.
  if (binding) await readResources(binding, access);
  const excluded = async (kind, value) => {
    if (!binding) return false;
    const name = kind === "container" ? value.Name?.slice(1) : value.Name, expected = binding[kind];
    if (expected && name === expected.name) {
      checkBackupLabel(kind, value, binding.restoreOperationId);
      if (kind === "volume" ? value.CreatedAt !== expected.createdAt : value.Id !== expected.id) throw new Error("显式恢复资源身份在项目检查期间变化");
      return true;
    }
    const claimName = "mt-recovery-" + binding.restoreOperationId + "-claim";
    if (kind === "container" && name === claimName) {
      const { image, temporaryVolumes } = await claimImage(binding, access);
      verifyClaim(value, binding, { owner, project, hash: bindingHash(binding), name: claimName }, image, temporaryVolumes);
      return true;
    }
    return false;
  };
  const kinds = [["container", "containers", "容器"], ["network", "networks", "网络"], ["volume", "volumes", "卷"]];
  const check = (kind, value, description) => {
    const labels = labelsOf(kind, value);
    if (labels?.["magictools.deployment"] !== owner || labels?.["com.docker.compose.project"] !== project) throw new Error("项目" + description + "归属不符，拒绝接管已有资源");
    if (kind === "container") {
      if (!id(value.Id) || typeof value.Name !== "string" || !value.Name.startsWith("/") || !SERVICES.has(labels["com.docker.compose.service"])) throw new Error("项目容器身份或服务归属不符");
      return { name: value.Name.slice(1), id: value.Id, service: labels["com.docker.compose.service"] };
    }
    if (kind === "network") {
      if (!id(value.Id) || typeof value.Name !== "string" || !value.Name.startsWith(project + "_") || value.Driver !== "bridge" || value.Scope !== "local") throw new Error("项目网络身份或隔离属性不符");
      if (value.Name === ingressName) {
        if (!binding || value.Internal !== false || labels["magictools.recovery.network"] !== "ingress") throw new Error("项目 ingress 网络缺少受控恢复入口身份");
      } else if (value.Internal !== true || labels["magictools.recovery.network"] === "ingress") throw new Error("项目网络身份或隔离属性不符");
      return { name: value.Name, id: value.Id };
    }
    if (typeof value.Name !== "string" || !validTime(value.CreatedAt)) throw new Error("项目卷身份无效");
    return { name: value.Name, createdAt: value.CreatedAt };
  };
  for (const [kind, field, description] of kinds) {
    const identifiers = await resourceList(access, kind, ["label=com.docker.compose.project=" + project], kind === "volume" ? "{{.Name}}" : "{{.ID}}");
    if (kind !== "volume" && identifiers.some((reference) => !id(reference))) throw new Error("项目资源清单标识无效");
    const names = (await resourceList(access, kind, [], kind === "container" ? "{{.Names}}" : "{{.Name}}"))
      .filter((name) => name.startsWith(project + "-") || name.startsWith(project + "_"));
    for (const reference of new Set([...identifiers, ...names])) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(reference)) throw new Error("项目资源清单标识无效");
      const value = await access.inspect(kind, reference), actualName = kind === "container" ? value.Name?.slice(1) : value.Name;
      if (reference !== actualName && reference !== value.Id) throw new Error("项目资源清单与实际身份不符");
      if (await excluded(kind, value)) continue;
      const actual = check(kind, value, description), previous = result[field].find((entry) => entry.name === actual.name);
      if (previous && !same(previous, actual)) throw new Error("项目资源在归属检查期间被替换");
      if (!previous) result[field].push(actual);
    }
  }
  // An unlabeled orphan network is invisible to the Compose label filter.
  const defaultName = project + "_default";
  const inspected = await access.run(["network", "inspect", defaultName]);
  if (inspected.exitCode === 0) {
    let values;
    try { values = JSON.parse(inspected.stdout); } catch { throw new Error("项目默认网络元数据无效"); }
    if (!Array.isArray(values) || values.length !== 1 || values[0]?.Name !== defaultName) throw new Error("项目默认网络身份无法确认");
    const actual = check("network", values[0], "网络"), listed = result.networks.find((entry) => entry.name === defaultName);
    if (listed && listed.id !== actual.id) throw new Error("项目默认网络在检查期间被替换");
    if (!listed) result.networks.push(actual);
  } else if ((await resourceList(access, "network", [], "{{.Name}}")).includes(defaultName)) {
    throw new Error("项目默认网络存在但无法读取，拒绝继续");
  }
  const defaultNetwork = result.networks.find((network) => network.name === defaultName);
  const ingressNetwork = result.networks.find((network) => network.name === ingressName);
  for (const expected of result.containers) {
    const application = await access.inspect("container", expected.id);
    if (!same(check("container", application, "容器"), expected)) throw new Error("项目应用身份在网络检查期间变化");
    if (!defaultNetwork) throw new Error("项目应用缺少实际默认网络");
    const allowed = new Map([[defaultName, defaultNetwork.id]]);
    if (binding && DATABASES.some((app) => expected.service === app + "-server")) allowed.set(binding.network.name, binding.network.id);
    if (binding && expected.service === "gateway" && ingressNetwork) allowed.set(ingressName, ingressNetwork.id);
    const mode = application.HostConfig?.NetworkMode;
    if (![...allowed.keys(), ...allowed.values()].includes(mode)) throw new Error("项目应用网络计划含未知或外部网络");
    const networks = application.NetworkSettings?.Networks;
    if (!networks || typeof networks !== "object" || Array.isArray(networks)) throw new Error("项目应用网络状态无法确认");
    const pending = application.State?.Status === "created" && application.State?.Running === false;
    for (const [name, endpoint] of Object.entries(networks)) {
      if (!allowed.has(name)) throw new Error("项目应用连接未知或外部网络");
      if (!endpoint || typeof endpoint !== "object" || Array.isArray(endpoint) ||
        (endpoint.NetworkID !== allowed.get(name) && !(pending && endpoint.NetworkID === ""))) throw new Error("项目应用网络实际身份不符");
    }
    if (!pending && !Object.hasOwn(networks, defaultName)) throw new Error("项目应用未连接预期默认网络");
  }
  for (const expected of result.networks) {
    const network = await access.inspect("network", expected.id);
    if (network.Id !== expected.id || network.Name !== expected.name) throw new Error("项目网络身份在检查期间变化");
    check("network", network, "网络");
    if (!network.Containers || typeof network.Containers !== "object" || Array.isArray(network.Containers)) throw new Error("项目网络成员无法确认");
    for (const [memberId, member] of Object.entries(network.Containers)) {
      const application = result.containers.find((entry) => entry.id === memberId && entry.name === member.Name);
      if (!application) throw new Error("项目网络包含非本部署容器，拒绝继续");
      if (expected.name === ingressName && application.service !== "gateway") throw new Error("恢复 ingress 网络只能包含本部署 gateway");
    }
  }
  for (const entries of Object.values(result)) entries.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}
