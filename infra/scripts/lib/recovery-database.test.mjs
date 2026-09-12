import test from "node:test";
import assert from "node:assert/strict";
import { recoveryDatabaseFixture as fixture } from "./recovery-database-fixture.mjs";
import { captureRestoredBinding, verifyRestoredDatabase, claimRestoredDatabase, assertRecoveryProjectOwnership } from "./recovery-database.mjs";

const databases = ["applicant", "assessor", "assistant", "designer", "gatherer", "investigator", "manager", "scholar"];
const owner = "d".repeat(64), project = "mt-recovery-apps";

function addProjectApplication(world, service = "gateway", state = "running") {
  const name = project + "-" + service + "-1", appId = "f".repeat(64), defaultName = project + "_default";
  const labels = { "magictools.deployment": owner, "com.docker.compose.project": project };
  const network = { ...world.network, Name: defaultName, Id: "7".repeat(64), Labels: labels, Containers: {} };
  const application = { Id: appId, Name: "/" + name, State: { Status: state, Running: state === "running" },
    Config: { Labels: { ...labels, "com.docker.compose.service": service } }, HostConfig: { NetworkMode: defaultName },
    NetworkSettings: { Networks: { [defaultName]: { NetworkID: network.Id } } } };
  network.Containers[appId] = { Name: name };
  world.resources.network.set(defaultName, network); world.resources.container.set(name, application);
  return { application, network };
}

function addControlledIngress(world, application) {
  const network = { ...world.network, Name: project + "_ingress", Id: "8".repeat(64), Internal: false,
    Labels: { "magictools.deployment": owner, "com.docker.compose.project": project, "magictools.recovery.network": "ingress" },
    Containers: { [application.Id]: { Name: application.Name.slice(1) } } };
  world.resources.network.set(network.Name, network);
  application.NetworkSettings.Networks[network.Name] = { NetworkID: network.Id };
  return network;
}

test("已认证备份与成功恢复回执生成稳定绑定，真实资源和八库目录均只读核对", async () => {
  const world = fixture();
  const result = await captureRestoredBinding({ manifest: world.manifest, manifestSha256: world.binding.manifestSha256, restoreReceipt: world.receipt }, world.deps);
  assert.deepEqual(result, world.binding);
  assert.equal(world.calls.every((args) => ["inspect", "ls"].includes(args[1])), true);
  assert.equal(world.queries.some((entry) => entry.sql.includes("pg_control_system()")), true);
  assert.deepEqual(new Set(world.queries.map((entry) => entry.database)), new Set([...databases, "postgres"]));
});

test("后续核验允许同归属应用和迁移目录变化，仍要求初始目录与完整八库", async () => {
  const world = fixture();
  const appId = "f".repeat(64), appName = project + "-manager-server-1";
  world.network.Containers[appId] = { Name: appName };
  world.resources.container.set(appName, { Id: appId, Name: "/" + appName,
    Config: { Labels: { "magictools.deployment": owner, "com.docker.compose.project": project, "com.docker.compose.service": "manager-server" } },
    NetworkSettings: { Networks: { [world.binding.network.name]: { NetworkID: world.binding.network.id } } } });
  world.global.roles.push({ rolname: "post-migration-role", rolsuper: false });
  const actual = await verifyRestoredDatabase(world.binding, { owner, project }, world.deps);
  assert.equal(actual.running, true); assert.equal(actual.internalNetwork, true);
  assert.notEqual(actual.catalogSha256, world.binding.catalogSha256); assert.equal(actual.initialCatalogMatched, null);
  delete world.network.Containers[appId];
  await assert.rejects(verifyRestoredDatabase(world.binding, { owner, project, initial: true }, world.deps), /目录哈希/);
  world.global.databases = world.global.databases.filter((database) => database.name !== "manager");
  await assert.rejects(verifyRestoredDatabase(world.binding, { owner, project }, world.deps), /八库目录/);
});

