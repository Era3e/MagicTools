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

const canvasNodeSchema: z.ZodType<{ id: string; type: string; component: string; props: Record<string, unknown>; children: unknown[] }, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    component: z.string(),
    props: z.record(z.string(), z.unknown()).default({}),
    children: z.array(canvasNodeSchema).default([]),
  })
);

export const canvasDocSchema = z.object({
  componentName: z.string().min(1),
  description: z.string().optional(),
  root: canvasNodeSchema,
});

export const componentInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  code: z.string().min(1),
  schema: canvasDocSchema.optional(),
});

export const parseInputSchema = z.object({
  code: z.string(),
});
