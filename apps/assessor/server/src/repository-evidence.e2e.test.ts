// @database-integration: required by test:db
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    await ensureDatabase();
    await migrate();
    available = true;
    await pool.query("DELETE FROM repository_evidence_tasks");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/assessor");
    await app.init();
  } catch (error) {
    throw error;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("仓库证据反向整理", () => {
  it("按提交筛选五类源码并生成可定位候选", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.GITHUB_STUB = "1";
    const res = await request(app.getHttpServer())
      .post("/api/assessor/repository-evidence/reverse-engineer")
      .send({ repo: "Era3e/MagicTools", commitSha: "f".repeat(40) });
    delete process.env.GITHUB_STUB;

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.task.totalFiles).toBe(7);
    expect(res.body.task.selectedFiles).toBe(6);
    expect(res.body.task.commitMessage).toContain("示例导出");
    expect(res.body.candidates).toHaveLength(6);
    expect(new Set(res.body.candidates.map((item: { category: string }) => item.category))).toEqual(
      new Set(["routes", "controller", "service", "schema", "tests"])
    );
    for (const candidate of res.body.candidates) {
      expect(candidate.motivation).toBe("unknown");
      expect(["f".repeat(40), "e".repeat(40)]).toContain(candidate.evidence.commit);
      expect(candidate.evidence.path).toMatch(/\.(ts|tsx)$/);
      expect(candidate.evidence.startLine).toBeGreaterThan(0);
      expect(candidate.evidence.endLine).toBeGreaterThanOrEqual(candidate.evidence.startLine);
      expect(candidate.evidence.url).toContain("/blob/" + candidate.evidence.commit + "/");
      expect(candidate.evidence.excerpt.length).toBeGreaterThan(0);
      expect(candidate.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    }
    const removed = res.body.candidates.find((candidate: { path: string }) => candidate.path.endsWith("legacy.service.test.ts"));
    expect(removed.evidence.commit).toBe("e".repeat(40));
    expect(removed.evidence.startLine).toBe(1);
    const controller = res.body.candidates.find((candidate: { path: string }) => candidate.path.endsWith("export.controller.ts"));
    expect(controller.evidence.startLine).toBe(1);
    expect(controller.evidence.endLine).toBe(3);
    const routes = res.body.candidates.find((candidate: { path: string }) => candidate.path.endsWith("routes.ts"));
    expect(routes.evidence.startLine).toBe(4);
    expect(routes.evidence.endLine).toBe(4);
  });

  it("同仓库同SHA重复采集幂等且不新增候选", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.GITHUB_STUB = "1";
    const first = await request(app.getHttpServer())
      .post("/api/assessor/repository-evidence/reverse-engineer")
      .send({ repo: "duplicate/repo", commitSha: "abc1234" });
    const second = await request(app.getHttpServer())
      .post("/api/assessor/repository-evidence/reverse-engineer")
      .send({ repo: "duplicate/repo", commitSha: "abc1234" });
    delete process.env.GITHUB_STUB;

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.created).toBe(false);
    expect(second.body.task.id).toBe(first.body.task.id);
    expect(second.body.candidates).toHaveLength(first.body.candidates.length);
  });

  it("任务列表和详情保留采集证据", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/assessor/repository-evidence/tasks");
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(2);
    const target = list.body.items[0];
    const detail = await request(app.getHttpServer()).get("/api/assessor/repository-evidence/tasks/" + target.id);
    expect(detail.status).toBe(200);
    expect(detail.body.task.id).toBe(target.id);
    expect(detail.body.candidates.length).toBeGreaterThan(0);
  });
});
