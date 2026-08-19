import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { migrate, pool } from "./db";

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    await migrate();
    available = true;
    await pool.query("DELETE FROM surveys WHERE name = 'E2E调研'");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/investigator");
    await app.init();
  } catch {
    available = false;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("surveys", () => {
  it("创建并列出调研主题", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer())
      .post("/api/investigator/surveys")
      .send({ name: "E2E调研", appToken: "appX", tableId: "tblX", answerFields: ["回答"] });
    expect(created.status).toBe(201);
    expect(created.body.appToken).toBe("appX");

    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    expect(list.status).toBe(200);
    expect(list.body.some((s: { name: string }) => s.name === "E2E调研")).toBe(true);
  });

  it("更新主题状态到 archived", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const patched = await request(app.getHttpServer())
      .patch("/api/investigator/surveys/" + target.id)
      .send({ status: "archived" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("archived");
  });

  it("feishu-status 未配置凭证返回明确状态", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_STUB;
    const res = await request(app.getHttpServer()).get("/api/investigator/meta/feishu-status");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });
});
