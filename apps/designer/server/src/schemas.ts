import { z } from "zod";

export const generateInputSchema = z.object({
  prompt: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

export const componentGenSchema = z.object({
  componentName: z.string().min(1),
  description: z.string().default(""),
  code: z.string().min(1),
});

export const componentInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  code: z.string().min(1),
});
