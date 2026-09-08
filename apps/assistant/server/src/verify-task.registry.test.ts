import { describe, expect, it, vi } from "vitest";
import type { DirectResult } from "./direct-query.service";
import { VerifyTaskRegistry } from "./verify-task.registry";

const DIRECT_OK: Extract<DirectResult, { applicable: true }> = {
  applicable: true,
  reply: "「本月销售额」本月为 12345 元（直连实时查询）",
  metricName: "本月销售额",
  value: 12345,
  unit: "元",
  latencyMs: 10,
  endpoint: "queryByStructure",
  timeFilter: "THIS_MONTH",
};

function agentOk(reply: string) {
  return Promise.resolve({ reply, meta: { sseType: "MARKDOWN", latencyMs: 100, agentId: "a1" } });
}

describe("VerifyTaskRegistry", () => {
  it("智能体一致 → consistent", async () => {
    const reg = new VerifyTaskRegistry();
    const task = reg.create({ directResult: DIRECT_OK, agentPromise: agentOk("本月销售额 12345 元") });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("consistent"));
  });

  it("数值分歧 → divergent 且带 verdict/agentReply", async () => {
    const reg = new VerifyTaskRegistry();
    const task = reg.create({ directResult: DIRECT_OK, agentPromise: agentOk("是 99999 元") });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("divergent"));
    const t = reg.get(task.taskId)!;
    expect(t.verdict?.directValue).toBe(12345);
    expect(t.agentReply).toContain("99999");
  });

  it("智能体无数值 → unverifiable", async () => {
    const reg = new VerifyTaskRegistry();
    const task = reg.create({ directResult: DIRECT_OK, agentPromise: agentOk("销售额没有具体数据") });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("unverifiable"));
  });

  it("智能体异常 → agent_failed", async () => {
    const reg = new VerifyTaskRegistry();
    const task = reg.create({ directResult: DIRECT_OK, agentPromise: Promise.reject(new Error("boom")) });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("agent_failed"));
  });

  it("SSE ERROR → agent_failed", async () => {
    const reg = new VerifyTaskRegistry();
    const task = reg.create({
      directResult: DIRECT_OK,
      agentPromise: Promise.resolve({
        reply: "查询失败：工具异常",
        meta: { sseType: "ERROR", latencyMs: 100, agentId: "a1", error: "工具异常" },
      }),
    });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("agent_failed"));
  });

  it("未知 taskId → null", () => {
    expect(new VerifyTaskRegistry().get("nope")).toBeNull();
  });

  it("超时后迟到的智能体返回不覆盖终态（不双写）", async () => {
    vi.stubEnv("CYBERCLOUD_VERIFY_TIMEOUT_MS", "30");
    let lateResolve: (v: { reply: string; meta: { sseType: string; latencyMs: number; agentId: string } }) => void = () => {};
    const agentPromise = new Promise<{ reply: string; meta: { sseType: string; latencyMs: number; agentId: string } }>((resolve) => {
      lateResolve = resolve;
    });
    const reg = new VerifyTaskRegistry();
    const task = reg.create({ directResult: DIRECT_OK, agentPromise });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("agent_timeout"), { timeout: 2000 });
    lateResolve({ reply: "本月销售额 12345 元", meta: { sseType: "MARKDOWN", latencyMs: 100, agentId: "a1" } });
    await new Promise((r) => setTimeout(r, 50));
    expect(reg.get(task.taskId)?.status).toBe("agent_timeout");
  });

  it("TTL 过期后 get 返回 null", async () => {
    vi.useFakeTimers();
    try {
      const reg = new VerifyTaskRegistry();
      const task = reg.create({ directResult: DIRECT_OK, agentPromise: agentOk("本月销售额 12345 元") });
      await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
      expect(reg.get(task.taskId)?.status).toBe("consistent");
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(reg.get(task.taskId)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
