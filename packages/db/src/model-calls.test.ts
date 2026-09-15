import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { recordModelCall } from "./model-calls";

describe("recordModelCall", () => {
  it("把可空用量与上下文映射为 model_calls 行", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const pool = { query } as unknown as Pool;
    await recordModelCall(pool, {
      id: "call-1",
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
      errorMessage: null,
      cancelled: false,
      context: { conversationId: "c1" },
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("INSERT INTO model_calls");
    expect(params.slice(0, 12)).toEqual([
      "call-1",
      "assistant",
      "chat-stream",
      "zhipu",
      "glm-custom",
      "glm-custom",
      "success",
      2,
      2,
      null,
      null,
      "unknown",
    ]);
    expect(params[17]).toBe(false);
    expect(params[18]).toBe(JSON.stringify({ conversationId: "c1" }));
  });
});
