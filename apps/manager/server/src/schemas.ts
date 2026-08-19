import { z } from "zod";

export const requirementInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  priority: z.enum(["P0", "P1", "P2"]).default("P2"),
  branch: z.string().default(""),
  prUrl: z.string().default(""),
  iterationId: z.string().optional().nullable(),
});

export const requirementPatchSchema = requirementInputSchema.partial().extend({
  status: z.enum(["waiting", "designing", "todo", "developing", "testing", "accepting", "done"]).optional(),
});

export const iterationInputSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});
