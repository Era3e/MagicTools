// @database-integration: required by test:db
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

let app: INestApplication;

beforeAll(async () => {
  process.env.MT_LLM_STUB = "1";
  process.env.ASSISTANT_ADMIN_AUTH = "disabled";
  process.env.ACTION_STUB = "1";
  process.env.CLARIFY_STUB_CONFIDENCE = "0.3";
  await ensureDatabase();
  await migrate();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/assistant");
  await app.init();
}, 60000);

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(async () => {
  await pool.query("TRUNCATE evaluation_run_items, evaluation_runs, assistant_badcases, assistant_traces, conversations, messages, intent_logs, feedback");
  await pool.query("DELETE FROM evaluation_cases WHERE source_type = 'assistant_badcase'");
});

describe("P17 badcase 闭环", () => {
  it("未携带网关管理员身份时拒绝访问 badcase 管理接口", async () => {
    const previous = process.env.ASSISTANT_ADMIN_AUTH;
    delete process.env.ASSISTANT_ADMIN_AUTH;
    try {
      const denied = await request(app.getHttpServer()).get("/api/assistant/badcases");
      expect(denied.status).toBe(403);
    } finally {
      process.env.ASSISTANT_ADMIN_AUTH = previous ?? "disabled";
    }
  });

  it("用户澄清生成 trace 与 routing badcase，不写管理员纠错", async () => {
    const chat = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个需求：支持导出功能" });
    expect(chat.status).toBe(201);
    expect(chat.body.clarifying).toBe(true);
    const rows = await pool.query(`
      SELECT l.corrected_intent, l.suggested_intent, l.trace_id, b.id AS badcase_id, b.source, b.stage, b.status
      FROM intent_logs l JOIN assistant_badcases b ON b.intent_log_id = l.id
    `);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].corrected_intent).toBeNull();
    expect(rows.rows[0].suggested_intent).toBeNull();
    expect(rows.rows[0]).toMatchObject({ source: "user_clarify", stage: "routing", status: "new" });
    const trace = await pool.query("SELECT id FROM assistant_traces WHERE id = $1", [rows.rows[0].trace_id]);
    expect(trace.rows).toHaveLength(1);
  });

  it("badcase 可确认并生成修复前失败的 regression baseline", async () => {
    await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个需求：支持导出功能" });
    const list = await request(app.getHttpServer()).get("/api/assistant/badcases");
    const id = list.body[0].id;
    const confirmed = await request(app.getHttpServer()).post("/api/assistant/badcases/" + id + "/confirm").send({
      title: "导出需求误路由",
      stage: "routing",
      severity: "high",
      expected: { domain: "cybercloud", intent: "data_query" },
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe("classified");
    const regression = await request(app.getHttpServer()).post("/api/assistant/badcases/" + id + "/regression").send({});
    expect(regression.status).toBe(200);
    expect(regression.body.status).toBe("regression_ready");
    expect(regression.body.baselineRunId).toBeTruthy();
    const item = await pool.query(`
      SELECT i.status FROM evaluation_run_items i
      WHERE i.run_id=$1 AND i.case_id=$2
    `, [regression.body.baselineRunId, regression.body.evaluationCaseId]);
    expect(item.rows[0].status).not.toBe("pass");
  });

  it("badcase 可幂等关联 Manager 需求", async () => {
    await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个需求：支持导出功能" });
    const list = await request(app.getHttpServer()).get("/api/assistant/badcases");
    const id = list.body[0].id;
    await request(app.getHttpServer()).post("/api/assistant/badcases/" + id + "/confirm").send({
      title: "导出需求误路由",
      stage: "routing",
      severity: "high",
      expected: { domain: "cybercloud", intent: "data_query" },
    });
    await request(app.getHttpServer()).post("/api/assistant/badcases/" + id + "/regression").send({});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({
      id: "req-badcase-1", url: "/manager/requirements/req-badcase-1", status: "waiting", prUrl: "",
    }), { status: 200 })) as typeof fetch;
    try {
      const created = await request(app.getHttpServer()).post("/api/assistant/badcases/" + id + "/requirement").send({});
      expect(created.status).toBe(200);
      expect(created.body.status).toBe("fix_planned");
      expect(created.body.requirementId).toBe("req-badcase-1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("评测失败可转 badcase 并保留原始消息证据", async () => {
    const run = await request(app.getHttpServer())
      .post("/api/assistant/evaluation-suite/runs")
      .send({ split: "regression", label: "badcase-source" });
    expect(run.status).toBe(201);
    const detail = await request(app.getHttpServer()).get(`/api/assistant/evaluation-suite/runs/${run.body.id}`);
    expect(detail.status).toBe(200);
    const failed = detail.body.items.find((item: { status: string }) => item.status !== "pass");
    expect(failed).toBeTruthy();
    const created = await request(app.getHttpServer())
      .post(`/api/assistant/badcases/from-evaluation/${run.body.id}/${failed.caseKey}`)
      .send({});
    expect(created.status).toBe(200);
    expect(created.body.source).toBe("evaluation");
    expect(created.body.evidence.message).toBeTruthy();
    expect(created.body.evidence.history).toEqual([]);
  });
});
