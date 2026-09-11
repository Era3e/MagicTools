import { createHash, timingSafeEqual } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";
import { pool } from "./db";
import { getRequirement, mapRow } from "./requirement.repo";

const approvalInput = z.object({ expectedRevision: z.number().int().positive(),
  expectedContentRevision: z.number().int().positive(), reason: z.string().trim().max(1000).default("") }).strict();

@Injectable()
export class RequirementApprovalService {
  policy() {
    const actorId = process.env.MANAGER_APPROVAL_ACTOR?.trim() || "owner";
    return { configured: /^[\x21-\x7e]{32,1024}$/.test(process.env.MANAGER_APPROVAL_TOKEN ?? "") && actorId.length <= 100,
      actorId, authMethod: "owner-token", automatedExecutionEnabled: false };
  }

  private authorize(token?: string) {
    const policy = this.policy();
    if (!policy.configured) throw new ServiceUnavailableException("尚未配置有效审批凭证，需至少 32 个字符");
    if (!token || token.length > 1024) throw new ForbiddenException("审批凭证无效");
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(digest(token), digest(process.env.MANAGER_APPROVAL_TOKEN!))) {
      throw new ForbiddenException("审批凭证无效");
    }
    return policy.actorId;
  }

  approve(id: string, input: unknown, token?: string) { return this.decide(id, input, "approved", token); }
  revoke(id: string, input: unknown, token?: string) { return this.decide(id, input, "revoked", token); }

  private async decide(id: string, input: unknown, decision: "approved" | "revoked", token?: string) {
    const actorId = this.authorize(token);
    const parsed = approvalInput.safeParse(input);
    if (!parsed.success) throw new BadRequestException("请提交页面版本、内容修订和可选审批说明");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT * FROM requirements WHERE id=$1 FOR UPDATE", [id]);
      if (!found.rowCount) throw new NotFoundException("需求不存在");
      const current = mapRow(found.rows[0]);
      if (parsed.data.expectedContentRevision !== current.contentRevision) {
        throw new ConflictException({ message: "需求内容已变化，请查看新修订后重新审批", currentContentRevision: current.contentRevision });
      }
      if ((decision === "approved" && current.approvalStatus === "approved") ||
          (decision === "revoked" && current.approvedContentRevision === null)) {
        await client.query("COMMIT");
        return current;
      }
      if (parsed.data.expectedRevision !== current.revision) throw new ConflictException("需求已更新，请刷新后重试");
      if (decision === "approved" && !current.approvalReadiness.ready) throw new BadRequestException({ message: "需求内容尚不具备审批条件", missing: current.approvalReadiness.missing });
      const approvedRevision = decision === "approved" ? current.contentRevision : null;
      const updated = await client.query("UPDATE requirements SET approved_content_revision=$2,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *", [id, approvedRevision]);
      const row = mapRow(updated.rows[0]);
      await client.query(
        "INSERT INTO requirement_approvals(requirement_id,content_revision,requirement_revision,decision,actor_id,auth_method,reason) VALUES($1,$2,$3,$4,$5,'owner-token',$6)",
        [id, decision === "approved" ? row.contentRevision : current.approvedContentRevision, row.revision, decision, actorId, parsed.data.reason]
      );
      await client.query("COMMIT");
      return row;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async history(id: string, query: unknown) {
    const parsed = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20),
      before: z.coerce.number().int().positive().max(2147483647).optional() }).safeParse(query);
    if (!parsed.success) throw new BadRequestException("审批分页参数非法");
    if (!(await getRequirement(id))) throw new NotFoundException("需求不存在");
    const rows = await pool.query(
      "SELECT * FROM requirement_approvals WHERE requirement_id=$1 AND ($2::integer IS NULL OR requirement_revision<$2) ORDER BY requirement_revision DESC LIMIT $3",
      [id, parsed.data.before ?? null, parsed.data.limit + 1]
    );
    const items = rows.rows.slice(0, parsed.data.limit).map((r) => ({ id: r.id as string, contentRevision: Number(r.content_revision),
      requirementRevision: Number(r.requirement_revision), decision: r.decision as "approved" | "revoked",
      actorId: r.actor_id as string, authMethod: r.auth_method as "owner-token", reason: r.reason as string,
      createdAt: new Date(r.created_at as string).toISOString() }));
    return { items, nextBefore: rows.rows.length > parsed.data.limit ? items[items.length - 1].requirementRevision : null };
  }
}
