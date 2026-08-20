import { z } from "zod";

export const chatInputSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1),
});

export const intentSchema = z.object({
  intent: z.enum(["product_inquiry", "data_query", "chitchat_reject"]),
});

export const answerSchema = z.object({
  answer: z.string(),
});