test("Docker原子占位只允许一个owner领取，重试复用且不启动或挂恢复数据", async () => {
  const world = fixture();
  const results = await Promise.allSettled([
    claimRestoredDatabase(world.binding, { owner, project }, world.deps),
    claimRestoredDatabase(world.binding, { owner: "9".repeat(64), project: "another-apps" }, world.deps),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const first = results.find((result) => result.status === "fulfilled").value;
  assert.equal(first.reused, false); assert.equal(first.owner, owner); assert.equal(first.project, project);
  const retry = await claimRestoredDatabase(world.binding, { owner, project }, world.deps);
  assert.deepEqual(retry, { ...first, reused: true });
  const create = world.calls.find((args) => args[0] === "create");
  assert.equal(create[create.indexOf("--pull") + 1], "never");
  assert.equal(create[create.indexOf("--network") + 1], "none");
  assert.equal(create.includes("--mount"), false); assert.equal(create.includes("--volume"), false);
  assert.ok(create.includes("/var/lib/postgresql/data:rw,noexec,nosuid,size=1048576"));
  assert.equal(create.some((arg) => arg.startsWith("com.docker.compose.project=")), false);
  assert.equal(world.calls.some((args) => ["run", "start", "rm"].includes(args[0])), false);
  assert.equal(world.queries.length, 0, "领取只负责归属，不能冒充首次数据库验证");
});

test("项目归属核对全部容器网络卷，并抓住没有Compose标签的同名默认网络", async () => {
  const world = fixture();
  assert.deepEqual(await assertRecoveryProjectOwnership(project, owner, world.deps), { containers: [], networks: [], volumes: [] });
  const common = { "magictools.deployment": owner, "com.docker.compose.project": project };
  const ownNetwork = { ...world.network, Id: "c".repeat(64), Name: project + "_default", Labels: common, Containers: {} };
  world.resources.network.set(ownNetwork.Name, ownNetwork);
  const ownContainer = { ...world.container, Id: "f".repeat(64), Name: "/" + project + "-manager-server-1", Config: { Labels: { ...common, "com.docker.compose.service": "manager-server" } },
    HostConfig: { NetworkMode: ownNetwork.Name }, NetworkSettings: { Networks: { [ownNetwork.Name]: { NetworkID: ownNetwork.Id } } } };
  world.resources.container.set(ownContainer.Name.slice(1), ownContainer);
  const ownVolume = { ...world.volume, Name: project + "_saved", Labels: common };
  world.resources.volume.set(ownVolume.Name, ownVolume);
  const found = await assertRecoveryProjectOwnership(project, owner, world.deps);
  assert.equal(found.containers.length, 1); assert.equal(found.networks.length, 1); assert.equal(found.volumes.length, 1);
  ownVolume.Labels = { ...common, "magictools.deployment": "8".repeat(64) };
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps), /卷.*归属/);
  ownVolume.Labels = common; ownNetwork.Labels = {};
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps), /网络.*归属/);
  assert.equal(world.calls.every((args) => ["inspect", "ls"].includes(args[1])), true);
});

test("同一个恢复卷被另一容器挂载时拒绝交接，即使另一容器不在恢复网络", async () => {
  const world = fixture();
  world.resources.container.set("second-writer", { ...world.container, Id: "f".repeat(64), Name: "/second-writer", NetworkSettings: { Networks: { none: {} } } });
  await assert.rejects(verifyRestoredDatabase(world.binding, { owner, project }, world.deps), /卷.*其它容器/);
});

test("归属正确的项目默认网络也不能混入未归属该项目的容器", async () => {
  const world = fixture();
  world.resources.network.set(project + "_default", { ...world.network, Id: "c".repeat(64), Name: project + "_default",
    Labels: { "magictools.deployment": owner, "com.docker.compose.project": project } });
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps), /网络.*非本部署/);
});

for (const kind of ["container", "network", "volume"]) test("项目命名空间中的无标签孤立资源不能当空项目：" + kind, async () => {
  const world = fixture();
  if (kind === "container") world.resources.container.set(project + "-manager-server-1", { ...world.container, Id: "8".repeat(64), Name: "/" + project + "-manager-server-1", Config: { Labels: {} } });
  if (kind === "network") world.resources.network.set(project + "_orphan", { ...world.network, Id: "8".repeat(64), Name: project + "_orphan", Labels: {}, Containers: {} });
  if (kind === "volume") world.resources.volume.set(project + "_pgdata", { ...world.volume, Name: project + "_pgdata", Labels: {} });
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps), /项目.*归属/);
});

