import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";

describe("health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/assistant");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/assistant/health 返回 up", async () => {
    const res = await request(app.getHttpServer()).get("/api/assistant/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("up");
  });
});
