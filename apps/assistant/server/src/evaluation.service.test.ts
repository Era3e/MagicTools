import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFewshotSamples, renderFewshotPrompt, IntentService } from "./intent.service";
import { buildConfusionMatrix, toDatasetRow, toDatasetJsonl } from "./evaluation.service";
import type { IntentLogRow } from "./intent-log.repo";

vi.mock("./intent-log.repo", () => ({
  listCorrectedLogs: vi.fn(async () => correctedLogsFixture),
  listIntentLogs: vi.fn(async () => []),
  insertIntentLog: vi.fn(),
  correctIntentLog: vi.fn(),
  intentStats: vi.fn(),
  intentConfusion: vi.fn(),
}));

const correctedLogsFixture = [
  { id: "1", message: "帮我建一个需求：导出报表", domain: "magictools", intent: "product_inquiry", confidence: 1, correctedIntent: "process_execution", createdAt: "2026-08-28T00:00:00Z" },
  { id: "2", message: "查询本月销售额", domain: "cybercloud", intent: "product_inquiry", confidence: 1, correctedIntent: "data_query", createdAt: "2026-08-28T00:00:01Z" },
  { id: "3", message: "系统又挂了", domain: "magictools", intent: "product_inquiry", confidence: 1, correctedIntent: "trouble_shooting", createdAt: "2026-08-28T00:00:02Z" },
  { id: "4", message: "我要投诉", domain: "magictools", intent: "product_inquiry", confidence: 1, correctedIntent: "complaint_feedback", createdAt: "2026-08-28T00:00:03Z" },
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("D-09 buildFewshotSamples", () => {
  it("按纠错意图分桶，每意图至多 perIntent 条", () => {
    const logs = [
      { message: "a", domain: "magictools", correctedIntent: "data_query" },
      { message: "b", domain: "magictools", correctedIntent: "data_query" },
      { message: "c", domain: "magictools", correctedIntent: "data_query" },
      { message: "d", domain: "magictools", correctedIntent: "data_query" },
      { message: "e", domain: "magictools", correctedIntent: "trouble_shooting" },
    ];
    const samples = buildFewshotSamples(logs, 3, 12);
    const dq = samples.filter((s) => s.intent === "data_query");
    expect(dq).toHaveLength(3);
    expect(dq.map((s) => s.message)).toEqual(["a", "b", "c"]);
    expect(samples.filter((s) => s.intent === "trouble_shooting")).toHaveLength(1);
  });

  it("correctedIntent 为空的行被跳过", () => {
    const logs = [
      { message: "a", domain: "magictools", correctedIntent: null },
      { message: "b", domain: "magictools", correctedIntent: "data_query" },
    ];
    const samples = buildFewshotSamples(logs, 3, 12);
    expect(samples).toHaveLength(1);
    expect(samples[0].message).toBe("b");
  });

  it("总数封顶 maxTotal", () => {
    const logs = Array.from({ length: 20 }, (_, i) => ({ message: "m" + i, domain: "magictools", correctedIntent: "data_query" }));
    const samples = buildFewshotSamples(logs, 10, 5);
    expect(samples).toHaveLength(5);
  });
});

describe("D-09 renderFewshotPrompt", () => {
  it("无样本时原样返回基础提示词", () => {
    expect(renderFewshotPrompt("BASE", [])).toBe("BASE");
  });

  it("注入样本后提示词含示例行与引导语", () => {
    const out = renderFewshotPrompt("BASE", [
      { message: "帮我建一个需求", domain: "magictools", intent: "process_execution" },
    ]);
    expect(out).toContain("BASE");
    expect(out).toContain("纠错确认");
    expect(out).toContain("帮我建一个需求");
    expect(out).toContain('intent: "process_execution"');
  });
});

describe("D-09 IntentService few-shot 注入", () => {
  it("classify 注入 few-shot 后桩模式仍正确判别（system prompt 含样本行）", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new IntentService();
    const route = await svc.classify("帮我创建一个需求：支持导出功能");
    expect(route.intent).toBe("process_execution");
    expect(route.fewshotCount).toBe(4);
  });

  it("纠错样本查询失败时退化为零样本不阻塞分类", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const { listCorrectedLogs } = await import("./intent-log.repo");
    const mock = vi.mocked(listCorrectedLogs);
    mock.mockRejectedValueOnce(new Error("db down"));
    const svc = new IntentService();
    const route = await svc.classify("你好");
    expect(route.intent).toBe("chitchat_reject");
    expect(route.fewshotCount).toBe(0);
  });

  it("clearFewshotCache 后缓存过期重新加载", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const { listCorrectedLogs } = await import("./intent-log.repo");
    const mock = vi.mocked(listCorrectedLogs);
    mock.mockClear();
    const svc = new IntentService();
    await svc.classify("查询一下数据");
    await svc.classify("再查一个");
    expect(mock).toHaveBeenCalledTimes(1);
    svc.clearFewshotCache();
    await svc.classify("第三个");
    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe("D-09 buildConfusionMatrix", () => {
  it("统计混淆对并忽略未知意图", () => {
    const m = buildConfusionMatrix([
      { predicted: "product_inquiry", actual: "data_query", count: 3 },
      { predicted: "product_inquiry", actual: "process_execution", count: 1 },
      { predicted: "unknown_intent", actual: "data_query", count: 5 },
    ]);
    expect(m.total).toBe(4);
    expect(m.matrix["product_inquiry"]["data_query"]).toBe(3);
    expect(m.matrix["product_inquiry"]["process_execution"]).toBe(1);
    expect(m.labels).toContain("complaint_feedback");
  });
});

describe("D-09 toDatasetRow / toDatasetJsonl", () => {
  const row: IntentLogRow = {
    id: "1",
    message: "帮我建一个需求",
    domain: "magictools",
    intent: "product_inquiry",
    confidence: 1,
    correctedIntent: "process_execution",
    createdAt: "2026-08-28T00:00:00Z",
  };

  it("导出行为 system/user/assistant 三消息结构，assistant 为标签 JSON", () => {
    const r = toDatasetRow(row, "SYS");
    expect(r.messages).toHaveLength(3);
    expect(r.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(r.messages[1]).toEqual({ role: "user", content: "帮我建一个需求" });
    const label = JSON.parse(r.messages[2].content) as { intent: string };
    expect(label.intent).toBe("process_execution");
  });

  it("JSONL 每行独立可解析", () => {
    const jsonl = toDatasetJsonl([toDatasetRow(row, "SYS"), toDatasetRow(row, "SYS")]);
    const lines = jsonl.split("\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
