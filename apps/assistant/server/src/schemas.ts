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

export const answerSchema = z.object({
  answer: z.string(),
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
