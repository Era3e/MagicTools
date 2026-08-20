import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";

const VALID_CODE = `import { Card } from "antd";
export default function Demo() {
  return <Card title="演示">你好</Card>;
}
`;

describe("preview", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/designer");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/designer/preview 编译并缓存，GET 取回 HTML", async () => {
    const res = await request(app.getHttpServer()).post("/api/designer/preview").send({ code: VALID_CODE });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.previewId).toBeTruthy();
    const got = await request(app.getHttpServer()).get("/api/designer/preview/" + res.body.previewId);
    expect(got.status).toBe(200);
    expect(got.headers["content-type"]).toContain("text/html");
    expect(got.text).toContain('<div id="root">');
  }, 30000);

  it("非法源码返回编译错误", async () => {
    const res = await request(app.getHttpServer()).post("/api/designer/preview").send({ code: "const x = {" });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBeTruthy();
  }, 30000);

  it("不存在的预览返回 404", async () => {
    const res = await request(app.getHttpServer()).get("/api/designer/preview/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("code 缺失返回 400", async () => {
    const res = await request(app.getHttpServer()).post("/api/designer/preview").send({});
    expect(res.status).toBe(400);
  });
});
