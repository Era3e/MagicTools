import { z } from "zod";

export const analysisSchema = z.object({ analysis: z.string() });
export const designSchema = z.object({ design: z.string() });
export const reviewSchema = z.object({
  approve: z.boolean(),
  comment: z.string().default(""),
});
