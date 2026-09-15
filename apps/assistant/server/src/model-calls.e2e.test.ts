// @database-integration: required by test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordModelCall } from "@mt/db";
import { ensureDatabase, migrate, pool } from "./db";

let available = false;

beforeAll(async () => {
  try {
    await ensureDatabase();
    await migrate();
    available = true;
  } catch (error) {
    // 数据库是本用例的关键依赖，初始化失败必须保留原始错误。
    throw error;
  }
}, 30000);

afterAll(async () => {
  if (available) await pool.query("DELETE FROM model_calls WHERE id LIKE 'model-call-test-%'");
});

describe("model_calls", () => {
  it("保存真实模型身份、重试与未知 token 来源", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await recordModelCall(pool, {
      id: "model-call-test-unknown",
      service: "assistant",
      operation: "chat-stream",
      provider: "zhipu",
      requestedModel: "glm-custom",
      effectiveModel: "glm-custom",
      status: "success",
      attempt: 2,
      attempts: 2,
      inputTokens: null,
      outputTokens: null,
      tokenSource: "unknown",
      latencyMs: 120,
      taskId: "task-1",
      traceId: "trace-1",
      cancelled: false,
      context: { conversationId: "conversation-1" },
    });
    const row = await pool.query("SELECT * FROM model_calls WHERE id = 'model-call-test-unknown'");
    expect(row.rows[0]).toMatchObject({
      service: "assistant",
      operation: "chat-stream",
      status: "success",
      attempt: 2,
      attempts: 2,
      input_tokens: null,
      output_tokens: null,
      token_source: "unknown",
      task_id: "task-1",
      trace_id: "trace-1",
      context: { conversationId: "conversation-1" },
    });
  });

  it("拒绝估算 token 来源并保持调用 ID 幂等", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await expect(pool.query(
      "INSERT INTO model_calls (id, service, operation, provider, effective_model, status, attempt, attempts, token_source, latency_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      ["model-call-test-invalid", "assistant", "chat", "zhipu", "glm-4-flash", "success", 1, 1, "estimated", 10]
    )).rejects.toThrow(/token_source/);
    await recordModelCall(pool, {
      id: "model-call-test-idempotent",
      service: "assistant",
      operation: "embedding",
      provider: "zhipu",
      requestedModel: null,
      effectiveModel: "embedding-2",
      status: "success",
      attempt: 1,
      attempts: 1,
      inputTokens: 3,
      outputTokens: null,
      tokenSource: "provider",
      latencyMs: 20,
      cancelled: false,
      context: {},
    });
    await recordModelCall(pool, {
      id: "model-call-test-idempotent",
      service: "assistant",
      operation: "embedding",
      provider: "zhipu",
      requestedModel: null,
      effectiveModel: "embedding-2",
      status: "cancelled",
      attempt: 1,
      attempts: 1,
      inputTokens: null,
      outputTokens: null,
      tokenSource: "unknown",
      latencyMs: 21,
      cancelled: true,
      context: {},
    });
    const rows = await pool.query("SELECT status FROM model_calls WHERE id = 'model-call-test-idempotent'");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].status).toBe("success");
  });
});
