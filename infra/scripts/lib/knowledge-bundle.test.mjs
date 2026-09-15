import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadKnowledgeBundle, syncKnowledgeBundle } from "./knowledge-bundle.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const bundlePath = join(root, "docs", "knowledge", "initial-bundle.json");

test("P20 内容包固定 20 条用户任务与 20 条开发问题且证据路径存在", async () => {
  const bundle = await loadKnowledgeBundle(bundlePath);
  assert.equal(bundle.entries.filter((entry) => entry.kind === "product").length, 20);
  assert.equal(bundle.entries.filter((entry) => entry.kind === "development").length, 20);
  assert.equal(new Set(bundle.entries.map((entry) => entry.stableId)).size, 40);
  assert(bundle.notes.some((note) => note.includes("历史原因：未知")));
});

test("同步脚本重复执行不重写未变化条目", async () => {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  const existing = bundle.entries.map((entry) => ({
    id: "id-" + entry.stableId,
    source: "manual",
    sourceRef: entry.stableId,
    title: entry.title,
    content: entry.content,
    summary: entry.summary,
    category: entry.category,
    tags: entry.tags,
    spaceKey: entry.kind,
    sourceRevision: entry.sourceRevision,
    sourceUrl: entry.sourceUrl,
    requirementId: entry.requirementId,
    requirementUrl: entry.requirementUrl,
  }));
  const calls = [];
  const result = await syncKnowledgeBundle({
    bundlePath,
    baseUrl: "http://scholar.test",
    fetch: async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      if (String(url).endsWith("/api/scholar/entries")) return jsonResponse(existing);
      throw new Error("未变化同步不应调用写入接口: " + url);
    },
  });
  assert.equal(result.created, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.skipped, 40);
  assert.equal(calls.filter((call) => call.method !== "GET").length, 0);
});

test("product 发布缺少部署标识时拒绝执行", async () => {
  await assert.rejects(
    syncKnowledgeBundle({ bundlePath, baseUrl: "http://scholar.test", publishProduct: true, fetch: async () => {
      throw new Error("不应访问服务");
    } }),
    /部署标识/
  );
});

test("同步脚本透传访问令牌且不能伪造网关管理员身份", async () => {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  const existing = bundle.entries.map((entry) => ({
    id: "id-" + entry.stableId,
    sourceRef: entry.stableId,
    title: entry.title,
    content: entry.content,
    summary: entry.summary,
    category: entry.category,
    tags: entry.tags,
    spaceKey: entry.kind,
    sourceRevision: entry.sourceRevision,
    sourceUrl: entry.sourceUrl,
    requirementId: entry.requirementId,
    requirementUrl: entry.requirementUrl,
  }));
  let headers = null;
  await syncKnowledgeBundle({
    bundlePath,
    baseUrl: "http://gateway.test",
    token: "service-token",
    fetch: async (_url, init = {}) => {
      headers = init.headers ?? {};
      return jsonResponse(existing);
    },
  });
  assert.equal(headers["x-access-token"], "service-token");
  assert.equal(headers["x-gateway-role"], undefined);
});

function jsonResponse(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
