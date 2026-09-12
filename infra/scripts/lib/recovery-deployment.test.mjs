import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { renderReleaseCompose, validateDeploymentConfig } from "./release-artifacts.mjs";
import { runtimeCatalog } from "./runtime-artifacts.mjs";
import { bindRecoveryConnections, recoveryConnectionFields } from "./recovery-connections.mjs";

const original = { schema: "magictools-deployment-config/1", project: "recovery-test", gatewayBind: "127.0.0.1", gatewayPort: 55301, waitTimeoutSeconds: 120 };
const binding = () => ({ schema: "magictools-restored-database/1", mode: "restored", restoreOperationId: "1".repeat(16), backupId: "2".repeat(16), manifestSha256: "3".repeat(64), catalogSha256: "4".repeat(64),
  restoredAt: "2026-09-12T02:00:00.000Z", container: { name: "recovered-test", id: "a".repeat(64) },
  network: { name: "recovered-test-net", id: "b".repeat(64) }, volume: { name: "recovered-test-data", createdAt: "2026-09-12T01:59:00Z" },
  source: { systemIdentifier: "1234567890123456", serverVersion: 160015, image: { reference: "pgvector/pgvector@sha256:" + "c".repeat(64), platform: "linux/amd64" },
    dataDirectory: "/var/lib/postgresql/data", configFile: "/var/lib/postgresql/data/postgresql.conf" },
  databases: ["applicant", "assessor", "assistant", "designer", "gatherer", "investigator", "manager", "scholar"] });
const config = () => ({ ...original, schema: "magictools-deployment-config/2", database: binding() });
const base = () => parse(readFileSync(new URL("../../compose.prod.yml", import.meta.url), "utf8"));
const catalog = runtimeCatalog(parse(readFileSync(new URL("../../ports.yaml", import.meta.url), "utf8")));
const release = { images: catalog.map((service) => ({ service: service.service, reference: "localhost:55101/magictools/" + service.service + "@sha256:" + "d".repeat(64) })) };

test("恢复部署只渲染17个应用与指定私有数据库网络，旧v1配置版本和制品不变", () => {
  assert.equal(validateDeploymentConfig(original).configVersion, "4ddec0a23ab26d8b76a923f0432a9821105d163d9e1907d2b1950b95d5bc0b92");
  const source = base(); const before = structuredClone(source); const selected = config();
  const rendered = renderReleaseCompose(source, release, catalog, selected);
  assert.deepEqual(source, before); assert.equal(Object.keys(rendered.services).length, 17);
  assert.equal(rendered.services.postgres, undefined); assert.equal(rendered.volumes, undefined);
  assert.equal(rendered.networks.default.internal, true);
  assert.equal(rendered.networks.ingress.internal, false);
  assert.equal(rendered.networks.ingress.labels["magictools.recovery.network"], "ingress");
  assert.deepEqual(rendered.networks.restored, { external: true, name: selected.database.network.name });
  for (const item of catalog) {
    const service = rendered.services[item.service];
    assert.equal(service.image, release.images.find((entry) => entry.service === item.service).reference);
    assert.equal(service.depends_on?.postgres, undefined);
    assert.deepEqual(service.networks, item.app === "gateway" ? ["default", "ingress"] : item.kind === "node" ? ["default", "restored"] : ["default"]);
  }
  assert.equal(rendered.services["manager-server"].environment.DATABASE_URL, source.services["manager-server"].environment.DATABASE_URL);
  assert.equal(renderReleaseCompose(source, release, catalog, original).services.postgres.image, source.services.postgres.image);
});

test("恢复身份完整进入稳定配置版本，缺失身份或混入秘密时拒绝公开配置", () => {
  const selected = config(); const expected = validateDeploymentConfig(selected).configVersion;
  const reordered = config(); reordered.database = Object.fromEntries(Object.entries(reordered.database).reverse());
  reordered.database.source.image = Object.fromEntries(Object.entries(reordered.database.source.image).reverse()); reordered.database.databases.reverse();
  assert.equal(validateDeploymentConfig(reordered).configVersion, expected);
  const replaced = config(); replaced.database.container.id = "f".repeat(64);
  assert.notEqual(validateDeploymentConfig(replaced).configVersion, expected);
  for (const change of [
    (value) => { delete value.database.container.id; },
    (value) => { value.database.network.name = "shared-production-network"; },
    (value) => { value.database.volume.createdAt = "unknown"; },
    (value) => { value.database.restoreOperationId = "not-an-id"; },
    (value) => { value.database.backupId = 1111111111111111; },
    (value) => { value.database.network.id = ["b".repeat(64)]; },
    (value) => { value.database.source.image.reference = "pgvector/pgvector:latest"; },
    (value) => { value.database.source.image.platform = ["linux/amd64"]; },
    (value) => { value.database.source.serverVersion = 170001; },
    (value) => { value.database.source.configFile = "/etc/postgresql.conf"; },
    (value) => { value.database.databases.push("manager"); },
    (value) => { value.database.password = "do-not-save"; },
    (value) => { value.database.container.password = "do-not-save"; },
  ]) { const invalid = config(); change(invalid); assert.throws(() => validateDeploymentConfig(invalid)); }
});

test("恢复渲染拒绝宿主网络、宿主挂载和额外入口等隔离绕过", () => {
  for (const change of [
    (value) => { value.services["manager-server"].network_mode = "host"; },
    (value) => { value.services["manager-server"].volumes = ["/var/run/docker.sock:/var/run/docker.sock"]; },
    (value) => { value.services["manager-server"].privileged = true; },
    (value) => { value.services["manager-server"].extra_hosts = ["host.docker.internal:host-gateway"]; },
    (value) => { value.services["manager-server"].ports = ["5432:5004"]; },
    (value) => { value.services["manager-server"].healthcheck = { test: ["CMD", "true"] }; },
    (value) => { value.networks = { production: { external: true } }; },
  ]) { const source = base(); change(source); assert.throws(() => renderReleaseCompose(source, release, catalog, config()), /恢复.*隔离/); }
  const incomplete = config(); incomplete.database.databases.pop();
  assert.throws(() => renderReleaseCompose(base(), release, catalog, incomplete), /业务库/);
});

test("恢复数据库名称不能占用应用DNS名或将要创建的容器名", () => {
  for (const name of ["manager-server", "gateway", "manager-web", "recovery-test-manager-server-1"]) {
    const selected = config(); selected.database.container.name = name; selected.database.network.name = name + "-net"; selected.database.volume.name = name + "-data";
    assert.throws(() => renderReleaseCompose(base(), release, catalog, selected), /名称.*冲突/);
  }
});

test("旧制品的已知默认连接迁移到私有env引用，原始制品字节保持不变", () => {
  const legacy = base();
  for (const item of recoveryConnectionFields(catalog)) legacy.services[item.service].environment[item.field] = "postgres://postgres:postgres@postgres:5432/" + item.database;
  const before = JSON.stringify(legacy); const selected = config();
  const rendered = renderReleaseCompose(legacy, release, catalog, selected);
  const values = Object.fromEntries(selected.database.databases.map((database) => [database.toUpperCase() + "_DATABASE_URL", "postgres://postgres:private-test-secret@postgres:5432/" + database]));
  const bound = bindRecoveryConnections(rendered, catalog, values, selected.database);
  assert.equal(bound.connections.length, 12); assert.equal(JSON.stringify(legacy), before);
  for (const item of recoveryConnectionFields(catalog)) assert.equal(rendered.services[item.service].environment[item.field], "${" + item.variable + ":?" + item.variable + " is required}");
  assert.ok(!JSON.stringify(rendered).includes("private-test-secret"));
});
