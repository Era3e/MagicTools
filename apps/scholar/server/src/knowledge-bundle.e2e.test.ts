// @database-integration: required by test:db
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

interface BundleEntry {
  stableId: string;
  kind: "development" | "product";
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  sourceRevision: string;
  sourceUrl: string;
  requirementId: string;
  requirementUrl: string;
}

describe("knowledge bundle", () => {
  let app: INestApplication;
  const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../../docs/knowledge/initial-bundle.json"), "utf8")) as {
    sourceRevision: string;
    entries: BundleEntry[];
  };

  beforeAll(async () => {
    process.env.MT_LLM_STUB = "1";
    await ensureDatabase();
    await migrate();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/scholar");
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE entry_entities, relations, entities, entries CASCADE");
  });

  async function createEntry(entry: BundleEntry) {
    const response = await request(app.getHttpServer()).post("/api/scholar/entries").send({
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
    });
    expect(response.status).toBe(201);
    return response.body as { id: string; sourceRef: string; sourceUrl: string; requirementId: string };
  }

  it("40 条固定任务和问题逐条命中且 development 不进入 public", async () => {
    const rows: Array<{ id: string; kind: string }> = [];
    for (const entry of bundle.entries) {
      const row = await createEntry(entry);
      expect(row.sourceRef).toBe(entry.stableId);
      expect(row.sourceUrl).toBe(entry.sourceUrl);
      expect(row.requirementId).toBe("P20");
      rows.push({ id: row.id, kind: entry.kind });
    }

    const version = await request(app.getHttpServer()).post("/api/scholar/spaces/product/versions").send({
      version: "p20-e2e-1",
      sourceRevision: bundle.sourceRevision,
    });
    expect(version.status).toBe(201);
    const published = await request(app.getHttpServer())
      .post("/api/scholar/versions/" + version.body.id + "/publish")
      .send({
        entryIds: rows.filter((row) => row.kind === "product").map((row) => row.id),
        deploymentRef: "p20-e2e-registry",
        publishedBy: "database-test",
      });
    expect(published.status).toBe(201);

    for (const entry of bundle.entries.filter((item) => item.kind === "development")) {
      const search = await request(app.getHttpServer())
        .get("/api/scholar/entries/search?q=" + encodeURIComponent(entry.title) + "&mode=fts&spaceKey=development");
      expect(search.status).toBe(200);
      expect(
        search.body.some((row: { sourceRef: string }) => row.sourceRef === entry.stableId),
        `development 检索未命中 ${entry.stableId}`
      ).toBe(true);
    }

    for (const entry of bundle.entries.filter((item) => item.kind === "product")) {
      const search = await request(app.getHttpServer())
        .post("/api/scholar/public/search")
        .send({ q: entry.title, limit: 5 });
      expect(search.status).toBe(200);
      expect(
        search.body.candidates.some((row: { title: string }) => row.title === entry.title),
        `public 检索未命中 ${entry.stableId}`
      ).toBe(true);
    }

    const developmentProbe = bundle.entries.find((entry) => entry.kind === "development");
    expect(developmentProbe).toBeTruthy();
    const leaked = await request(app.getHttpServer())
      .post("/api/scholar/public/search")
      .send({ q: developmentProbe!.title, limit: 20 });
    expect(leaked.status).toBe(200);
    expect(leaked.body.candidates.some((row: { title: string }) => row.title === developmentProbe!.title)).toBe(false);
  });

  it("sourceRef 重复导入保持 40 条且不新建重复条目", async () => {
    for (const entry of bundle.entries) await createEntry(entry);
    for (const entry of bundle.entries) await createEntry(entry);
    const count = await pool.query("SELECT count(*)::int AS n FROM entries WHERE source_ref LIKE 'P20-%'");
    expect(count.rows[0].n).toBe(40);
  });

  it("未授权访问 development 管理检索返回 403", async () => {
    const previous = process.env.SCHOLAR_ADMIN_AUTH;
    delete process.env.SCHOLAR_ADMIN_AUTH;
    try {
      const response = await request(app.getHttpServer()).get("/api/scholar/entries?spaceKey=development");
      expect(response.status).toBe(403);
    } finally {
      process.env.SCHOLAR_ADMIN_AUTH = previous ?? "disabled";
    }
  });
});
