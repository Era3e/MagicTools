import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { embed } from "./llm";
import {
  createProductVersion,
  createSpace,
  deleteEntryCompletely,
  getCurrentPublicVersion,
  getProductVersion,
  getPublicEntry,
  getSpaceByKey,
  invalidateEntryForPublicAccess,
  isSpaceMember,
  listPublicEntries,
  listSpaces,
  publishProductVersion,
  removeMember,
  upsertMember,
  type AccessIdentity,
} from "./knowledge-space.repo";
import { pool } from "./db";
import {
  knowledgeMemberInputSchema,
  knowledgeSpaceInputSchema,
  productVersionInputSchema,
  productVersionPublishSchema,
  requirementLinkInputSchema,
  searchQuerySchema,
} from "./schemas";
import { publicFtsSearch, publicVectorSearch } from "./search.repo";
import { listEntries, updateEntry } from "./entry.repo";

export interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
}

function identity(req: HttpRequest): AccessIdentity {
  const header = (name: string): string | null => {
    const value = req.headers[name];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };
  const role = header("x-gateway-role");
  return {
    userId: header("x-gateway-user"),
    role: role === "admin" || role === "user" || role === "service" ? role : null,
  };
}

function assertAdmin(req: HttpRequest): void {
  if (process.env.SCHOLAR_ADMIN_AUTH === "disabled") return;
  if (req.headers["x-gateway-role"] === "admin") return;
  throw new ForbiddenException("需要管理员权限");
}

@Injectable()
export class KnowledgeSpaceService {
  list(req: HttpRequest) {
    return listSpaces(identity(req));
  }

  async create(req: HttpRequest, input: unknown) {
    const who = identity(req);
    assertAdmin(req);
    const parsed = knowledgeSpaceInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("知识空间参数非法");
    if (parsed.data.kind === "product" && parsed.data.key !== "product") {
      throw new BadRequestException("系统只允许一个产品帮助空间");
    }
    const row = await createSpace({ ...parsed.data, ownerId: who.userId ?? "gateway-admin" });
    if (!row) throw new BadRequestException("知识空间标识已存在");
    return row;
  }

  async upsertMember(req: HttpRequest, key: string, input: unknown) {
    assertAdmin(req);
    const space = await getSpaceByKey(key);
    if (!space) throw new NotFoundException("知识空间不存在");
    const parsed = knowledgeMemberInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("成员参数非法");
    await upsertMember(space.id, parsed.data.userId, parsed.data.role);
    return { ok: true };
  }

  async removeMember(req: HttpRequest, key: string, userId: string) {
    assertAdmin(req);
    const space = await getSpaceByKey(key);
    if (!space) throw new NotFoundException("知识空间不存在");
    const removed = await removeMember(space.id, userId);
    return { removed };
  }

  async assertSpaceAccess(req: HttpRequest, key: string) {
    const who = identity(req);
    const space = await getSpaceByKey(key);
    if (!space) throw new NotFoundException("知识空间不存在");
    if (who.role === "admin" || who.role === "service") return space;
    if (space.visibility === "public" && space.kind === "product") return space;
    if (!(who.userId && await isSpaceMember(space.id, who.userId))) throw new ForbiddenException("无权访问该知识空间");
    return space;
  }

  async spaceEntries(req: HttpRequest, key: string) {
    const who = identity(req);
    const space = await getSpaceByKey(key);
    if (!space) throw new NotFoundException("知识空间不存在");
    const member = Boolean(who.userId && await isSpaceMember(space.id, who.userId));
    const privileged = who.role === "admin" || who.role === "service";
    if (!privileged && !member) {
      if (!(space.visibility === "public" && space.kind === "product")) {
        throw new ForbiddenException("无权访问该知识空间");
      }
      const version = await getCurrentPublicVersion();
      return version ? listPublicEntries(version.id) : [];
    }
    return listEntries({ spaceKey: key });
  }

  async createVersion(req: HttpRequest, key: string, input: unknown) {
    assertAdmin(req);
    const space = await getSpaceByKey(key);
    if (!space) throw new NotFoundException("知识空间不存在");
    if (space.kind !== "product") throw new BadRequestException("只有产品知识空间可创建版本");
    const parsed = productVersionInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("产品版本参数非法");
    if (!parsed.data.sourceRevision.trim()) throw new BadRequestException("产品版本必须绑定来源修订");
    return createProductVersion({ spaceId: space.id, ...parsed.data });
  }

  async publishVersion(req: HttpRequest, versionId: string, input: unknown) {
    assertAdmin(req);
    const parsed = productVersionPublishSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("产品发布参数非法");
    try {
      return await publishProductVersion({ versionId, ...parsed.data });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  async currentVersion() {
    const version = await getCurrentPublicVersion();
    if (!version) throw new NotFoundException("当前没有已发布的产品帮助版本");
    return version;
  }

  async publicEntries() {
    const version = await this.currentVersion();
    return listPublicEntries(version.id);
  }

  async publicEntry(id: string) {
    const version = await this.currentVersion();
    const row = await getPublicEntry(version.id, id);
    if (!row) throw new NotFoundException("产品帮助不存在");
    return row;
  }

  async publicSearch(input: unknown) {
    const parsed = searchQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("q 必填");
    const version = await this.currentVersion();
    if (parsed.data.mode === "vector") {
      const [vec] = await embed([parsed.data.q]);
      return publicVectorSearch(vec, parsed.data.limit, version.id);
    }
    return publicFtsSearch(parsed.data.q, parsed.data.limit, version.id);
  }

  async linkRequirement(req: HttpRequest, entryId: string, input: unknown) {
    assertAdmin(req);
    const parsed = requirementLinkInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("需求关联参数非法");
    const exists = await pool.query("SELECT 1 FROM entries WHERE id=$1", [entryId]);
    if (!exists.rows[0]) throw new NotFoundException("条目不存在");
    await updateEntry(entryId, {
      requirementId: parsed.data.requirementId,
      requirementUrl: parsed.data.requirementUrl,
      source: parsed.data.source,
    });
    return { ok: true };
  }

  async unpublishEntry(req: HttpRequest, entryId: string) {
    assertAdmin(req);
    const exists = await pool.query("SELECT 1 FROM entries WHERE id=$1", [entryId]);
    if (!exists.rows[0]) throw new NotFoundException("条目不存在");
    await invalidateEntryForPublicAccess(entryId);
    return { ok: true };
  }

  async deleteEntry(req: HttpRequest, entryId: string) {
    assertAdmin(req);
    const exists = await pool.query("SELECT 1 FROM entries WHERE id=$1", [entryId]);
    if (!exists.rows[0]) throw new NotFoundException("条目不存在");
    await deleteEntryCompletely(entryId);
    return { ok: true };
  }

  async versionDetail(req: HttpRequest, id: string) {
    assertAdmin(req);
    try {
      return await getProductVersion(id);
    } catch {
      throw new NotFoundException("产品版本不存在");
    }
  }
}
