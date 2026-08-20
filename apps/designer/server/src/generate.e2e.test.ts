import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

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
    app.setGlobalPrefix("api/designer");
    await app.init();
  } catch (err) {
    console.warn("[generate.e2e] 数据库不可用，跳过: " + String(err));
    available = false;
  }
}, 30000);

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(async () => {
  if (!available) return;
  await pool.query("TRUNCATE generations, components");
});

describe("generate", () => {
  it("POST /api/designer/generate 生成组件并落历史", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer())
      .post("/api/designer/generate")
      .send({ prompt: "生成一个问候卡片组件" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("ok");
    expect(res.body.componentName).toBe("GreetingCard");
    expect(res.body.code).toContain("GreetingCard");
    expect(res.body.code).toContain('from "@mt/ui"');
    const rows = await pool.query("SELECT status, prompt FROM generations");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].status).toBe("ok");
    expect(rows.rows[0].prompt).toBe("生成一个问候卡片组件");
  });

  it("带设计稿图片输入同样生成并记录 image_url", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer())
      .post("/api/designer/generate")
      .send({ prompt: "按设计稿生成按钮", imageUrl: "https://example.com/design.png" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("ok");
    const rows = await pool.query("SELECT image_url FROM generations");
    expect(rows.rows[0].image_url).toBe("https://example.com/design.png");
  });

  it("GET /api/designer/generations 返回历史列表", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await request(app.getHttpServer()).post("/api/designer/generate").send({ prompt: "组件A" });
    await request(app.getHttpServer()).post("/api/designer/generate").send({ prompt: "组件B" });
    const res = await request(app.getHttpServer()).get("/api/designer/generations");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("prompt 缺失返回 400", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/designer/generate").send({});
    expect(res.status).toBe(400);
  });

  it("LLM 输出无法解析时落 failed 历史", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const prev = process.env.MT_LLM_STUB;
    delete process.env.MT_LLM_STUB;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "这不是 JSON" } }] }), { status: 200 })
      )
    );
    try {
      const res = await request(app.getHttpServer()).post("/api/designer/generate").send({ prompt: "组件X" });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("failed");
      expect(res.body.error).toBeTruthy();
      const rows = await pool.query("SELECT status FROM generations");
      expect(rows.rows[0].status).toBe("failed");
    } finally {
      vi.unstubAllGlobals();
      if (prev) process.env.MT_LLM_STUB = prev;
    }
  });
});
