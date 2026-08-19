import { z } from "zod";

export const parseJdSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  city: z.string().default(""),
  salary: z.string().default(""),
  requirements: z.array(z.string()).default([]),
  duties: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});

export const parsePositionImageSchema = parseJdSchema;

export const interviewAnalysisSchema = z.object({
  questions: z.array(z.object({ category: z.string(), question: z.string(), comment: z.string() })).default([]),
  quality: z.string().default(""),
  suggestions: z.array(z.string()).default([]),
  actionItems: z.array(z.string()).default([]),
});
