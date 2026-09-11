import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runtimeCatalog } from "./runtime-artifacts.mjs";
import { assertDeploymentValidationIsolation } from "./deployment-validation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = runtimeCatalog(parse(readFileSync(join(root, "infra/ports.yaml"), "utf8")));
const images = catalog.map((item) => ({ service: item.service, localImageId: "sha256:" + "a".repeat(64) }));
const base = () => parse(readFileSync(join(root, "infra/compose.prod.yml"), "utf8"));

test("真实部署验证只接受独立卷/网络及网关端口，拒绝原5432与共享资源配置", () => {
  assert.doesNotThrow(() => assertDeploymentValidationIsolation(base(), catalog, images));
  for (const change of [
    (value) => { value.services.postgres.ports = ["5432:5432"]; },
    (value) => { value.services["manager-server"].ports = ["5004:5004"]; },
    (value) => { value.volumes.pgdata = { external: true, name: "shared-data" }; },
    (value) => { value.networks = { default: { external: true } }; },
    (value) => { value.services["manager-server"].volumes = ["/:/host"]; },
  ]) { const value = base(); change(value); assert.throws(() => assertDeploymentValidationIsolation(value, catalog, images)); }
});

test("测试不能把固定外部数据库地址或硬编码真实凭证带入实际部署", () => {
  for (const change of [
    (value) => { value.services["manager-server"].environment.DATABASE_URL = "postgres://postgres:postgres@host.docker.internal:5432/production"; },
    (value) => { value.services["manager-server"].environment.DATABASE_URL = "${DATABASE_URL:-postgres://outside/production}"; },
    (value) => { value.services["manager-server"].environment.GITHUB_TOKEN = "literal-private-token"; },
    (value) => { value.services["manager-server"].environment.GITHUB_TOKEN = "${GITHUB_TOKEN:-literal-private-token}"; },
    (value) => { value.services.postgres.environment.PGHOST = "outside"; },
  ]) { const value = base(); change(value); assert.throws(() => assertDeploymentValidationIsolation(value, catalog, images)); }
  const legacy = base(); legacy.services["manager-server"].environment.DATABASE_URL = "postgres://postgres:postgres@postgres:5432/manager";
  legacy.services.postgres.environment.POSTGRES_PASSWORD = "postgres";
  assert.doesNotThrow(() => assertDeploymentValidationIsolation(legacy, catalog, images));
});
