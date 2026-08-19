import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

describe("graph", () => {
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

  it("POST /api/scholar/graph/generate 抽取图谱并入库", async () => {
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "知识库系统设计", content: "知识库支持检索与图谱" });
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "向量检索方案", content: "检索方案详解" });
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "知识图谱入门", content: "图谱可视化" });
    const res = await request(app.getHttpServer()).post("/api/scholar/graph/generate");
    expect(res.status).toBe(201);
    expect(res.body.entities).toBe(3);
    expect(res.body.relations).toBe(2);
    const got = await request(app.getHttpServer()).get("/api/scholar/graph");
    expect(got.status).toBe(200);
    expect(got.body.nodes).toHaveLength(3);
    expect(got.body.edges).toHaveLength(2);
    const names = got.body.nodes.map((n: { name: string }) => n.name).sort();
    expect(names).toEqual(["图谱", "检索", "知识库"]);
    const kb = got.body.nodes.find((n: { name: string }) => n.name === "知识库");
    expect(kb.entryCount).toBeGreaterThanOrEqual(1);
    const edge = got.body.edges[0];
    expect(names).toContain(edge.from);
    expect(names).toContain(edge.to);
  });

  it("重复生成重建图谱不产生重复", async () => {
    await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "知识库系统设计" });
    const first = await request(app.getHttpServer()).post("/api/scholar/graph/generate");
    expect(first.body.entities).toBe(3);
    const second = await request(app.getHttpServer()).post("/api/scholar/graph/generate");
    expect(second.status).toBe(201);
    expect(second.body.entities).toBe(3);
    expect(second.body.relations).toBe(2);
    const got = await request(app.getHttpServer()).get("/api/scholar/graph");
    expect(got.body.nodes).toHaveLength(3);
    expect(got.body.edges).toHaveLength(2);
  });

  it("无条目时生成返回 400", async () => {
    const res = await request(app.getHttpServer()).post("/api/scholar/graph/generate");
    expect(res.status).toBe(400);
  });
});
