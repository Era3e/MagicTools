import type { PoolClient } from "pg";
import { pool } from "./db";

export type EvidenceCategory = "routes" | "controller" | "service" | "schema" | "tests";

export interface EvidencePointer {
  commit: string;
  path: string;
  startLine: number;
  endLine: number;
  url: string;
  excerpt: string;
}

export interface EvidenceCandidateInput {
  title: string;
  description: string;
  motivation: "unknown";
  category: EvidenceCategory;
  path: string;
  contentSha256: string;
  evidence: EvidencePointer;
}

export interface EvidenceCandidate extends EvidenceCandidateInput {
  id: string;
  taskId: string;
  createdAt: string;
}

export interface EvidenceTask {
  id: string;
  repo: string;
  commitSha: string;
  commitMessage: string;
  totalFiles: number;
  selectedFiles: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceTaskWithCandidates {
  task: EvidenceTask;
  candidates: EvidenceCandidate[];
}

function mapTask(row: Record<string, unknown>): EvidenceTask {
  return {
    id: row.id as string,
    repo: row.repo as string,
    commitSha: row.commit_sha as string,
    commitMessage: row.commit_message as string,
    totalFiles: Number(row.total_files),
    selectedFiles: Number(row.selected_files),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function mapCandidate(row: Record<string, unknown>): EvidenceCandidate {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    title: row.title as string,
    description: row.description as string,
    motivation: row.motivation as "unknown",
    category: row.category as EvidenceCategory,
    path: row.path as string,
    contentSha256: row.content_sha256 as string,
    evidence: row.evidence as EvidencePointer,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

async function candidatesForTaskIds(taskIds: string[]): Promise<Map<string, EvidenceCandidate[]>> {
  const result = new Map<string, EvidenceCandidate[]>();
  if (!taskIds.length) return result;
  const rows = await pool.query(
    "SELECT * FROM repository_evidence_candidates WHERE task_id = ANY($1::uuid[]) ORDER BY category, path, created_at",
    [taskIds]
  );
  for (const row of rows.rows) {
    const candidate = mapCandidate(row);
    const list = result.get(candidate.taskId) ?? [];
    list.push(candidate);
    result.set(candidate.taskId, list);
  }
  return result;
}

export async function findEvidenceTask(repo: string, commitSha: string): Promise<EvidenceTaskWithCandidates | null> {
  const taskRows = await pool.query(
    "SELECT * FROM repository_evidence_tasks WHERE repo=$1 AND commit_sha=$2 LIMIT 1",
    [repo, commitSha]
  );
  if (!taskRows.rowCount) return null;
  const task = mapTask(taskRows.rows[0]);
  const candidates = (await candidatesForTaskIds([task.id])).get(task.id) ?? [];
  return { task, candidates };
}

export async function createEvidenceTaskWithCandidates(input: {
  repo: string;
  commitSha: string;
  commitMessage: string;
  totalFiles: number;
  candidates: EvidenceCandidateInput[];
}): Promise<EvidenceTaskWithCandidates & { created: boolean }> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const taskRows = await client.query(
      `INSERT INTO repository_evidence_tasks
         (repo,commit_sha,commit_message,total_files,selected_files)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (repo, commit_sha) DO NOTHING
       RETURNING *`,
      [input.repo, input.commitSha, input.commitMessage, input.totalFiles, input.candidates.length]
    );
    let task: EvidenceTask;
    let created = false;
    if (taskRows.rowCount) {
      task = mapTask(taskRows.rows[0]);
      created = true;
      for (const candidate of input.candidates) {
        await client.query(
          `INSERT INTO repository_evidence_candidates
             (task_id,title,description,motivation,category,path,content_sha256,evidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [task.id, candidate.title, candidate.description, candidate.motivation, candidate.category,
            candidate.path, candidate.contentSha256, JSON.stringify(candidate.evidence)]
        );
      }
    } else {
      const existing = await client.query(
        "SELECT * FROM repository_evidence_tasks WHERE repo=$1 AND commit_sha=$2 LIMIT 1",
        [input.repo, input.commitSha]
      );
      if (!existing.rowCount) throw new Error("仓库证据任务写入后无法读取");
      task = mapTask(existing.rows[0]);
    }
    const candidateRows = await client.query(
      "SELECT * FROM repository_evidence_candidates WHERE task_id=$1 ORDER BY category, path, created_at",
      [task.id]
    );
    if (created && candidateRows.rowCount !== input.candidates.length) {
      throw new Error("仓库证据候选写入不完整");
    }
    await client.query("COMMIT");
    return { created, task, candidates: candidateRows.rows.map(mapCandidate) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listEvidenceTasks(limit = 50): Promise<EvidenceTaskWithCandidates[]> {
  const taskRows = await pool.query(
    "SELECT * FROM repository_evidence_tasks ORDER BY updated_at DESC LIMIT $1",
    [Math.min(Math.max(limit, 1), 100)]
  );
  const tasks = taskRows.rows.map(mapTask);
  const grouped = await candidatesForTaskIds(tasks.map((task) => task.id));
  return tasks.map((task) => ({ task, candidates: grouped.get(task.id) ?? [] }));
}

export async function getEvidenceTask(id: string): Promise<EvidenceTaskWithCandidates | null> {
  const taskRows = await pool.query("SELECT * FROM repository_evidence_tasks WHERE id=$1 LIMIT 1", [id]);
  if (!taskRows.rowCount) return null;
  const task = mapTask(taskRows.rows[0]);
  const candidates = (await candidatesForTaskIds([task.id])).get(task.id) ?? [];
  return { task, candidates };
}
