import test from "node:test";
import assert from "node:assert/strict";
import { makeValidationCompose } from "./runtime-validation.mjs";

const catalog = [{ service: "gateway", app: "gateway", kind: "node", port: 3000 }];
const image = { service: "gateway", localImageId: "sha256:" + "a".repeat(64) };
const base = { services: { gateway: { image: "${GATEWAY_IMAGE}", ports: ["3000:3000"], environment: { GATEWAY_TOKEN: "${GATEWAY_TOKEN}" } },
  postgres: { image: "pgvector/pgvector@sha256:" + "b".repeat(64), volumes: ["pgdata:/var/lib/postgresql/data", "./postgres-init.sql:/docker-entrypoint-initdb.d/init.sql:ro"] } }, volumes: { pgdata: {} } };

test("容器验收只使用本轮镜像、独立卷与随机本机端口，不沿用生产秘密", () => {
  const composed = makeValidationCompose(base, catalog, [image], "runtime-test");
  assert.equal(composed.services.gateway.image, image.localImageId);
  assert.deepEqual(composed.services.gateway.ports, ["127.0.0.1::3000"]);
  assert.equal(composed.services.gateway.environment.GATEWAY_TOKEN, "");
  assert.equal(composed.services.postgres.ports, undefined);
  assert.equal(composed.services.gateway.restart, "no");
  assert.equal(composed.services.postgres.labels["magictools.validation"], "runtime-test");
  assert.equal(base.services.gateway.image, "${GATEWAY_IMAGE}");
});

test("验证配置拒绝额外服务、宿主卷和未提供镜像，避免误操作既有资源", () => {
  assert.throws(() => makeValidationCompose(base, catalog, [], "runtime-test"), /镜像/);
  const extra = structuredClone(base); extra.services.stray = {};
  assert.throws(() => makeValidationCompose(extra, catalog, [image], "runtime-test"), /服务/);
  const external = structuredClone(base); external.volumes.pgdata = { external: true };
  assert.throws(() => makeValidationCompose(external, catalog, [image], "runtime-test"), /卷/);
  const mounted = structuredClone(base); mounted.services.gateway.volumes = ["/host:/app"];
  assert.throws(() => makeValidationCompose(mounted, catalog, [image], "runtime-test"), /挂载/);
});
