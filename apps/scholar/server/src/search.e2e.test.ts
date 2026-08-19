import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

describe("search", () => {
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

  it("GET /api/scholar/entries/search FTS 关键词命中", async () => {
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "苹果公司发布新手机", content: "苹果新品发布会" });
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "香蕉是水果" });
    const res = await request(app.getHttpServer()).get("/api/scholar/entries/search?q=%E8%8B%B9%E6%9E%9C&mode=fts");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].title).toContain("苹果");
  });

  it("GET /api/scholar/entries/search 向量相似度 top-k", async () => {
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "苹果公司发布新手机" });
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "香蕉是水果" });
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "量子计算进展" });
    const res = await request(app.getHttpServer()).get("/api/scholar/entries/search?q=%E8%8B%B9%E6%9E%9C&mode=vector&limit=2");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toContain("苹果");
    expect(typeof res.body[0].score).toBe("number");
  });

  it("q 缺失返回 400", async () => {
    const res = await request(app.getHttpServer()).get("/api/scholar/entries/search");
    expect(res.status).toBe(400);
  });
});
