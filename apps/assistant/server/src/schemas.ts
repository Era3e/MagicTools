import { z } from "zod";

export const chatInputSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1),
});

export const intentSchema = z.object({
  intent: z.enum([
    "product_inquiry",
    "data_query",
    "chitchat_reject",
    "process_execution",
    "trouble_shooting",
    "complaint_feedback",
  ]),
});

export const routingSchema = z.object({
  domain: z.enum(["magictools", "cybercloud", "chitchat"]),
  intent: z.enum([
    "product_inquiry",
    "data_query",
    "chitchat_reject",
    "process_execution",
    "trouble_shooting",
    "complaint_feedback",
  ]),
  confidence: z.coerce.number().min(0).max(1).default(1),
});

export const intentCorrectionSchema = z.object({
  correctedIntent: z.enum([
    "product_inquiry",
    "data_query",
    "chitchat_reject",
    "process_execution",
    "trouble_shooting",
    "complaint_feedback",
  ]),
});

export const evaluationRunSchema = z.object({
  split: z.enum(["dev", "regression", "holdout"]),
  label: z.string().trim().min(1).max(80).default("manual"),
});

export const badcaseConfirmSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).default(""),
  stage: z.enum(["routing", "knowledge", "action", "data", "safety", "other"]),
  severity: z.enum(["low", "medium", "high"]),
  expected: z.record(z.unknown()),
});

export const badcaseCloseSchema = z.object({
  fixPrUrl: z.string().regex(/^https:\/\/github\.com\/[^\s]+\/pull\/\d+$/u),
  verificationRunId: z.string().uuid(),
});

export const answerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.coerce.number().int().positive()).default([]),
});

export const queryParamsSchema = z.object({
  endpoint: z.string().min(1).startsWith("/"),
  params: z.record(z.unknown()).default({}),
});

export const actionSchema = z.object({
  action: z.enum(["create_requirement", "trigger_collect"]),
  params: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      sourceId: z.string().optional(),
    })
    .default({}),
});

export const directMatchSchema = z.object({
  metricId: z.string().nullable(),
  confidence: z.number(),
  timeFilter: z.object({
    mode: z.enum(["semantic", "explicit", "none"]),
    // 真环境实证：LLM 对无关字段会输出 null（z.string().optional() 拒绝 null 导致整包校验失败）
    enumValue: z.string().nullish(),
    from: z.string().nullish(),
    to: z.string().nullish(),
  }),
});
export type DirectMatch = z.infer<typeof directMatchSchema>;