test("恢复资源名称带项目前缀时只有显式完整绑定可作为项目外资源排除", async () => {
  const world = fixture({ name: project + "-restored" });
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps), /项目.*归属/);
  assert.deepEqual(await assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), { containers: [], networks: [], volumes: [] });
});

for (const [name, change] of [
  ["container ID", (w) => { w.container.Id = "8".repeat(64); }],
  ["network ID", (w) => { w.network.Id = "8".repeat(64); }],
  ["volume创建时间", (w) => { w.volume.CreatedAt = "2026-09-12T03:00:00Z"; }],
  ["container operation", (w) => { w.container.Config.Labels = { "magictools.backup.operation": "8".repeat(16) }; }],
  ["network operation", (w) => { w.network.Labels = { "magictools.backup.operation": "8".repeat(16) }; }],
  ["volume operation", (w) => { w.volume.Labels = { "magictools.backup.operation": "8".repeat(16) }; }],
]) test("项目前缀资源不能靠绑定同名伪装排除：" + name, async () => {
  const world = fixture({ name: project + "-restored" }); change(world);
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }));
});

test("项目前缀中的精确claim仅在归属和created空tmpfs状态均有效时排除", async () => {
  const selectedProject = "mt-recovery", world = fixture();
  const claimed = await claimRestoredDatabase(world.binding, { owner, project: selectedProject }, world.deps);
  assert.deepEqual(await assertRecoveryProjectOwnership(selectedProject, owner, world.deps, { restoredBinding: world.binding }), { containers: [], networks: [], volumes: [] });
  world.resources.container.get(claimed.name).State.Status = "running";
  await assert.rejects(assertRecoveryProjectOwnership(selectedProject, owner, world.deps, { restoredBinding: world.binding }), /声明/);
});

for (const label of ["magictools.deployment", "magictools.recovery.binding"]) test("精确claim名称也不能替代完整声明校验：" + label, async () => {
  const selectedProject = "mt-recovery", world = fixture();
  const claimed = await claimRestoredDatabase(world.binding, { owner, project: selectedProject }, world.deps);
  world.resources.container.get(claimed.name).Config.Labels[label] = "8".repeat(64);
  await assert.rejects(assertRecoveryProjectOwnership(selectedProject, owner, world.deps, { restoredBinding: world.binding }), /声明|占用/);
});

for (const service of ["gateway", "manager-web", "manager-server"]) test("所有项目应用均拒绝额外外网：" + service, async () => {
  const world = fixture(), { application } = addProjectApplication(world, service);
  application.NetworkSettings.Networks.outside = { NetworkID: "8".repeat(64) };
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络/);
});

test("仅显式恢复模式允许gateway接精确受控ingress，default仍保持内部网络", async () => {
  const world = fixture(), { application, network: defaultNetwork } = addProjectApplication(world);
  const ingress = addControlledIngress(world, application);
  application.HostConfig.NetworkMode = ingress.Name;
  const actual = await assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding });
  assert.deepEqual(actual.networks.map((network) => network.name), [project + "_default", project + "_ingress"]);
  assert.equal(defaultNetwork.Internal, true); assert.equal(world.network.Internal, true);
  assert.equal((await verifyRestoredDatabase(world.binding, { owner, project }, world.deps)).running, true);
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps), /网络/);
});

for (const [name, change] of [
  ["缺少专属标签", (network) => { delete network.Labels["magictools.recovery.network"]; }],
  ["标签值伪装", (network) => { network.Labels["magictools.recovery.network"] = "outside"; }],
  ["其它owner", (network) => { network.Labels["magictools.deployment"] = "9".repeat(64); }],
  ["其它Compose项目", (network) => { network.Labels["com.docker.compose.project"] = "other-project"; }],
  ["非bridge", (network) => { network.Driver = "overlay"; }],
  ["非local", (network) => { network.Scope = "swarm"; }],
  ["属性不是显式入口网", (network) => { network.Internal = true; }],
]) test("受控ingress身份不符必须拒绝：" + name, async () => {
  const world = fixture(), { application } = addProjectApplication(world);
  const ingress = addControlledIngress(world, application); change(ingress);
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络/);
});

