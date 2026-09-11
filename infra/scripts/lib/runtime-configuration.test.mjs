import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const compose = () => parse(readFileSync(join(root, "infra/compose.prod.yml"), "utf8"));

test("生产数据库凭证必须由已有env提供，八库连接分别映射且不使用仓库内固定密码", () => {
  const services = compose().services;
  assert.match(services.postgres.environment.POSTGRES_PASSWORD, /^\$\{POSTGRES_PASSWORD:\?/);
  for (const [name, service] of Object.entries(services)) {
    if (!name.endsWith("-server")) continue;
    const variable = name.slice(0, -7).toUpperCase() + "_DATABASE_URL";
    assert.ok(service.environment.DATABASE_URL.startsWith("${" + variable + ":?"), name);
    for (const [key, value] of Object.entries(service.environment)) {
      if (key.endsWith("_DATABASE_URL")) assert.ok(value.startsWith("${" + key + ":?"), key);
    }
  }
});

test("运行配置透传实际集成所需密钥，并保留非空公共默认值", () => {
  const services = compose().services;
  assert.equal(services["assistant-server"].environment.CYBERCLOUD_API_KEY, "${CYBERCLOUD_API_KEY:-}");
  assert.equal(services["manager-server"].environment.GITHUB_WEBHOOK_SECRET, "${GITHUB_WEBHOOK_SECRET:-}");
  assert.equal(services["investigator-server"].environment.FEISHU_APP_SECRET, "${FEISHU_APP_SECRET:-}");
  assert.equal(services["applicant-server"].environment.CLAWCV_BACKEND_URL, "${CLAWCV_BACKEND_URL:-https://api.wondercv.com}");
  assert.equal(services["assistant-server"].environment.CYBERCLOUD_DIRECT_TIMEOUT_MS, "${CYBERCLOUD_DIRECT_TIMEOUT_MS:-8000}");
  assert.equal(services["gatherer-server"].environment.GITHUB_TOKEN, undefined);
});
