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
import type { ExecutionContract } from "./requirement-content";

const claimInputSchema = z.object({
  executorId: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/),
  leaseMilliseconds: z.number().int().min(5_000).max(3_600_000).default(60_000),
}).strict();

const heartbeatInputSchema = z.object({
  extensionMilliseconds: z.number().int().min(5_000).max(3_600_000).default(60_000),
}).strict();

const executionResultSchema = z.object({
  status: z.literal("succeeded"),
  jobId: z.string().uuid(),
  runId: z.string().uuid(),
  baseSha: z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/),
  candidateSha: z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/),
  changedPaths: z.array(z.string().min(1).max(500)).max(500),
  acceptance: z.array(z.object({
    status: z.literal("success"),
    exitCode: z.literal(0),
    durationMs: z.number().int().nonnegative(),
  }).passthrough()).min(1),
  prNumber: z.number().int().positive(),
  prUrl: z.string().regex(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+$/),
  branch: z.string().regex(/^[\w./-]{1,200}$/),
  evidence: z.object({
    schema: z.string().min(1).max(200),
    path: z.string().min(1).max(1000),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  }).passthrough(),
}).passthrough();

const completeInputSchema = z.object({
  result: executionResultSchema,
}).strict();

const failInputSchema = z.object({
  error: z.string().trim().min(1).max(2000),
}).strict();

const cancelInputSchema = z.object({
  reason: z.string().trim().min(1).max(2000).default("owner cancelled"),
}).strict();

export interface MergeAuthorization {
  eligible: boolean;
  blockers: string[];
  candidate: {
    jobId: string;
    runId: string;
    requirementId: string;
    contentRevision: number;
    repository: string;
    allowedPaths: string[];
    baseSha: string;
    candidateSha: string;
    changedPaths: string[];
    prNumber: number;
    prUrl: string;
    branch: string;
  } | null;
}