test("其它网络不能通过复制ingress专属标签得到外部访问例外", async () => {
  const world = fixture(), { application } = addProjectApplication(world);
  const ingress = addControlledIngress(world, application), oldName = ingress.Name;
  world.resources.network.delete(oldName); ingress.Name = project + "_outside";
  world.resources.network.set(ingress.Name, ingress);
  delete application.NetworkSettings.Networks[oldName]; application.NetworkSettings.Networks[ingress.Name] = { NetworkID: ingress.Id };
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络/);
});

test("gateway入口网络必须匹配真实ID，default及ingress两种受控主网络计划都可用", async () => {
  const world = fixture(), { application, network: defaultNetwork } = addProjectApplication(world);
  const ingress = addControlledIngress(world, application);
  for (const mode of [defaultNetwork.Name, defaultNetwork.Id, ingress.Name, ingress.Id]) {
    application.HostConfig.NetworkMode = mode;
    assert.equal((await assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding })).containers.length, 1);
  }
  application.NetworkSettings.Networks[ingress.Name].NetworkID = "9".repeat(64);
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络.*身份/);
});

for (const service of ["manager-web", "manager-server"]) test("web/server不能加入ingress，也不能作为其网络成员伪装：" + service, async () => {
  const world = fixture(), { application } = addProjectApplication(world, service);
  const ingress = addControlledIngress(world, application);
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络/);
  delete application.NetworkSettings.Networks[ingress.Name];
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /ingress.*gateway/);
});

test("ingress拒绝外来成员且恢复数据库不能接入入口网络", async () => {
  const world = fixture(), { application } = addProjectApplication(world);
  const ingress = addControlledIngress(world, application);
  ingress.Containers["9".repeat(64)] = { Name: "foreign-gateway" };
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络.*非本部署/);
  delete ingress.Containers["9".repeat(64)];
  world.container.NetworkSettings.Networks[ingress.Name] = { NetworkID: ingress.Id };
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /内部网络/);
});

test("created gateway可按受控ingress计划重试，非空错误ID和unknown计划仍拒绝", async () => {
  const world = fixture(), { application, network: defaultNetwork } = addProjectApplication(world, "gateway", "created");
  const ingress = addControlledIngress(world, application);
  application.HostConfig.NetworkMode = ingress.Name;
  application.NetworkSettings.Networks[defaultNetwork.Name].NetworkID = "";
  application.NetworkSettings.Networks[ingress.Name].NetworkID = "";
  assert.equal((await assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding })).containers.length, 1);
  application.NetworkSettings.Networks[ingress.Name].NetworkID = "9".repeat(64);
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络.*身份/);
  application.NetworkSettings.Networks[ingress.Name].NetworkID = ""; application.HostConfig.NetworkMode = "host";
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络/);
});

for (const service of ["gateway", "manager-web"]) test("数据库网络即使归属正确也拒绝前端成员：" + service, async () => {
  const world = fixture(), { application } = addProjectApplication(world, service);
  application.NetworkSettings.Networks[world.binding.network.name] = { NetworkID: world.binding.network.id };
  world.network.Containers[application.Id] = { Name: application.Name.slice(1) };
  await assert.rejects(verifyRestoredDatabase(world.binding, { owner, project }, world.deps), /恢复网络/);
});

test("项目应用默认网络必须匹配实际不可变ID，不能只相信名称", async () => {
  const world = fixture(), { application } = addProjectApplication(world);
  application.NetworkSettings.Networks[project + "_default"].NetworkID = "8".repeat(64);
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps), /网络.*身份/);
});

test("后端合法default及显式恢复网络可以重试，省略绑定或网络ID不符均拒绝", async () => {
  const world = fixture(), { application } = addProjectApplication(world, "manager-server");
  application.NetworkSettings.Networks[world.binding.network.name] = { NetworkID: world.binding.network.id };
  world.network.Containers[application.Id] = { Name: application.Name.slice(1) };
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps), /网络/);
  assert.equal((await assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding })).containers.length, 1);
  application.NetworkSettings.Networks[world.binding.network.name].NetworkID = "8".repeat(64);
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络.*身份/);
});

