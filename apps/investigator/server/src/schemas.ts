import { z } from "zod";

export const responseStructuredSchema = z.object({
  requirements: z.array(z.string()).default([]),
  painPoints: z.array(z.string()).default([]),
  expectations: z.array(z.string()).default([]),
  sentiment: z.enum(["positive", "neutral", "negative"]).default("neutral"),
  priority: z.enum(["P0", "P1", "P2"]).default("P2"),
  summary: z.string().default(""),
});

export const surveyInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  appToken: z.string().default(""),
  tableId: z.string().default(""),
  answerFields: z.array(z.string()).default([]),
});
