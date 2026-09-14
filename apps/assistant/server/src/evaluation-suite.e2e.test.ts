// @database-integration: required by test:db
import { join } from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { runMigrations } from "@mt/db";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool, scholarPool } from "./db";
import { pseudoVector } from "./llm";

const SCHOLAR_TEST_URL = process.env.SCHOLAR_DATABASE_URL;
if (!SCHOLAR_TEST_URL) throw new Error("请通过 pnpm test:db 分配 Scholar 上游测试库");

let app: INestApplication;

async function seedKnowledge(message: string) {
  const vec = pseudoVector(message + "\n" + message);
  await scholarPool().query(
    "INSERT INTO entries (source, source_ref, title, content, assistant_scope, embedding) VALUES ('manual', NULL, $1, $2, true, $3::vector)",
    [message, message, "[" + vec.join(",") + "]"]
  );
}

beforeAll(async () => {
  process.env.MT_LLM_STUB = "1";
  process.env.SCHOLAR_DATABASE_URL = SCHOLAR_TEST_URL;
  await ensureDatabase();
  await migrate();
  await ensureDatabase(SCHOLAR_TEST_URL);
  await runMigrations(scholarPool(), join(__dirname, "..", "..", "..", "scholar", "server", "migrations"));
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/assistant");
  await app.init();
}, 60000);

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(async () => {
  await pool.query("TRUNCATE evaluation_run_items, evaluation_runs, conversations, messages, intent_logs, feedback");
  await scholarPool().query("TRUNCATE entries CASCADE");
});

describe("P16 独立评测套件", () => {
  it("种子数据按类型和 split 分布，且总数为 48", async () => {
    const res = await request(app.getHttpServer()).get("/api/assistant/evaluation-suite/cases");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(48);
    expect(res.body.bySplit).toEqual({ dev: 24, regression: 16, holdout: 8 });
    expect(res.body.byType).toEqual({ routing: 36, knowledge: 6, action: 6 });
  });

  it("评测消息指纹从纠错训练样本与导出中排除", async () => {
    const cases = await pool.query("SELECT message FROM evaluation_cases WHERE case_key = 'routing-dev-data-sales-month'");
    await pool.query(
      "INSERT INTO intent_logs (message, domain, intent, confidence, corrected_intent) VALUES ($1, 'magictools', 'product_inquiry', 1, 'data_query')",
      [cases.rows[0].message]
    );
    await pool.query(
      "INSERT INTO intent_logs (message, domain, intent, confidence, corrected_intent) VALUES ($1, 'magictools', 'product_inquiry', 1, 'data_query')",
      ["这是普通训练样本"]
    );
    await pool.query(
      "INSERT INTO intent_logs (message, domain, intent, confidence, corrected_intent) VALUES ($1, 'magictools', 'product_inquiry', 1, 'chitchat_reject')",
      ["ＨＥＬＬＯ　ＷＯＲＬＤ"]
    );
    const historyCase = await pool.query(
      `INSERT INTO evaluation_cases (case_key, case_type, split, message, history, expected, enabled)
       VALUES ('history-fingerprint-check', 'routing', 'dev', '后续问题', $1, '{"domain":"magictools","intent":"product_inquiry"}', false)
       RETURNING id`,
      [JSON.stringify([{ role: "user", content: "历史消息需要隔离" }])]
    );
    await pool.query(
      "INSERT INTO intent_logs (message, domain, intent, confidence, corrected_intent) VALUES ($1, 'magictools', 'product_inquiry', 1, 'product_inquiry')",
      ["历史消息需要隔离"]
    );
    const preview = await request(app.getHttpServer()).post("/api/assistant/intent-logs/export/preview");
    expect(preview.status).toBe(200);
    expect(preview.body.count).toBe(1);
    expect(JSON.stringify(preview.body.preview)).not.toContain(cases.rows[0].message);
    const finetune = await request(app.getHttpServer()).get("/api/assistant/intent-logs/finetune/status");
    expect(finetune.status).toBe(200);
    expect(finetune.body.corrected).toBe(1);
    await pool.query("DELETE FROM evaluation_cases WHERE id = $1", [historyCase.rows[0].id]);
  });

  it("dev run 持久化 24 条明细且配置快照不含密钥", async () => {
    const knowledgeCases = await pool.query("SELECT message FROM evaluation_cases WHERE case_type = 'knowledge' AND split = 'dev'");
    for (const row of knowledgeCases.rows) await seedKnowledge(row.message);
    process.env.DEEPSEEK_API_KEY = "secret-deepseek";
    process.env.ZHIPU_API_KEY = "secret-zhipu";
    const res = await request(app.getHttpServer())
      .post("/api/assistant/evaluation-suite/runs")
      .send({ split: "dev", label: "dev-ci" });
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.ZHIPU_API_KEY;
    expect(res.status).toBe(201);
    expect(res.body.expectedTotal).toBe(24);
    expect(res.body.itemCount).toBe(24);
    expect(res.body.status).toBe("completed");
    expect(JSON.stringify(res.body.configSnapshot)).not.toContain("secret-");

    const items = await pool.query("SELECT status, count(*)::int AS n FROM evaluation_run_items WHERE run_id = $1 GROUP BY status", [res.body.id]);
    expect(items.rows.reduce((sum, row) => sum + row.n, 0)).toBe(24);
    expect(items.rows.some((row) => row.status === "missing")).toBe(false);
  });

  it("同数据集 run 可比较，数据集漂移后拒绝比较", async () => {
    const first = await request(app.getHttpServer()).post("/api/assistant/evaluation-suite/runs").send({ split: "holdout", label: "baseline" });
    expect(first.status).toBe(201);
    const detail = await request(app.getHttpServer()).get(`/api/assistant/evaluation-suite/runs/${first.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.itemCount).toBe(8);
    expect(JSON.stringify(detail.body.items)).not.toContain("expected");
    expect(JSON.stringify(detail.body.items)).not.toContain("actual");
    expect(JSON.stringify(detail.body.items)).not.toContain("reason");
    expect(Object.keys(detail.body.items[0])).toEqual(["id", "caseKey", "caseType", "status", "latencyMs"]);
    const same = await request(app.getHttpServer())
      .post(`/api/assistant/evaluation-suite/runs/${first.body.id}/compare/${first.body.id}`)
      .send({});
    expect(same.status).toBe(200);
    expect(same.body.summary.regressed).toBe(0);

    await pool.query("UPDATE evaluation_cases SET expected = '{\"domain\":\"magictools\",\"intent\":\"product_inquiry\"}' WHERE case_key = 'routing-holdout-data-churn'");
    const second = await request(app.getHttpServer()).post("/api/assistant/evaluation-suite/runs").send({ split: "holdout", label: "changed" });
    expect(second.status).toBe(201);
    expect(second.body.datasetFingerprint).not.toBe(first.body.datasetFingerprint);
    const rejected = await request(app.getHttpServer())
      .post(`/api/assistant/evaluation-suite/runs/${first.body.id}/compare/${second.body.id}`)
      .send({});
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toContain("数据集指纹");
    await pool.query("UPDATE evaluation_cases SET expected = '{\"domain\":\"cybercloud\",\"intent\":\"data_query\"}' WHERE case_key = 'routing-holdout-data-churn'");
  });
});
