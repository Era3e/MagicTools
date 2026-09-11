// @database-integration: required by test:db
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

const CODE = 'export default function Demo() { return <div>你好</div>; }';

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    await ensureDatabase();
    await migrate();
    available = true;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/designer");
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
  await pool.query("TRUNCATE generations, components");
});

describe("components", () => {
  it("沉淀入库并列表可查", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer())
      .post("/api/designer/components")
      .send({ name: "GreetingCard", description: "问候卡片", code: CODE });
    expect(res.status).toBe(201);
    expect(res.body.duplicated).toBe(false);
    expect(res.body.component.name).toBe("GreetingCard");

    const list = await request(app.getHttpServer()).get("/api/designer/components");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe("GreetingCard");
  });

  it("重名沉淀幂等返回已有组件", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await request(app.getHttpServer()).post("/api/designer/components").send({ name: "Card1", description: "", code: CODE });
    const again = await request(app.getHttpServer()).post("/api/designer/components").send({ name: "Card1", description: "重复", code: CODE + "// v2" });
    expect(again.status).toBe(201);
    expect(again.body.duplicated).toBe(true);
    expect(again.body.component.name).toBe("Card1");
    const list = await request(app.getHttpServer()).get("/api/designer/components");
    expect(list.body).toHaveLength(1);
  });

  it("取源码与删除", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer()).post("/api/designer/components").send({ name: "Card2", description: "", code: CODE });
    const id = created.body.component.id;
    const code = await request(app.getHttpServer()).get("/api/designer/components/" + id + "/code");
    expect(code.status).toBe(200);
    expect(code.body.code).toBe(CODE);
    const del = await request(app.getHttpServer()).delete("/api/designer/components/" + id);
    expect(del.status).toBe(200);
    const list = await request(app.getHttpServer()).get("/api/designer/components");
    expect(list.body).toHaveLength(0);
  });

  it("不存在的组件 404", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const code = await request(app.getHttpServer()).get("/api/designer/components/00000000-0000-0000-0000-000000000000/code");
    expect(code.status).toBe(404);
    const del = await request(app.getHttpServer()).delete("/api/designer/components/00000000-0000-0000-0000-000000000000");
    expect(del.status).toBe(404);
  });

  it("name 或 code 缺失返回 400", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/designer/components").send({ name: "X" });
    expect(res.status).toBe(400);
  });

  it("schema 随组件落库并可回读（含 parse 接口）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const name = "SchemaCard" + Date.now();
    const parseRes = await request(app.getHttpServer())
      .post("/api/designer/parse")
      .send({ code: `import { tokens } from "@mt/ui";
export default function ${name.replaceAll(/\W/g, "")}() {
  return <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.m, padding: tokens.spacing.m }} />;
}` });
    expect(parseRes.status).toBe(200);
    expect(parseRes.body.doc.root.component).toBe("div");

    const created = await request(app.getHttpServer())
      .post("/api/designer/components")
      .send({ name, description: "schema 测试", code: parseRes.body.doc ? "export default function " + name + "() { return <div />; }" : "", schema: parseRes.body.doc });
    expect(created.status).toBe(201);
    expect(created.body.component.schema).toBeTruthy();
    expect(created.body.component.schema.root.props.gap).toBe("md");

    const list = await request(app.getHttpServer()).get("/api/designer/components");
    const found = (list.body as Array<{ name: string; schema?: unknown }>).find((c) => c.name === name);
    expect(found?.schema).toBeTruthy();
  });
});