@Injectable()
export class ExecutionJobsService {
  policy() {
    const ownerConfigured = /^[\x21-\x7e]{32,1024}$/.test(process.env.MANAGER_APPROVAL_TOKEN ?? "");
    const executorConfigured = /^[\x21-\x7e]{32,1024}$/.test(process.env.MANAGER_EXECUTOR_TOKEN ?? "");
    const mergeConfigured = /^[\x21-\x7e]{32,1024}$/.test(process.env.MANAGER_MERGE_TOKEN ?? "");
    return {
      ownerConfigured,
      executorConfigured,
      mergeConfigured,
      ownerAuthMethod: "owner-token",
      executorAuthMethod: "executor-token",
      mergeAuthMethod: "merge-token",
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

  private authorizeMerge(token?: string) {
    if (!this.policy().mergeConfigured) throw new ServiceUnavailableException("尚未配置有效条件合并凭证，需至少 32 个字符");
    this.assertToken(token, process.env.MANAGER_MERGE_TOKEN!);
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
    if (parsed.data.result.jobId !== id) throw new BadRequestException("执行结果任务身份不匹配");
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

  async mergeCandidates(token?: string): Promise<MergeAuthorization[]> {
    this.authorizeMerge(token);
    const rows = await pool.query(
      `SELECT j.id
       FROM execution_jobs j
       JOIN requirements r ON r.id=j.requirement_id
       WHERE j.status='succeeded' AND r.risk='low' AND r.status='accepting' AND r.pr_state='open'
       ORDER BY j.finished_at DESC
       LIMIT 50`
    );
    const results: MergeAuthorization[] = [];
    for (const row of rows.rows as Array<{ id: string }>) {
      const authorization = await this.mergeAuthorization(row.id, undefined, true);
      if (authorization.eligible) results.push(authorization);
    }
    return results;
  }

  async mergeAuthorization(id: string, token?: string, alreadyAuthorized = false): Promise<MergeAuthorization> {
    if (!alreadyAuthorized) this.authorizeMerge(token);
    const found = await pool.query(
      `SELECT j.id,j.status,j.content_revision,j.contract,
              r.id AS requirement_id,r.content_revision AS current_content_revision,
              r.approved_content_revision,r.risk,r.status AS requirement_status,
              r.pr_state,r.pr_url,
              (SELECT run.id FROM execution_runs run WHERE run.job_id=j.id AND run.status='succeeded'
               ORDER BY run.attempt DESC LIMIT 1) AS run_id,
              (SELECT run.result FROM execution_runs run WHERE run.job_id=j.id AND run.status='succeeded'
               ORDER BY run.attempt DESC LIMIT 1) AS result
       FROM execution_jobs j
       JOIN requirements r ON r.id=j.requirement_id
       WHERE j.id=$1`,
      [id]
    );
    if (!found.rowCount) throw new NotFoundException("执行任务不存在");
    const row = found.rows[0] as {
      id: string;
      status: string;
      content_revision: number;
      contract: ExecutionContract;
      requirement_id: string;
      current_content_revision: number;
      approved_content_revision: number | null;
      risk: string;
      requirement_status: string;
      pr_state: string;
      pr_url: string;
      run_id: string | null;
      result: {
        runId?: string;
        baseSha?: string;
        candidateSha?: string;
        changedPaths?: string[];
        prNumber?: number;
        prUrl?: string;
        branch?: string;
      } | null;
    };

    const blockers: string[] = [];
    if (row.status !== "succeeded") blockers.push("执行任务未成功");
    if (!row.run_id || !row.result) blockers.push("缺少成功执行结果");
    if (row.result?.runId && row.result.runId !== row.run_id) blockers.push("执行结果 run 身份不匹配");
    if (Number(row.current_content_revision) !== Number(row.content_revision)) blockers.push("执行契约对应内容修订已变化");
    if (Number(row.approved_content_revision ?? -1) !== Number(row.content_revision)) blockers.push("执行契约对应内容修订未获当前批准");
    if (row.risk !== "low") blockers.push("需求不是低风险");
    if (row.requirement_status !== "accepting") blockers.push("需求不在待验收状态");
    if (row.pr_state !== "open") blockers.push("Manager 记录的 PR 状态不是 open");
    if (row.result?.prUrl && row.pr_url !== row.result.prUrl) blockers.push("Manager 需求与执行结果的 PR 不一致");
    if (!/^[0-9a-f]{40}$/.test(String(row.result?.baseSha ?? ""))) blockers.push("执行结果 base SHA 无效");
    if (!/^[0-9a-f]{40}$/.test(String(row.result?.candidateSha ?? ""))) blockers.push("执行结果 candidate SHA 无效");
    if (!Array.isArray(row.result?.changedPaths) || !row.result.changedPaths.length) blockers.push("执行结果改动路径无效");
    if (!Number.isInteger(row.result?.prNumber) || Number(row.result?.prNumber) <= 0) blockers.push("执行结果 PR 编号无效");
    for (const key of ["baseSha", "candidateSha", "changedPaths", "prNumber", "prUrl", "branch"] as const) {
      if (!row.result?.[key] || (key === "changedPaths" && !row.result.changedPaths?.length)) {
        blockers.push("执行结果缺少合并身份：" + key);
        break;
      }
    }
    if (blockers.length || !row.result) {
      return { eligible: false, blockers, candidate: null };
    }
    return {
      eligible: true,
      blockers: [],
      candidate: {
        jobId: row.id,
        runId: row.run_id!,
        requirementId: row.requirement_id,
        contentRevision: Number(row.content_revision),
        repository: row.contract.repository,
        allowedPaths: row.contract.allowedPaths,
        baseSha: String(row.result.baseSha),
        candidateSha: String(row.result.candidateSha),
        changedPaths: row.result.changedPaths!,
        prNumber: Number(row.result.prNumber),
        prUrl: String(row.result.prUrl),
        branch: String(row.result.branch),
      },
    };
  }

  async updateDeployment(id: string, input: unknown, token?: string) {
    this.authorizeOwner(token);
    const parsed = z.object({
      state: z.enum(["not-started", "pending", "deploying", "succeeded", "failed", "rolled-back"]),
      releaseId: z.string().trim().max(200).default(""),
      url: z.string().regex(/^https:\/\/[^\s]+$/).or(z.literal("")).default(""),
      expectedRevision: z.number().int().positive(),
    }).strict().safeParse(input);
    if (!parsed.success) throw new BadRequestException("部署状态参数非法");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT revision,pr_state FROM requirements WHERE id=$1 FOR UPDATE", [id]);
      if (!found.rowCount) throw new NotFoundException("需求不存在");
      const current = found.rows[0] as { revision: number; pr_state: string };
      if (parsed.data.expectedRevision !== current.revision) {
        throw new ConflictException({ message: "需求已被其他操作更新，请刷新后重试", currentRevision: current.revision });
      }
      if (parsed.data.state === "succeeded" && current.pr_state !== "merged") {
        throw new BadRequestException("PR 合并前不能记录成功部署");
      }
      const rows = await client.query(
        `UPDATE requirements SET deployment_state=$2,deployment_ref=$3,deployment_url=$4,deployment_checked_at=now(),updated_at=now()
         WHERE id=$1 RETURNING *`,
        [id, parsed.data.state, parsed.data.releaseId, parsed.data.url]
      );
      await client.query("COMMIT");
      return mapRow(rows.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
