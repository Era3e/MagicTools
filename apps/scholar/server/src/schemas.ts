import { z } from "zod";

export const entryInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
  summary: z.string().default(""),
  category: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

export const entryPatchSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assistantScope: z.boolean().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  mode: z.enum(["fts", "vector"]).default("fts"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const settingsInputSchema = z.object({
  vaultPath: z.string().default(""),
});
