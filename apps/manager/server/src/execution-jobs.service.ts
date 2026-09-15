import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool } from "./db";
import { mapRow, type RequirementRow } from "./requirement.repo";
import {
  cancelExecutionJob,
  claimExecutionJob,
  completeExecutionRun,
  EXECUTION_JOB_STATUSES,
  failExecutionRun,
  getExecutionJob,
  heartbeatExecutionRun,
  insertExecutionJob,
  listExecutionJobs,
  recoverExpiredExecutionRuns,
} from "./execution-jobs.repo";

const claimInputSchema = z.object({
  executorId: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/),
  leaseMilliseconds: z.number().int().min(5_000).max(3_600_000).default(60_000),
}).strict();

const heartbeatInputSchema = z.object({
  extensionMilliseconds: z.number().int().min(5_000).max(3_600_000).default(60_000),
}).strict();

const completeInputSchema = z.object({
  result: z.record(z.unknown()),
}).strict();

const failInputSchema = z.object({
  error: z.string().trim().min(1).max(2000),
}).strict();

const cancelInputSchema = z.object({
  reason: z.string().trim().min(1).max(2000).default("owner cancelled"),
}).strict();

@Injectable()
export class ExecutionJobsService {
  policy() {
    const ownerConfigured = /^[\x21-\x7e]{32,1024}$/.test(process.env.MANAGER_APPROVAL_TOKEN ?? "");
    const executorConfigured = /^[\x21-\x7e]{32,1024}$/.test(process.env.MANAGER_EXECUTOR_TOKEN ?? "");
    return {
      ownerConfigured,
      executorConfigured,
      ownerAuthMethod: "owner-token",
      executorAuthMethod: "executor-token",
      runCredential: "one-time-run-token",
    };
  }

  private authorizeOwner(token?: string) {
    if (!this.policy().ownerConfigured) throw new ServiceUnavailableException("尚未配置有效审批凭证，需至少 32 个字符");
    this.assertToken(token, process.env.MANAGER_APPROVAL_TOKEN!);
  }

  private authorizeExecutor(token?: string) {
    if (!this.policy().executorConfigured) throw new ServiceUnavailableException("尚未配置有效执行器凭证，需至少 32 个字符");
    this.assertToken(token, process.env.MANAGER_EXECUTOR_TOKEN!);
  }

  private assertToken(token: string | undefined, expected: string) {
    if (!token || token.length > 1024) throw new ForbiddenException("执行凭证无效");
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(digest(token), digest(expected))) throw new ForbiddenException("执行凭证无效");
  }

  async queue(id: string, token?: string) {
    this.authorizeOwner(token);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT * FROM requirements WHERE id=$1 FOR UPDATE", [id]);
      if (!found.rowCount) throw new NotFoundException("需求不存在");
      const current = mapRow(found.rows[0]);
      const blockers = await this.blockers(current, client);
      if (blockers.length) throw new BadRequestException({ message: "需求尚未满足自动执行门禁", blockers });
      const existing = await client.query(
        "SELECT id,status FROM execution_jobs WHERE requirement_id=$1 AND content_revision=$2",
        [id, current.contentRevision]
      );
      if (existing.rowCount) {
        const status = existing.rows[0].status as string;
        throw new ConflictException({
          message: ["queued", "running", "retry"].includes(status) ? "该需求修订已有活动执行任务" : "该需求修订已有终态执行任务",
          jobId: existing.rows[0].id,
        });
      }
      const updated = await client.query(
        "UPDATE requirements SET automation_policy='owner-token',revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *",
        [id]
      );
      const row = mapRow(updated.rows[0]);
      const job = await insertExecutionJob({
        requirementId: id,
        requirementRevision: row.revision,
        contentRevision: row.contentRevision,
        contract: row.executionContract!,
        maxAttempts: row.executionContract!.maxAttempts,
      }, client);
      await client.query("COMMIT");
      return job;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async blockers(row: RequirementRow, client: Pick<PoolClient, "query">): Promise<string[]> {
    const blockers: string[] = [];
    if (row.approvalStatus !== "approved") blockers.push("当前内容未批准");
    if (!row.executionContract) blockers.push("缺少执行契约");
    if (row.status !== "todo") blockers.push("需求状态不是待开发");
    if (row.executionContract && row.dependencyRefs.length) {
      const links = await client.query(
        `SELECT l.candidate_id,l.record_kind,l.requirement_id,l.capability_id,r.status
         FROM manager_import_links l LEFT JOIN requirements r ON r.id=l.requirement_id
         WHERE l.repository=$1 AND l.candidate_id=ANY($2::text[])`,
        [row.executionContract.repository.toLowerCase(), row.dependencyRefs]
      );
      const states = new Map(links.rows.map((link) => [link.candidate_id as string, link]));
      for (const ref of row.dependencyRefs) {
        const link = states.get(ref) as { record_kind?: string; status?: string } | undefined;
        if (!link || link.record_kind !== "planned" || link.status !== "done") blockers.push("依赖未就绪：" + ref);
      }
    }
    return blockers;
  }

  list(query: unknown) {
    const parsed = z.object({
      requirementId: z.string().uuid().optional(),
      status: z.enum(EXECUTION_JOB_STATUSES).optional(),
    }).strict().safeParse(query);
    if (!parsed.success) throw new BadRequestException("执行任务查询参数非法");
    return listExecutionJobs(parsed.data);
  }

  async get(id: string) {
    const job = await getExecutionJob(id);
    if (!job) throw new NotFoundException("执行任务不存在");
    return job;
  }

  async claim(input: unknown, token?: string) {
    this.authorizeExecutor(token);
    const parsed = claimInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("执行任务领取参数非法");
    await recoverExpiredExecutionRuns();
    return claimExecutionJob(parsed.data);
  }

  async heartbeat(id: string, input: unknown, executorToken?: string, runToken?: string) {
    this.authorizeExecutor(executorToken);
    const parsed = heartbeatInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("执行心跳参数非法");
    if (!runToken) throw new ForbiddenException("执行回写凭证无效");
    const run = await heartbeatExecutionRun(id, runToken, parsed.data.extensionMilliseconds);
    if (!run) throw new ConflictException("执行租约已过期或回写凭证无效");
    return run;
  }

  async complete(id: string, input: unknown, executorToken?: string, runToken?: string) {
    this.authorizeExecutor(executorToken);
    const parsed = completeInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("执行成功回写参数非法");
    const serialized = JSON.stringify(parsed.data.result);
    if (serialized.length > 20_000) throw new BadRequestException("执行结果超过 20KB 限制");
    if (!runToken) throw new ForbiddenException("执行回写凭证无效");
    const job = await completeExecutionRun(id, runToken, parsed.data.result);
    if (!job) throw new ConflictException("执行租约已过期或回写凭证无效");
    return job;
  }

  async fail(id: string, input: unknown, executorToken?: string, runToken?: string) {
    this.authorizeExecutor(executorToken);
    const parsed = failInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("执行失败回写参数非法");
    if (!runToken) throw new ForbiddenException("执行回写凭证无效");
    const job = await failExecutionRun(id, runToken, parsed.data.error);
    if (!job) throw new ConflictException("执行租约已过期或回写凭证无效");
    return job;
  }

  async cancel(id: string, input: unknown, token?: string) {
    this.authorizeOwner(token);
    const parsed = cancelInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("执行取消参数非法");
    const job = await cancelExecutionJob(id, parsed.data.reason);
    if (!job) throw new NotFoundException("执行任务不存在");
    return job;
  }

  async recover(token?: string) {
    this.authorizeExecutor(token);
    return recoverExpiredExecutionRuns();
  }
}