test("同owner已创建应用的空网络ID可按受控计划重试，host/outside计划仍拒绝", async () => {
  const world = fixture(), { application } = addProjectApplication(world, "manager-server", "created");
  application.NetworkSettings.Networks[project + "_default"].NetworkID = "";
  const actual = await assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding });
  assert.equal(actual.containers.length, 1);
  application.HostConfig.NetworkMode = "host";
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络/);
  application.HostConfig.NetworkMode = project + "_default";
  application.NetworkSettings.Networks.outside = { NetworkID: "" };
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps, { restoredBinding: world.binding }), /网络/);
});

test("标签相同的应用若另接外部网络，不能混入恢复数据库网络", async () => {
  const world = fixture();
  const appId = "f".repeat(64), appName = project + "-manager-server-1";
  world.network.Containers[appId] = { Name: appName };
  world.resources.container.set(appName, { Id: appId, Name: "/" + appName,
    Config: { Labels: { "magictools.deployment": owner, "com.docker.compose.project": project, "com.docker.compose.service": "manager-server" } },
    NetworkSettings: { Networks: { [world.binding.network.name]: { NetworkID: world.binding.network.id }, outside: { NetworkID: "9".repeat(64) } } } });
  await assert.rejects(verifyRestoredDatabase(world.binding, { owner, project }, world.deps), /非本部署|额外网络/);
});

for (const [name, change] of [
  ["源容器冒充恢复容器", (w) => { w.container.Config.Labels = {}; }],
  ["容器同名替换", (w) => { w.container.Id = "9".repeat(64); }],
  ["容器已停止", (w) => { w.container.State.Running = false; }],
  ["容器已暂停", (w) => { w.container.State.Paused = true; }],
  ["恢复网络同名替换", (w) => { w.network.Id = "9".repeat(64); }],
  ["恢复网络可访问外部", (w) => { w.network.Internal = false; }],
  ["网络不是本机bridge", (w) => { w.network.Driver = "overlay"; }],
  ["恢复卷同名重建", (w) => { w.volume.CreatedAt = "2026-09-12T03:00:00Z"; }],
  ["恢复卷属于其它operation", (w) => { w.volume.Labels = { "magictools.backup.operation": "9".repeat(16) }; }],
  ["卷驱动引用宿主目录", (w) => { w.volume.Options = { type: "none", device: "/production/data", o: "bind" }; }],
  ["实际挂载其它卷", (w) => { w.container.Mounts[0].Name = "production-data"; }],
  ["额外数据挂载", (w) => { w.container.Mounts.push({ Type: "bind", Source: "/production", Destination: "/extra" }); }],
  ["恢复数据只读挂载", (w) => { w.container.Mounts[0].RW = false; }],
  ["数据库另接外部网络", (w) => { w.container.NetworkSettings.Networks.outside = { NetworkID: "9".repeat(64) }; }],
  ["发布了宿主数据库端口", (w) => { w.container.HostConfig.PortBindings = { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "5432" }] }; }],
  ["容器固定镜像变化", (w) => { w.container.Config.Image = "pgvector/pgvector:latest"; }],
  ["实际镜像平台变化", (w) => { w.image.Architecture = "arm64"; }],
  ["PGDATA环境变化", (w) => { w.container.Config.Env = ["PGDATA=/production"]; }],
  ["启动config_file变化", (w) => { w.container.Config.Cmd = ["postgres", "-c", "config_file=/etc/postgresql.conf"]; }],
]) test("恢复资源拒绝：" + name, async () => {
  const world = fixture(); change(world);
  await assert.rejects(verifyRestoredDatabase(world.binding, { owner, project }, world.deps));
  assert.equal(world.calls.some((args) => args[0] === "create" || args[0] === "run"), false);
});

