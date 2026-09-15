import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const REQUIRED_FIELDS = [
  "stableId", "kind", "title", "project", "content", "summary", "category", "tags",
  "sourceRevision", "sourceUrl", "requirementId", "requirementUrl", "validation",
];

export async function loadKnowledgeBundle(bundlePath = join(ROOT, "docs", "knowledge", "initial-bundle.json")) {
  let bundle;
  try {
    bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  } catch (error) {
    throw new Error("P20 内容包必须是有效 JSON: " + error.message);
  }
  if (bundle.schema !== "magictools-knowledge-bundle/1") throw new Error("P20 内容包 schema 不支持");
  if (!Array.isArray(bundle.entries) || bundle.entries.length !== 40) throw new Error("P20 内容包必须固定 40 条内容");

  const stableIds = new Set();
  for (const entry of bundle.entries) {
    for (const field of REQUIRED_FIELDS) {
      if (entry[field] === undefined || entry[field] === null) {
        throw new Error(`P20 内容 ${entry.stableId ?? "unknown"} 缺少字段 ${field}`);
      }
    }
    if (!/^P20-[UD](?:0[1-9]|1[0-9]|20)$/.test(entry.stableId)) throw new Error("P20 stableId 非法: " + entry.stableId);
    if (entry.kind !== (/^P20-U\d{2}$/.test(entry.stableId) ? "product" : "development")) {
      throw new Error("P20 stableId 与内容类型不一致: " + entry.stableId);
    }
    if (!Array.isArray(entry.tags) || entry.tags.some((tag) => typeof tag !== "string")) {
      throw new Error("P20 tags 必须是字符串数组: " + entry.stableId);
    }
    stableIds.add(entry.stableId);
    assertLocalEvidencePath(entry);
  }
  if (stableIds.size !== 40) throw new Error("P20 stableId 必须唯一");
  if (bundle.entries.filter((entry) => entry.kind === "product").length !== 20) throw new Error("P20 用户帮助必须为 20 条");
  if (bundle.entries.filter((entry) => entry.kind === "development").length !== 20) throw new Error("P20 开发导航必须为 20 条");
  return bundle;
}

function assertLocalEvidencePath(entry) {
  let url;
  try {
    url = new URL(entry.sourceUrl);
  } catch {
    throw new Error("P20 来源 URL 非法: " + entry.stableId);
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname !== "github.com" || parts.length < 4 || parts[2] !== "blob") {
    throw new Error("P20 来源必须是 GitHub blob 证据: " + entry.stableId);
  }
  const relativePath = decodeURIComponent(parts.slice(4).join("/"));
  if (!relativePath || !existsSync(join(ROOT, relativePath))) {
    throw new Error(`P20 ${entry.stableId} 本地证据路径不存在: ${relativePath}`);
  }
}

export async function syncKnowledgeBundle(options = {}) {
  const bundle = await loadKnowledgeBundle(options.bundlePath);
  if (options.dryRun) return { dryRun: true, created: 0, updated: 0, skipped: bundle.entries.length, published: false };
  if (options.publishProduct && !String(options.deploymentRef ?? "").trim()) {
    throw new Error("product 发布必须显式绑定部署标识");
  }
  if (options.publishProduct && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(String(options.version ?? ""))) {
    throw new Error("product 发布必须提供合法版本号");
  }

  const baseUrl = String(options.baseUrl ?? "http://127.0.0.1:5006").replace(/\/$/, "");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("当前运行时没有可用 fetch");
  const request = async (path, init = {}) => {
    const response = await fetchImpl(baseUrl + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(options.token ? { "x-access-token": options.token } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Scholar API ${path} 失败 ${response.status}: ${body.message ?? ""}`);
    return body;
  };

  const existingRows = await request("/api/scholar/entries");
  const existing = new Map(existingRows.filter((row) => row.sourceRef).map((row) => [row.sourceRef, row]));
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of bundle.entries) {
    const current = existing.get(entry.stableId);
    const payload = {
      sourceRef: entry.stableId,
      title: entry.title,
      content: entry.content,
      summary: entry.summary,
      category: entry.category,
      tags: entry.tags,
      spaceKey: entry.kind === "product" ? "product" : "development",
      sourceRevision: entry.sourceRevision,
      sourceUrl: entry.sourceUrl,
      requirementId: entry.requirementId,
      requirementUrl: entry.requirementUrl,
    };
    const unchanged = current && ["title", "content", "summary", "category", "sourceRevision", "sourceUrl", "requirementId", "requirementUrl"]
      .every((field) => current[field] === payload[field])
      && JSON.stringify(current.tags ?? []) === JSON.stringify(payload.tags)
      && current.spaceKey === payload.spaceKey;
    if (unchanged) {
      skipped++;
      continue;
    }
    if (!current) {
      await request("/api/scholar/entries", { method: "POST", body: JSON.stringify(payload) });
      created++;
    } else {
      await request("/api/scholar/entries/" + current.id, { method: "PATCH", body: JSON.stringify(payload) });
      updated++;
    }
  }

  let published = false;
  if (options.publishProduct) {
    const productRows = await request("/api/scholar/entries?spaceKey=product");
    const wanted = new Set(bundle.entries.filter((entry) => entry.kind === "product").map((entry) => entry.stableId));
    const productEntries = productRows.filter((row) => wanted.has(row.sourceRef));
    if (productEntries.length !== 20) throw new Error(`product 发布前必须同步全部 20 条帮助，当前 ${productEntries.length} 条`);
    const version = await request("/api/scholar/spaces/product/versions", {
      method: "POST",
      body: JSON.stringify({ version: options.version, sourceRevision: bundle.sourceRevision }),
    });
    await request("/api/scholar/versions/" + version.id + "/publish", {
      method: "POST",
      body: JSON.stringify({
        entryIds: productRows.map((row) => row.id),
        deploymentRef: options.deploymentRef,
        publishedBy: options.publishedBy ?? "knowledge-sync",
      }),
    });
    published = true;
  }

  return { dryRun: false, created, updated, skipped, published, total: bundle.entries.length };
}
