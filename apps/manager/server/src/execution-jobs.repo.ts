import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./db";
import type { ExecutionContract } from "./requirement-content";

export const EXECUTION_JOB_STATUSES = ["queued", "running", "retry", "succeeded", "failed", "cancelled"] as const;
export type ExecutionJobStatus = (typeof EXECUTION_JOB_STATUSES)[number];
export const EXECUTION_RUN_STATUSES = ["running", "succeeded", "failed", "expired", "cancelled"] as const;
export type ExecutionRunStatus = (typeof EXECUTION_RUN_STATUSES)[number];

export interface ExecutionRunView {
  id: string;
  attempt: number;
  status: ExecutionRunStatus;
  executorId: string;
  heartbeatAt: string;
  leaseExpiresAt: string;
  hardDeadlineAt: string;
  result: Record<string, unknown> | null;
  error: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface ExecutionJobView {
  id: string;
  requirementId: string;
  requirementRevision: number;
  contentRevision: number;
  contract: ExecutionContract;
  status: ExecutionJobStatus;
  attempts: number;
  maxAttempts: number;
  cancellationReason: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  runs: ExecutionRunView[];
}

export interface ClaimExecutionJobInput {
  executorId: string;
  leaseMilliseconds: number;
}

export interface ClaimedExecutionJob {
  jobId: string;
  runId: string;
  runToken: string;
  executorId: string;
  attempt: number;
  maxAttempts: number;
  leaseExpiresAt: string;
  hardDeadlineAt: string;
  requirementId: string;
  requirementRevision: number;
  contentRevision: number;
  contract: ExecutionContract;
  requirement: {
    title: string;
    description: string;
    scope: string;
    acceptanceCriteria: string[];
  };
}

function toDate(value: Date | string | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

function mapRun(row: Record<string, unknown>): ExecutionRunView {
  return {
    id: row.id as string,
    attempt: Number(row.attempt),
    status: row.status as ExecutionRunStatus,
    executorId: row.executor_id as string,
    heartbeatAt: new Date(row.heartbeat_at as Date).toISOString(),
    leaseExpiresAt: new Date(row.lease_expires_at as Date).toISOString(),
    hardDeadlineAt: new Date(row.hard_deadline_at as Date).toISOString(),
    result: (row.result as Record<string, unknown> | null) ?? null,
    error: (row.error as string) ?? "",
    createdAt: new Date(row.created_at as Date).toISOString(),
    updatedAt: new Date(row.updated_at as Date).toISOString(),
    finishedAt: toDate(row.finished_at as Date | string | null),
  };
}

function mapJob(row: Record<string, unknown>): ExecutionJobView {
  return {
    id: row.id as string,
    requirementId: row.requirement_id as string,
    requirementRevision: Number(row.requirement_revision),
    contentRevision: Number(row.content_revision),
    contract: row.contract as ExecutionContract,
    status: row.status as ExecutionJobStatus,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    cancellationReason: (row.cancellation_reason as string) ?? "",
    createdAt: new Date(row.created_at as Date).toISOString(),
    updatedAt: new Date(row.updated_at as Date).toISOString(),
    startedAt: toDate(row.started_at as Date | string | null),
    finishedAt: toDate(row.finished_at as Date | string | null),
    runs: ((row.runs as Array<Record<string, unknown>>) ?? []).map(mapRun),
  };
}

export async function insertExecutionJob(input: {
  requirementId: string;
  requirementRevision: number;
  contentRevision: number;
  contract: ExecutionContract;
  maxAttempts: number;
}, database: Pick<PoolClient, "query"> = pool): Promise<ExecutionJobView> {
  const rows = await database.query(
    `INSERT INTO execution_jobs
      (requirement_id,requirement_revision,content_revision,contract,max_attempts)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.requirementId, input.requirementRevision, input.contentRevision, JSON.stringify(input.contract), input.maxAttempts]
  );
  return mapJob(rows.rows[0]);
}

export async function findExecutionJobByRevision(requirementId: string, contentRevision: number): Promise<ExecutionJobView | null> {
  const rows = await pool.query(
    `SELECT j.*, COALESCE((SELECT jsonb_agg(r ORDER BY r.attempt DESC) FROM execution_runs r WHERE r.job_id=j.id),'[]'::jsonb) AS runs
     FROM execution_jobs j WHERE j.requirement_id=$1 AND j.content_revision=$2`,
    [requirementId, contentRevision]
  );
  return rows.rowCount ? mapJob(rows.rows[0]) : null;
}

export async function getExecutionJob(id: string): Promise<ExecutionJobView | null> {
  const rows = await pool.query(
    `SELECT j.*, COALESCE((SELECT jsonb_agg(r ORDER BY r.attempt DESC) FROM execution_runs r WHERE r.job_id=j.id),'[]'::jsonb) AS runs
     FROM execution_jobs j WHERE j.id=$1`,
    [id]
  );
  return rows.rowCount ? mapJob(rows.rows[0]) : null;
}

export async function listExecutionJobs(filters: { requirementId?: string; status?: string } = {}): Promise<ExecutionJobView[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.requirementId) {
    params.push(filters.requirementId);
    where.push("j.requirement_id=$" + params.length);
  }
  if (filters.status) {
    params.push(filters.status);
    where.push("j.status=$" + params.length);
  }
  const rows = await pool.query(
    `SELECT j.*, COALESCE((SELECT jsonb_agg(r ORDER BY r.attempt DESC) FROM execution_runs r WHERE r.job_id=j.id),'[]'::jsonb) AS runs
     FROM execution_jobs j` + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY j.created_at DESC LIMIT 200"
  , params);
  return rows.rows.map(mapJob);
}

export async function claimExecutionJob(input: ClaimExecutionJobInput): Promise<ClaimedExecutionJob | null> {
  const client = await pool.connect();
  try {
    for (let checked = 0; checked < 50; checked += 1) {
      await client.query("BEGIN");
      const found = await client.query(
        `SELECT j.*, r.content_revision AS current_content_revision,
                r.approved_content_revision, r.status AS requirement_status,
                r.title AS requirement_title, r.description AS requirement_description,
                r.scope AS requirement_scope, r.acceptance_criteria AS requirement_acceptance_criteria
         FROM execution_jobs j
         JOIN requirements r ON r.id=j.requirement_id
         WHERE j.status IN ('queued','retry') AND j.attempts < j.max_attempts
         ORDER BY j.created_at
         LIMIT 1
         FOR UPDATE OF j SKIP LOCKED`
      );
      if (!found.rowCount) {
        await client.query("COMMIT");
        return null;
      }
      const row = found.rows[0] as Record<string, unknown>;
      const jobId = row.id as string;
      const contentRevision = Number(row.content_revision);
      const stale = Number(row.current_content_revision) !== contentRevision ||
        Number(row.approved_content_revision ?? -1) !== contentRevision ||
        row.requirement_status !== "todo";
      if (stale) {
        await client.query(
          `UPDATE execution_jobs SET status='failed',finished_at=now(),updated_at=now(),
            cancellation_reason='requirement state changed before claim'
           WHERE id=$1`,
          [jobId]
        );
        await client.query("COMMIT");
        continue;
      }

      const contract = row.contract as ExecutionContract;
      const attempt = Number(row.attempts) + 1;
      const maxDurationMs = contract.maxDurationMinutes * 60_000;
      const leaseMilliseconds = Math.min(input.leaseMilliseconds, maxDurationMs);
      const runToken = randomUUID();
      const runTokenHash = createHash("sha256").update(runToken).digest("hex");
      const run = await client.query(
        `INSERT INTO execution_runs
          (job_id,attempt,status,executor_id,run_token_hash,lease_expires_at,hard_deadline_at)
         VALUES ($1,$2,'running',$3,$4,now()+($5 * interval '1 millisecond'),now()+($6 * interval '1 millisecond'))
         RETURNING id,lease_expires_at,hard_deadline_at`,
        [jobId, attempt, input.executorId, runTokenHash, leaseMilliseconds, maxDurationMs]
      );
      await client.query(
        `UPDATE execution_jobs SET status='running',attempts=$2,started_at=COALESCE(started_at,now()),updated_at=now()
         WHERE id=$1`,
        [jobId, attempt]
      );
      await client.query("COMMIT");
      return {
        jobId,
        runId: run.rows[0].id as string,
        runToken,
        executorId: input.executorId,
        attempt,
        maxAttempts: Number(row.max_attempts),
        leaseExpiresAt: new Date(run.rows[0].lease_expires_at as Date).toISOString(),
        hardDeadlineAt: new Date(run.rows[0].hard_deadline_at as Date).toISOString(),
        requirementId: row.requirement_id as string,
        requirementRevision: Number(row.requirement_revision),
        contentRevision,
        contract,
        requirement: {
          title: row.requirement_title as string,
          description: (row.requirement_description as string) ?? "",
          scope: (row.requirement_scope as string) ?? "",
          acceptanceCriteria: ((row.requirement_acceptance_criteria as string[]) ?? []),
        },
      };
    }
    return null;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function heartbeatExecutionRun(jobId: string, runToken: string, extensionMilliseconds: number): Promise<ExecutionRunView | null> {
  const tokenHash = createHash("sha256").update(runToken).digest("hex");
  const rows = await pool.query(
    `UPDATE execution_runs SET heartbeat_at=now(),updated_at=now(),
      lease_expires_at=LEAST(now()+($3 * interval '1 millisecond'),hard_deadline_at)
     WHERE job_id=$1 AND run_token_hash=$2 AND status='running' AND lease_expires_at>now()
     RETURNING *`,
    [jobId, tokenHash, extensionMilliseconds]
  );
  return rows.rowCount ? mapRun(rows.rows[0]) : null;
}

export async function completeExecutionRun(jobId: string, runToken: string, result: Record<string, unknown>): Promise<ExecutionJobView | null> {
  const tokenHash = createHash("sha256").update(runToken).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const job = await client.query("SELECT * FROM execution_jobs WHERE id=$1 FOR UPDATE", [jobId]);
    if (!job.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    const run = await client.query(
      `UPDATE execution_runs SET status='succeeded',result=$3,finished_at=now(),updated_at=now(),
        lease_expires_at=now()
       WHERE job_id=$1 AND run_token_hash=$2 AND status='running' AND lease_expires_at>now()
       RETURNING *`,
      [jobId, tokenHash, JSON.stringify(result)]
    );
    if (!run.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `UPDATE execution_jobs SET status='succeeded',finished_at=now(),updated_at=now() WHERE id=$1`,
      [jobId]
    );
    await client.query("COMMIT");
    return getExecutionJob(jobId);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function failExecutionRun(jobId: string, runToken: string, error: string): Promise<ExecutionJobView | null> {
  const tokenHash = createHash("sha256").update(runToken).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const job = await client.query("SELECT * FROM execution_jobs WHERE id=$1 FOR UPDATE", [jobId]);
    if (!job.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    const run = await client.query(
      `UPDATE execution_runs SET status='failed',error=$3,finished_at=now(),updated_at=now(),lease_expires_at=now()
       WHERE job_id=$1 AND run_token_hash=$2 AND status='running' AND lease_expires_at>now()
       RETURNING attempt`,
      [jobId, tokenHash, error]
    );
    if (!run.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    const attempt = Number(run.rows[0].attempt);
    const maxAttempts = Number(job.rows[0].max_attempts);
    await client.query(
      `UPDATE execution_jobs SET status=$2,finished_at=CASE WHEN $2='failed' THEN now() ELSE NULL END,updated_at=now()
       WHERE id=$1`,
      [jobId, attempt < maxAttempts ? "retry" : "failed"]
    );
    await client.query("COMMIT");
    return getExecutionJob(jobId);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelExecutionJob(jobId: string, reason: string): Promise<ExecutionJobView | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const job = await client.query("SELECT * FROM execution_jobs WHERE id=$1 FOR UPDATE", [jobId]);
    if (!job.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    if (["succeeded", "failed", "cancelled"].includes(job.rows[0].status as string)) {
      await client.query("COMMIT");
      return getExecutionJob(jobId);
    }
    await client.query(
      `UPDATE execution_runs SET status='cancelled',finished_at=now(),updated_at=now(),lease_expires_at=now()
       WHERE job_id=$1 AND status='running'`,
      [jobId]
    );
    await client.query(
      `UPDATE execution_jobs SET status='cancelled',cancellation_reason=$2,finished_at=now(),updated_at=now() WHERE id=$1`,
      [jobId, reason]
    );
    await client.query("COMMIT");
    return getExecutionJob(jobId);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recoverExpiredExecutionRuns(): Promise<Array<{ jobId: string; runId: string; outcome: "retry" | "failed" }>> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const expired = await client.query(
      `SELECT r.id AS run_id,r.job_id,r.attempt,j.max_attempts
       FROM execution_runs r JOIN execution_jobs j ON j.id=r.job_id
       WHERE r.status='running' AND r.lease_expires_at<now()
       ORDER BY r.lease_expires_at
       LIMIT 100
       FOR UPDATE OF r,j SKIP LOCKED`
    );
    const results: Array<{ jobId: string; runId: string; outcome: "retry" | "failed" }> = [];
    for (const row of expired.rows as Array<{ run_id: string; job_id: string; attempt: number; max_attempts: number }>) {
      await client.query(
        `UPDATE execution_runs SET status='expired',error='lease expired',finished_at=now(),updated_at=now(),lease_expires_at=now()
         WHERE id=$1 AND status='running'`,
        [row.run_id]
      );
      const outcome = row.attempt < row.max_attempts ? "retry" : "failed";
      await client.query(
        `UPDATE execution_jobs SET status=$2,finished_at=CASE WHEN $2='failed' THEN now() ELSE NULL END,updated_at=now()
         WHERE id=$1`,
        [row.job_id, outcome]
      );
      results.push({ jobId: row.job_id, runId: row.run_id, outcome });
    }
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
