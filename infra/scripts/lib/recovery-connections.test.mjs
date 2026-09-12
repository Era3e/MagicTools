import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { runtimeCatalog } from "./runtime-artifacts.mjs";
import { bindRecoveryConnections, resolvedRecoveryEnvironment } from "./recovery-connections.mjs";

const compose = () => parse(readFileSync(new URL("../../compose.prod.yml", import.meta.url), "utf8"));
const catalog = runtimeCatalog(parse(readFileSync(new URL("../../ports.yaml", import.meta.url), "utf8")));
const databases = catalog.filter((entry) => entry.kind === "node" && entry.app !== "gateway").map((entry) => entry.app).sort();
const sourceEnvironment = () => Object.fromEntries(databases.map((database) => [database.toUpperCase() + "_DATABASE_URL", "postgres://app%20user:p%40ss%24word@postgres:5432/" + database]));

test("八主库和四上游连接全部绑定恢复实例，口令仅留在进程环境且输入未改动", () => {
  const source = compose(); const environment = sourceEnvironment();
  const before = JSON.stringify({ source, environment });
  const result = bindRecoveryConnections(source, catalog, environment, { container: { name: "recovered-test" }, databases });
  assert.equal(result.connections.length, 12); assert.equal(Object.keys(result.environment).length, 8);
  for (const database of databases) {
    const value = new URL(result.environment[database.toUpperCase() + "_DATABASE_URL"]);
    assert.equal(value.hostname, "recovered-test"); assert.equal(value.port, "5432"); assert.equal(value.pathname, "/" + database);
    assert.equal(decodeURIComponent(value.username), "app user"); assert.equal(decodeURIComponent(value.password), "p@ss$word");
  }
  for (const [service, field, database] of [["assessor-server", "INVESTIGATOR_DATABASE_URL", "investigator"], ["manager-server", "ASSESSOR_DATABASE_URL", "assessor"],
    ["scholar-server", "GATHERER_DATABASE_URL", "gatherer"], ["assistant-server", "SCHOLAR_DATABASE_URL", "scholar"]]) {
    assert.ok(result.connections.some((entry) => entry.service === service && entry.field === field && entry.database === database && entry.host === "recovered-test"));
  }
  assert.equal(JSON.stringify({ source, environment }), before);
  assert.ok(!JSON.stringify(result.connections).includes("postgres://") && !JSON.stringify(result.connections).includes("p%40ss"));
});

test("缺失跨库连接、错误库名或外部目标必须在部署前拒绝，错误不包含口令", () => {
  const selected = { container: { name: "recovered-test" }, databases };
  const missing = compose(); delete missing.services["manager-server"].environment.ASSESSOR_DATABASE_URL;
  assert.throws(() => bindRecoveryConnections(missing, catalog, sourceEnvironment(), selected), /连接/);
  const literal = compose(); literal.services["manager-server"].environment.DATABASE_URL = "postgres://user:private-password@postgres/manager";
  assert.throws(() => bindRecoveryConnections(literal, catalog, sourceEnvironment(), selected), /连接/);
  const extra = compose(); extra.services["manager-server"].environment.UNKNOWN_DATABASE_URL = "${MANAGER_DATABASE_URL}";
  assert.throws(() => bindRecoveryConnections(extra, catalog, sourceEnvironment(), selected), /连接/);
  for (const url of [undefined, "invalid-private-password", "postgres://app:private-password@old-source:5432/manager", "postgres://app:private-password@127.0.0.1:5432/manager",
    "postgres://app:private-password@postgres:6543/manager", "postgres://app:private-password@postgres:5432/scholar", "postgres://app:private-password@postgres:5432/manager?host=old-source",
    "postgres://app:private-password@postgres:5432/manager#fragment", "mysql://app:private-password@postgres:5432/manager", "postgres://app@postgres:5432/manager"]) {
    const environment = sourceEnvironment(); environment.MANAGER_DATABASE_URL = url;
    assert.throws(() => bindRecoveryConnections(compose(), catalog, environment, selected), (error) => !error.message.includes("private-password"));
  }
});

test("名称类型、应用DNS冲突与PG无法解析的密码编码在连接绑定前拒绝", () => {
  for (const name of [["recovered-test"], "manager-server", "gateway", "manager-web"]) {
    assert.throws(() => bindRecoveryConnections(compose(), catalog, sourceEnvironment(), { container: { name }, databases }));
  }
  for (const password of ["%FF", "%C0%AF", "%ED%A0%80"]) {
    const environment = sourceEnvironment(); environment.MANAGER_DATABASE_URL = "postgres://user:" + password + "@postgres:5432/manager";
    assert.throws(() => bindRecoveryConnections(compose(), catalog, environment, { container: { name: "recovered-test" }, databases }), (error) => !error.message.includes(password));
  }
});

test("使用Compose实际解析的连接值，遗漏或相互矛盾的上游连接不能被覆盖隐藏", () => {
  const rendered = compose(); const values = sourceEnvironment();
  for (const service of Object.values(rendered.services)) for (const [field, value] of Object.entries(service.environment ?? {})) {
    if (field.endsWith("DATABASE_URL")) service.environment[field] = values[value.match(/^\$\{([A-Z_]+)/)[1]];
  }
  assert.deepEqual(resolvedRecoveryEnvironment(rendered, catalog), values);
  rendered.services["manager-server"].environment.ASSESSOR_DATABASE_URL = "postgres://private:secret@original-db/assessor";
  assert.throws(() => resolvedRecoveryEnvironment(rendered, catalog), (error) => !error.message.includes("secret") && /不一致/.test(error.message));
  delete rendered.services["manager-server"].environment.ASSESSOR_DATABASE_URL;
  assert.throws(() => resolvedRecoveryEnvironment(rendered, catalog), /缺失/);
});
