import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  createResource,
  createResourceCheck,
  listResources,
  RESOURCE_CHECK_OUTCOMES,
  RESOURCE_ENVIRONMENTS,
  RESOURCE_KINDS,
  SECRET_REF_SOURCES,
} from "./resources.repo";

export const secretRefSchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/),
  source: z.enum(SECRET_REF_SOURCES),
  reference: z.string().regex(/^(?:env:|file:|external:)[A-Za-z0-9_./:@-]{1,280}$/),
  required: z.boolean().default(true),
}).strict().superRefine((ref, ctx) => {
  if (!ref.reference.startsWith(`${ref.source}:`)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reference"],
      message: `密钥引用前缀必须与来源一致：${ref.source}:`,
    });
  }
});

const createResourceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  kind: z.enum(RESOURCE_KINDS),
  environment: z.enum(RESOURCE_ENVIRONMENTS),
  owner: z.string().trim().min(2).max(100),
  provider: z.string().trim().min(2).max(100),
  region: z.string().trim().max(100).default(""),
  monthlyBudgetCents: z.number().int().min(0).max(1_000_000_000),
  backupReference: z.string().trim().min(3).max(500),
  runbookUrl: z.string().regex(/^https:\/\/[^\s]+$/).max(1000),
  notes: z.string().trim().max(2000).default(""),
  secretRefs: z.array(secretRefSchema).max(100).default([]),
}).strict();

const createCheckSchema = z.object({
  name: z.string().trim().min(2).max(100),
  outcome: z.enum(RESOURCE_CHECK_OUTCOMES),
  detail: z.string().trim().max(1000).default(""),
  evidenceUrl: z.string().regex(/^https:\/\/[^\s]+$/).or(z.literal("")).default(""),
}).strict();

@Injectable()
export class ResourcesService {
  list() {
    return listResources();
  }

  async create(input: unknown, token?: string) {
    this.authorizeOwner(token);
    const parsed = createResourceSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("资源清单参数非法：只保存秘密引用，不保存秘密值");
    const names = new Set(parsed.data.secretRefs.map((ref) => ref.name));
    if (names.size !== parsed.data.secretRefs.length) throw new BadRequestException("密钥引用名称重复");
    try {
      return await createResource(parsed.data);
    } catch (error) {
      if (/operations_resources_name_key|duplicate key/i.test(String(error))) throw new BadRequestException("资源名称已存在");
      throw error;
    }
  }

  async addCheck(id: string, input: unknown, token?: string) {
    this.authorizeOwner(token);
    const parsed = createCheckSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("资源检查参数非法");
    if (parsed.data.outcome !== "passed" && !parsed.data.detail) {
      throw new BadRequestException("blocked/waiting/failed 检查必须记录可行动原因");
    }
    const item = await createResourceCheck(id, parsed.data);
    if (!item) throw new NotFoundException("资源不存在");
    return item;
  }

  private authorizeOwner(token?: string) {
    const expected = process.env.MANAGER_APPROVAL_TOKEN ?? "";
    if (!/^[\x21-\x7e]{32,1024}$/.test(expected)) throw new ServiceUnavailableException("尚未配置有效审批凭证，需至少 32 个字符");
    if (!token || token.length > 1024) throw new ForbiddenException("资源凭证无效");
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(digest(token), digest(expected))) throw new ForbiddenException("资源凭证无效");
  }
}
