// @database-integration: required by test:db
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

describe("entries", () => {
  let app: INestApplication;
  let available = false;

  beforeAll(async () => {
    try {
      process.env.MT_LLM_STUB = "1";
      await ensureDatabase();
      await migrate();
      available = true;
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = moduleRef.createNestApplication();
      app.setGlobalPrefix("api/scholar");
      await app.init();
    } catch (error) {
    // 关键数据库套件必须失败并保留原错误，不能把初始化异常变成跳过。
    throw error;
  }
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    if (!available) return;
    await pool.query("TRUNCATE entry_entities, relations, entities, entries CASCADE");
  });

  it("POST /api/scholar/entries 手动录入并生成 embedding", async (ctx) => {
    if (!available) { ctx.skip(); return; }
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

  it("GET /api/scholar/entries 列表并支持分类筛选", async (ctx) => {
    if (!available) { ctx.skip(); return; }
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

  it("sourceRef 导入幂等并携带来源与需求证据", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const body = {
      sourceRef: "P20-D01",
      title: "系统由哪些边界组成？",
      content: "代码入口与事实源：docs/code-wiki/overview.md",
      summary: "系统边界",
      category: "开发导航",
      tags: ["开发知识"],
      spaceKey: "development",
      sourceRevision: "commit-p20",
      sourceUrl: "https://github.com/Era3e/MagicTools/blob/commit-p20/docs/code-wiki/overview.md",
      requirementId: "P20",
    };
    const first = await request(app.getHttpServer()).post("/api/scholar/entries").send(body);
    expect(first.status).toBe(201);
    expect(first.body.source).toBe("manual");
    expect(first.body.sourceRef).toBe("P20-D01");
    expect(first.body.sourceUrl).toContain("docs/code-wiki/overview.md");
    expect(first.body.requirementId).toBe("P20");

    const second = await request(app.getHttpServer()).post("/api/scholar/entries").send(body);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    const count = await pool.query("SELECT count(*)::int AS n FROM entries WHERE source_ref='P20-D01'");
    expect(count.rows[0].n).toBe(1);
  });

  it("sourceRef 内容变化生成新修订且重复导入不再递增", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const base = {
      sourceRef: "P20-D02",
      title: "配置事实源在哪？",
      content: "第一版内容",
      spaceKey: "development",
    };
    const first = await request(app.getHttpServer()).post("/api/scholar/entries").send(base);
    expect(first.status).toBe(201);

    const changed = await request(app.getHttpServer()).post("/api/scholar/entries").send({
      ...base,
      content: "第二版内容",
      sourceRevision: "commit-p20-v2",
    });
    expect(changed.status).toBe(201);
    expect(changed.body.id).toBe(first.body.id);
    expect(changed.body.content).toBe("第二版内容");
    expect(changed.body.revisionNo).toBe(2);
    expect(changed.body.sourceRevision).toBe("commit-p20-v2");

    const replay = await request(app.getHttpServer()).post("/api/scholar/entries").send({
      ...base,
      content: "第二版内容",
      sourceRevision: "commit-p20-v2",
    });
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);
    expect(replay.body.revisionNo).toBe(2);
    expect((await pool.query("SELECT count(*)::int AS n FROM entry_revisions WHERE entry_id=$1", [first.body.id])).rows[0].n).toBe(2);
  });

  it("管理列表和检索支持 development 空间过滤", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await request(app.getHttpServer()).post("/api/scholar/entries").send({
      title: "内部代码入口", content: "development only source path", spaceKey: "development",
    });
    await request(app.getHttpServer()).post("/api/scholar/entries").send({
      title: "公开用户任务", content: "product help task", spaceKey: "product",
    });
    const list = await request(app.getHttpServer()).get("/api/scholar/entries?spaceKey=development");
    expect(list.status).toBe(200);
    expect(list.body.map((item: { title: string }) => item.title)).toEqual(["内部代码入口"]);

    const search = await request(app.getHttpServer()).get("/api/scholar/entries/search?q=source&mode=fts&spaceKey=development");
    expect(search.status).toBe(200);
    expect(search.body.map((item: { title: string }) => item.title)).toEqual(["内部代码入口"]);
  });

  it("PATCH /api/scholar/entries/:id 更新圈定标记与分类", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer()).post("/api/scholar/entries").send({ title: "C" });
    const res = await request(app.getHttpServer())
      .patch("/api/scholar/entries/" + created.body.id)
      .send({ assistantScope: true, category: "圈定" });
    expect(res.status).toBe(200);
    expect(res.body.assistantScope).toBe(true);
    expect(res.body.category).toBe("圈定");
  });

  it("POST /api/scholar/entries 标题缺失返回 400", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/scholar/entries").send({ content: "无标题" });
    expect(res.status).toBe(400);
  });

  it("PATCH 不存在的条目返回 404", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer())
      .patch("/api/scholar/entries/00000000-0000-0000-0000-000000000000")
      .send({ assistantScope: true });
    expect(res.status).toBe(404);
  });
});
