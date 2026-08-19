import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

describe("entries", () => {
  let app: INestApplication;

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
    await app.close();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE entry_entities, relations, entities, entries CASCADE");
  });

  it("POST /api/scholar/entries 手动录入并生成 embedding", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/scholar/entries")
      .send({ title: "测试条目", content: "这是一段测试内容", category: "测试分类", tags: ["a", "b"] });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe("manual");
    expect(res.body.title).toBe("测试条目");
    expect(res.body.tags).toEqual(["a", "b"]);
    expect(res.body.assistantScope).toBe(false);
    const row = await pool.query("SELECT embedding IS NOT NULL AS has_vec FROM entries WHERE id = $1", [res.body.id]);
    expect(row.rows[0].has_vec).toBe(true);
  });

  it("GET /api/scholar/entries 列表并支持分类筛选", async () => {
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "A" });
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "B", category: "分类X" });
    const all = await request(app.getHttpServer()).get("/api/scholar/entries");
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);
    const filtered = await request(app.getHttpServer()).get("/api/scholar/entries?category=%E5%88%86%E7%B1%BBX");
    expect(filtered.status).toBe(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].title).toBe("B");
  });

  it("PATCH /api/scholar/entries/:id 更新圈定标记与分类", async () => {
    const created = await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "C" });
    const res = await request(app.getHttpServer())
      .patch("/api/scholar/entries/" + created.body.id)
      .send({ assistantScope: true, category: "圈定" });
    expect(res.status).toBe(200);
    expect(res.body.assistantScope).toBe(true);
    expect(res.body.category).toBe("圈定");
  });

  it("POST /api/scholar/entries 标题缺失返回 400", async () => {
    const res = await request(app.getHttpServer()).post("/api/scholar/entries").send({ content: "无标题" });
    expect(res.status).toBe(400);
  });

  it("PATCH 不存在的条目返回 404", async () => {
    const res = await request(app.getHttpServer())
      .patch("/api/scholar/entries/00000000-0000-0000-0000-000000000000")
      .send({ assistantScope: true });
    expect(res.status).toBe(404);
  });
});
