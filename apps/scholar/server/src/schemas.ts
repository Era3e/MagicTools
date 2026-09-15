import { z } from "zod";

export const entryInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
  summary: z.string().default(""),
  category: z.string().default(""),
  tags: z.array(z.string()).default([]),
  spaceKey: z.enum(["development", "product"]).default("development"),
  sourceRevision: z.string().default(""),
  sourceUrl: z.string().default(""),
  requirementId: z.string().default(""),
  requirementUrl: z.string().default(""),
});

export const knowledgeSpaceInputSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  name: z.string().min(1),
  kind: z.enum(["development", "product"]),
  visibility: z.enum(["private", "public"]).default("private"),
});

export const knowledgeMemberInputSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["owner", "editor", "viewer"]),
});

export const productVersionInputSchema = z.object({
  version: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  sourceRevision: z.string().default(""),
  deploymentRef: z.string().default(""),
});

export const productVersionPublishSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1),
  deploymentRef: z.string().default(""),
  publishedBy: z.string().default(""),
});

export const requirementLinkInputSchema = z.object({
  requirementId: z.string().min(1),
  requirementUrl: z.string().default(""),
  source: z.enum(["manual"]).default("manual"),
});

export const entryPatchSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assistantScope: z.boolean().optional(),
  spaceKey: z.enum(["development", "product"]).optional(),
  sourceRevision: z.string().optional(),
  sourceUrl: z.string().optional(),
  requirementId: z.string().optional(),
  requirementUrl: z.string().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  mode: z.enum(["fts", "vector"]).default("fts"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const publicSearchInputSchema = z.object({
  q: z.string().trim().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const settingsInputSchema = z.object({
  vaultPath: z.string().default(""),
});

export const graphSchema = z.object({
  entities: z.array(z.object({ name: z.string().min(1), type: z.string().default("") })).default([]),
  relations: z
    .array(z.object({ from: z.string().min(1), to: z.string().min(1), label: z.string().default("") }))
    .default([]),
});
