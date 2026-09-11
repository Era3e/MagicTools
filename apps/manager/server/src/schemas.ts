import { z } from "zod";

export const requirementInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20000).default(""),
  project: z.string().regex(/^$|^[a-z][a-z0-9-]{0,63}$/).default(""),
  scope: z.string().trim().max(8000).default(""),
  risk: z.enum(["unassessed", "low", "medium", "high"]).default("unassessed"),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(2000)).max(50).default([]),
  dependencyRefs: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/)).max(100).default([]),
  priority: z.enum(["P0", "P1", "P2"]).default("P2"),
  branch: z.string().default(""),
  prUrl: z.string().default(""),
  iterationId: z.string().optional().nullable(),
});

export const requirementPatchSchema = requirementInputSchema.partial().extend({
  status: z.enum(["waiting", "designing", "todo", "developing", "testing", "accepting", "done"]).optional(),
  expectedRevision: z.number().int().positive().optional(),
}).strict();

export const iterationInputSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});
