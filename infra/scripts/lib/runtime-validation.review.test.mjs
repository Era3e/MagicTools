import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = process.env.RUNTIME_REVIEW_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { parse } = createRequire(join(root, "package.json"))("yaml");
const { runtimeCatalog } = await import(pathToFileURL(join(root, "infra/scripts/lib/runtime-artifacts.mjs")));
const { makeValidationCompose } = await import(pathToFileURL(join(root, "infra/scripts/lib/runtime-validation.mjs")));
const catalog = runtimeCatalog(parse(readFileSync(join(root, "infra/ports.yaml"), "utf8")));
const images = catalog.map((item, index) => ({ service: item.service, localImageId: "sha256:" + index.toString(16).padStart(64, "0") }));
const runId = "runtime-independent-review";
const base = () => parse(readFileSync(join(root, "infra/compose.prod.yml"), "utf8"));

test("独立验收：正常配置固定本轮镜像且仅暴露随机本机网关端口", () => {
  const original = base();
  const snapshot = structuredClone(original);
  const result = makeValidationCompose(original, catalog, images, runId);
  assert.deepEqual(original, snapshot);
  assert.equal(result.name, undefined);
  assert.equal(Object.keys(result.services).length, 18);
  assert.equal(result.services.postgres.ports, undefined);
  for (const item of catalog) {
    assert.equal(result.services[item.service].image, images.find((image) => image.service === item.service).localImageId);
    assert.equal(result.services[item.service].restart, "no");
    assert.equal(result.services[item.service].labels["magictools.validation"], runId);
    if (item.service !== "gateway") assert.equal(result.services[item.service].ports, undefined);
  }
  assert.deepEqual(result.services.gateway.ports, ["127.0.0.1::3000"]);
  assert.equal(new URL(result.services["manager-server"].environment.DATABASE_URL).hostname, "postgres");
});

test("独立验收：拒绝可越过独立网络或引用既有容器的服务字段", () => {
  const fields = {
    extra_hosts: ["postgres:host-gateway"],
    volumes_from: ["container:existing-container"],
    secrets: ["external-secret"],
    configs: ["external-config"],
    external_links: ["existing-container:postgres"],
    links: ["postgres:other-database"],
    pid: "host",
    ipc: "host",
    cap_add: ["SYS_ADMIN"],
    privileged: true,
    devices: ["/dev/sda:/dev/sda"],
    env_file: ["/outside/production.env"],
    network_mode: "host",
    networks: ["outside-network"],
    container_name: "existing-container",
    build: "/outside/source",
    entrypoint: ["/bin/sh"],
    command: ["unexpected-command"],
  };
  for (const [field, value] of Object.entries(fields)) {
    const input = base();
    input.services["manager-server"][field] = value;
    assert.throws(() => makeValidationCompose(input, catalog, images, runId), field);
  }
});

test("独立验收：拒绝顶层外部秘密、配置和既有网络定义", () => {
  for (const [field, value] of [
    ["secrets", { external: { external: true } }],
    ["configs", { external: { file: "/outside/production.conf" } }],
    ["networks", { default: { name: "existing-network", external: true } }],
  ]) {
    const input = base(); input[field] = value;
    assert.throws(() => makeValidationCompose(input, catalog, images, runId), field);
  }
});

test("独立验收：硬编码和插值秘密均不进入验证环境，端口与生产路由模式保留", () => {
  const input = base();
  input.services.gateway.environment.GATEWAY_TOKEN = "literal-review-secret";
  input.services["manager-server"].environment.MANAGER_APPROVAL_TOKEN = "literal-review-secret";
  input.services["manager-server"].environment.EXTRA_API_KEY = "literal-review-secret";
  input.services["manager-server"].environment.DATABASE_URL = "postgres://production:literal-review-secret@outside/manager";
  const result = makeValidationCompose(input, catalog, images, runId);
  assert.equal(JSON.stringify(result).includes("literal-review-secret"), false);
  assert.equal(result.services.gateway.environment.MT_PROD, "1");
  assert.equal(result.services["manager-server"].environment.PORT, "5004");
  assert.equal(result.services["manager-server"].environment.DATABASE_URL, "postgres://postgres:postgres@postgres:5432/manager");
});

test("独立验收：容器、数据库卷和默认网络都记录本次验证所有权", () => {
  const result = makeValidationCompose(base(), catalog, images, runId);
  assert.equal(result.services.postgres.labels["magictools.validation"], runId);
  assert.equal(result.volumes?.pgdata?.labels?.["magictools.validation"], runId);
  assert.equal(result.networks?.default?.labels?.["magictools.validation"], runId);
});

test("独立验收：非法命名空间和额外服务在启动前拒绝", () => {
  for (const invalid of ["", "../existing", "MixedCase", "name with spaces"]) {
    assert.throws(() => makeValidationCompose(base(), catalog, images, invalid));
  }
  const input = base(); input.services.extra = {};
  assert.throws(() => makeValidationCompose(input, catalog, images, runId));
});
