import { describe, expect, it } from "vitest";
import {
  buildConfigSnapshot,
  buildDatasetFingerprint,
  compareEvaluationItems,
  scoreActionCase,
  scoreKnowledgeCase,
  scoreRoutingCase,
  type EvaluationItemStatus,
} from "./evaluation-scoring";
import type { EvaluationCaseRow } from "./evaluation-suite.repo";

const baseCase = {
  id: "case-1",
  caseKey: "route-dev-1",
  caseType: "routing",
  split: "dev",
  message: "查询本月销售额",
  history: [],
  enabled: true,
  datasetVersion: 1,
} satisfies Omit<EvaluationCaseRow, "expected">;

describe("P16 评分器", () => {
  it("routing 校验 domain、intent 与 confidence 下限", () => {
    const expected = { domain: "cybercloud", intent: "data_query", confidence: 0.6 };
    expect(scoreRoutingCase(expected, { domain: "cybercloud", intent: "data_query", confidence: 0.8 })).toEqual({ status: "pass", reason: "" });
    expect(scoreRoutingCase(expected, { domain: "magictools", intent: "data_query", confidence: 0.8 }).reason).toContain("domain");
    expect(scoreRoutingCase(expected, { domain: "cybercloud", intent: "product_inquiry", confidence: 0.8 }).reason).toContain("intent");
    expect(scoreRoutingCase(expected, { domain: "cybercloud", intent: "data_query", confidence: 0.3 }).reason).toContain("confidence");
  });

  it("knowledge 校验包含词、禁词与引用数量", () => {
    const expected = { contains: ["回退方案"], forbidden: ["密钥"], minCitations: 1 };
    expect(scoreKnowledgeCase(expected, { reply: "发布后执行回退方案", citations: [{ id: "1" }] }).status).toBe("pass");
    expect(scoreKnowledgeCase(expected, { reply: "发布后执行回退方案，密钥为空", citations: [{ id: "1" }] }).reason).toContain("禁词");
    expect(scoreKnowledgeCase(expected, { reply: "发布后执行回退方案", citations: [] }).reason).toContain("引用");
  });

  it("action 只做 action 与 params 部分匹配", () => {
    const expected = { action: "trigger_collect", params: { sourceId: "src-1" } };
    expect(scoreActionCase(expected, { action: "trigger_collect", params: { sourceId: "src-1", extra: 1 } }).status).toBe("pass");
    expect(scoreActionCase(expected, { action: "create_requirement", params: { sourceId: "src-1" } }).reason).toContain("action");
    expect(scoreActionCase(expected, { action: "trigger_collect", params: { sourceId: "other" } }).reason).toContain("sourceId");
  });

  it("数据集指纹覆盖 split、消息、history 与期望结果", () => {
    const a = { ...baseCase, expected: { domain: "cybercloud", intent: "data_query" } };
    const b = { ...a, expected: { domain: "cybercloud", intent: "product_inquiry" } };
    const fa = buildDatasetFingerprint([a]);
    const fb = buildDatasetFingerprint([b]);
    expect(fa).toHaveLength(64);
    expect(fa).not.toBe(fb);
  });

  it("配置快照仅保留白名单和非秘密布尔状态", () => {
    process.env.DEEPSEEK_API_KEY = "secret-deepseek";
    process.env.ZHIPU_API_KEY = "secret-zhipu";
    process.env.MT_LLM_STUB = "1";
    process.env.LLM_PROVIDER = "zhipu";
    process.env.ZHIPU_MODEL = "glm-4-flash";
    process.env.DEEPSEEK_MODEL = "deepseek-reasoner";
    process.env.EVALUATION_TIMEOUT_MS = "bad";
    const snapshot = buildConfigSnapshot();
    const text = JSON.stringify(snapshot);
    expect(snapshot.llmMode).toBe("stub");
    expect(snapshot.provider).toBe("zhipu");
    expect(snapshot.model).toBe("glm-4-flash");
    process.env.LLM_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    expect(buildConfigSnapshot().model).toBe("deepseek-chat");
    expect(buildConfigSnapshot().timeoutMs).toBe(15000);
    expect(text).not.toContain("secret-deepseek");
    expect(text).not.toContain("secret-zhipu");
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.ZHIPU_API_KEY;
    delete process.env.DEEPSEEK_MODEL;
    delete process.env.EVALUATION_TIMEOUT_MS;
  });

  it("版本比较输出 fixed/regressed 且不同 case 不误报", () => {
    const baseline = new Map<string, EvaluationItemStatus>([
      ["a", "fail"],
      ["b", "pass"],
      ["c", "error"],
    ]);
    const current = new Map<string, EvaluationItemStatus>([
      ["a", "pass"],
      ["b", "fail"],
      ["c", "pass"],
    ]);
    const result = compareEvaluationItems(baseline, current);
    expect(result.summary.fixed).toBe(2);
    expect(result.summary.regressed).toBe(1);
    expect(result.transitions.find((t) => t.caseId === "a")?.kind).toBe("fixed");
    expect(result.transitions.find((t) => t.caseId === "b")?.kind).toBe("regressed");
  });
});
