import { z } from "zod";

const repositorySchema = z.string().regex(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/i)
  .transform((value) => value.replace(/\/+$/, "").replace(/\.git$/i, "").toLowerCase());
const allowedPathSchema = z.string().regex(/^(?!\/)(?!.*\/\/)[A-Za-z0-9._@()/ -]+$/).refine((value) => {
  return value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
});
function isSafeCommandArgument(value: string) {
  if (/\s/.test(value) || /[;&|`$<>]/.test(value) || value.includes("..") || value.includes("\\") ||
      value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;
  if (/^(-C|--dir|--prefix|-c|--config)$/.test(value) || value.startsWith("--config.") || value.startsWith("--config=")) return false;
  return true;
}

const acceptanceCommandSchema = z.array(z.string().min(1).max(500)).min(1).max(20).superRefine((tokens, ctx) => {
  const runtime = tokens[0];
  if (!["pnpm", "pnpm.cmd", "npm", "npm.cmd", "node"].includes(runtime)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "验收命令必须以受控运行时开头" });
    return;
  }
  if (runtime === "node") {
    if (tokens.length !== 2 || !/\.[cm]?js$/.test(tokens[1]) || !isSafeCommandArgument(tokens[1])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "node 验收命令只能指向仓库内相对 JS 入口" });
    }
    return;
  }
  if (["exec", "dlx", "install", "add", "remove", "run"].includes(tokens[1] ?? "")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "包管理器验收命令不能启动任意子命令" });
  }
  for (const token of tokens.slice(1)) {
    if (!isSafeCommandArgument(token)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "验收命令参数不能包含路径穿越、工作目录切换或 shell 元字符" });
  }
});

export const executionContractSchema = z.object({
  repository: repositorySchema,
  allowedPaths: z.array(allowedPathSchema).min(1).max(100),
  acceptanceCommands: z.array(acceptanceCommandSchema).min(1).max(20),
  maxDurationMinutes: z.number().int().min(1).max(240),
  maxAttempts: z.number().int().min(1).max(3),
  budgetCurrency: z.literal("CNY"),
  budgetAmountCents: z.number().int().min(1).max(10_000_000),
}).strict();

export const requirementInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20000).default(""),
  project: z.string().regex(/^$|^[a-z][a-z0-9-]{0,63}$/).default(""),
  scope: z.string().trim().max(8000).default(""),
  risk: z.enum(["unassessed", "low", "medium", "high"]).default("unassessed"),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(2000)).max(50).default([]),
  dependencyRefs: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/)).max(100).default([]),
  executionContract: executionContractSchema.nullable().default(null),
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
