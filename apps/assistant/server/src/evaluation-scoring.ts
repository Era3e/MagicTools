import { createHash } from "node:crypto";

export type EvaluationSplit = "dev" | "regression" | "holdout";
export type EvaluationCaseType = "routing" | "knowledge" | "action";
export type EvaluationItemStatus = "pass" | "fail" | "error" | "timeout" | "missing";

export interface RoutingExpectation {
  domain: string;
  intent: string;
  confidence?: number;
}

export interface KnowledgeExpectation {
  contains?: string[];
  forbidden?: string[];
  minCitations?: number;
}

export interface ActionExpectation {
  action: string;
  params?: Record<string, unknown>;
}

export interface ScoreResult {
  status: "pass" | "fail";
  reason: string;
}

export function scoreRoutingCase(
  expected: RoutingExpectation,
  actual: { domain: string; intent: string; confidence?: number }
): ScoreResult {
  const reasons: string[] = [];
  if (actual.domain !== expected.domain) reasons.push(`domain 应为 ${expected.domain}，实际 ${actual.domain}`);
  if (actual.intent !== expected.intent) reasons.push(`intent 应为 ${expected.intent}，实际 ${actual.intent}`);
  if (expected.confidence !== undefined && actual.confidence !== undefined && actual.confidence < expected.confidence) {
    reasons.push(`confidence 应不低于 ${expected.confidence}，实际 ${actual.confidence}`);
  }
  return reasons.length ? { status: "fail", reason: reasons.join("；") } : { status: "pass", reason: "" };
}

export function scoreKnowledgeCase(
  expected: KnowledgeExpectation,
  actual: { reply: string; citations: unknown[] }
): ScoreResult {
  const reasons: string[] = [];
  for (const word of expected.contains ?? []) {
    if (!actual.reply.includes(word)) reasons.push(`回答缺少「${word}」`);
  }
  for (const word of expected.forbidden ?? []) {
    if (actual.reply.includes(word)) reasons.push(`回答包含禁词「${word}」`);
  }
  const min = expected.minCitations ?? 0;
  if (actual.citations.length < min) reasons.push(`引用数量应不少于 ${min}，实际 ${actual.citations.length}`);
  return reasons.length ? { status: "fail", reason: reasons.join("；") } : { status: "pass", reason: "" };
}

export function scoreActionCase(expected: ActionExpectation, actual: { action: string; params?: Record<string, unknown> }): ScoreResult {
  const reasons: string[] = [];
  if (actual.action !== expected.action) reasons.push(`action 应为 ${expected.action}，实际 ${actual.action}`);
  for (const [key, value] of Object.entries(expected.params ?? {})) {
    if (actual.params?.[key] !== value) reasons.push(`params.${key} 应为 ${JSON.stringify(value)}，实际 ${JSON.stringify(actual.params?.[key])}`);
  }
  return reasons.length ? { status: "fail", reason: reasons.join("；") } : { status: "pass", reason: "" };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function buildDatasetFingerprint(
  cases: Array<{ caseKey: string; caseType: string; split: string; message: string; history: unknown; expected: unknown }>
): string {
  const payload = {
    schema: "assistant-evaluation-dataset/1",
    cases: cases
      .map((item) => ({
        caseKey: item.caseKey,
        caseType: item.caseType,
        split: item.split,
        message: item.message,
        history: item.history,
        expected: item.expected,
      }))
      .sort((a, b) => a.caseKey.localeCompare(b.caseKey)),
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

export interface EvaluationConfigSnapshot {
  promptVersion: string;
  provider: string;
  model: string;
  llmMode: "stub" | "real";
  deepseekConfigured: boolean;
  zhipuConfigured: boolean;
  clarifyThreshold: number;
  timeoutMs: number;
  fewshotPolicy: {
    enabled: boolean;
    perIntent: number;
    maxTotal: number;
    excludesEvaluationCases: boolean;
  };
}

export function buildConfigSnapshot(): EvaluationConfigSnapshot {
  const provider = process.env.LLM_PROVIDER === "zhipu" || !process.env.DEEPSEEK_API_KEY ? "zhipu" : "deepseek";
  const model =
    provider === "zhipu"
      ? process.env.ZHIPU_MODEL || "glm-4-flash"
      : "deepseek-chat";
  const timeoutRaw = Number(process.env.EVALUATION_TIMEOUT_MS ?? "15000");
  return {
    promptVersion: process.env.INTENT_PROMPT_VERSION || "2026-09-15.1",
    provider,
    model,
    llmMode: process.env.MT_LLM_STUB === "1" ? "stub" : "real",
    deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    zhipuConfigured: Boolean(process.env.ZHIPU_API_KEY),
    clarifyThreshold: Number(process.env.CLARIFY_THRESHOLD ?? "0.6"),
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw >= 1 ? timeoutRaw : 15000,
    fewshotPolicy: {
      enabled: true,
      perIntent: 3,
      maxTotal: 12,
      excludesEvaluationCases: true,
    },
  };
}

export interface EvaluationComparisonTransition {
  caseId: string;
  baseline: EvaluationItemStatus;
  current: EvaluationItemStatus;
  kind: "fixed" | "regressed" | "error" | "timeout" | "missing" | "unchanged";
}

export function compareEvaluationItems(
  baseline: Map<string, EvaluationItemStatus>,
  current: Map<string, EvaluationItemStatus>
): { summary: Record<string, number>; transitions: EvaluationComparisonTransition[] } {
  const transitions: EvaluationComparisonTransition[] = [];
  for (const [caseId, baselineStatus] of baseline) {
    const currentStatus = current.get(caseId);
    if (!currentStatus) {
      transitions.push({ caseId, baseline: baselineStatus, current: "missing", kind: "missing" });
      continue;
    }
    let kind: EvaluationComparisonTransition["kind"] = "unchanged";
    if (baselineStatus !== "pass" && currentStatus === "pass") kind = "fixed";
    else if (baselineStatus === "pass" && currentStatus !== "pass") {
      if (currentStatus === "error") kind = "error";
      else if (currentStatus === "timeout") kind = "timeout";
      else if (currentStatus === "missing") kind = "missing";
      else kind = "regressed";
    }
    transitions.push({ caseId, baseline: baselineStatus, current: currentStatus, kind });
  }
  for (const caseId of current.keys()) {
    if (!baseline.has(caseId)) transitions.push({ caseId, baseline: "missing", current: current.get(caseId)!, kind: "missing" });
  }
  const summary = Object.fromEntries(
    ["fixed", "regressed", "error", "timeout", "missing", "unchanged"].map((key) => [
      key,
      transitions.filter((item) => item.kind === key).length,
    ])
  );
  return { summary, transitions: transitions.sort((a, b) => a.caseId.localeCompare(b.caseId)) };
}