for (const [name, change] of [
  ["不是restore", (w) => { w.receipt.operation = "verify"; }],
  ["操作失败", (w) => { w.receipt.success = false; }],
  ["回执仍未完成", (w) => { w.receipt.stage = "decrypt"; }],
  ["备份ID不一致", (w) => { w.receipt.backupId = "9".repeat(16); }],
  ["结果归属不一致", (w) => { w.receipt.result.operationId = "9".repeat(16); }],
  ["目录未验证", (w) => { w.receipt.result.catalogVerified = false; }],
  ["清理失败", (w) => { w.receipt.cleanupError = "failed"; }],
  ["资源名称注入", (w) => { w.receipt.result.container = "--production"; }],
  ["结束时间无效", (w) => { w.receipt.finishedAt = "unknown"; }],
]) test("生成绑定前拒绝回执：" + name, async () => {
  const world = fixture(); change(world);
  await assert.rejects(captureRestoredBinding({ manifest: world.manifest, manifestSha256: world.binding.manifestSha256, restoreReceipt: world.receipt }, world.deps));
  assert.equal(world.calls.length, 0); assert.equal(world.queries.length, 0);
});

for (const [field, value] of [["systemIdentifier", "9999"], ["serverVersion", 170001], ["inRecovery", true], ["dataDirectory", "/other"], ["configFile", "/etc/postgresql.conf"]]) {
  test("实际PG身份不符时拒绝：" + field, async () => {
    const world = fixture(), query = world.deps.databaseQuery;
    world.deps.databaseQuery = async (...args) => {
      const actual = await query(...args);
      return args[2].includes("pg_control_system()") ? JSON.stringify({ ...JSON.parse(actual), [field]: value }) : actual;
    };
    await assert.rejects(verifyRestoredDatabase(world.binding, { owner, project }, world.deps), /系统标识、版本或运行配置/);
  });
}

for (const [name, change] of [
  ["被人为启动", (claim) => { claim.State.Status = "running"; claim.State.Running = true; }],
  ["挂载恢复卷", (claim, w) => { claim.Mounts = structuredClone(w.container.Mounts); }],
  ["声明绑定变化", (claim) => { claim.Config.Labels["magictools.recovery.binding"] = "9".repeat(64); }],
  ["声明变成Compose容器", (claim) => { claim.Config.Labels["com.docker.compose.project"] = project; }],
  ["缺少抑制匿名卷的tmpfs", (claim) => { claim.HostConfig.Tmpfs = {}; }],
  ["接入恢复网络", (claim, w) => { claim.HostConfig.NetworkMode = w.binding.network.name; }],
  ["被改成PG启动命令", (claim) => { claim.Config.Cmd = ["postgres"]; }],
  ["被增加VolumesFrom", (claim) => { claim.HostConfig.VolumesFrom = ["production-container"]; }],
]) test("拒绝复用异常claim：" + name, async () => {
  const world = fixture();
  const first = await claimRestoredDatabase(world.binding, { owner, project }, world.deps);
  change(world.resources.container.get(first.name), world);
  await assert.rejects(claimRestoredDatabase(world.binding, { owner, project }, world.deps));
  assert.equal(world.resources.container.has(first.name), true, "异常声明保留现场，不自动删除接管");
});

test("Docker/PG I/O失败不能变成不存在或成功，也不将秘密错误内容返回", async () => {
  const world = fixture();
  const run = world.deps.runDocker;
  world.deps.runDocker = async (args) => args[1] === "ls" ? { exitCode: 1, stdout: "SECRET-SHOULD-NOT-APPEAR" } : run(args);
  await assert.rejects(assertRecoveryProjectOwnership(project, owner, world.deps), (error) => !error.message.includes("SECRET") && /无法确认/.test(error.message));
  world.deps.runDocker = run; world.deps.databaseQuery = async () => { throw new Error("SECRET-SHOULD-NOT-APPEAR"); };
  await assert.rejects(verifyRestoredDatabase(world.binding, { owner, project }, world.deps), (error) => !error.message.includes("SECRET") && /查询失败/.test(error.message));
});

test("归属参数或业务库清单缺失时在全部Docker/PG操作之前失败", async () => {
  const world = fixture();
  await assert.rejects(claimRestoredDatabase(world.binding, { owner: "bad-owner", project }, world.deps));
  await assert.rejects(assertRecoveryProjectOwnership("--bad-project", owner, world.deps));
  await assert.rejects(verifyRestoredDatabase({ ...world.binding, databases: ["manager"] }, { owner, project }, world.deps), /完整八个/);
  assert.equal(world.calls.length, 0); assert.equal(world.queries.length, 0);
});
