import { randomUUID } from "node:crypto";
import { compareValues, extractNumbers } from "./compare.service";
import type { DirectResult } from "./direct-query.service";
import type { AgentMeta } from "./cybercloud.service";
import { insertCybercloudCall, markVerifyStatus } from "./cybercloud-calls.repo";

const TTL_MS = 10 * 60 * 1000;

function verifyTimeoutMs(): number {
  const t = Number(process.env.CYBERCLOUD_VERIFY_TIMEOUT_MS || "60000");
  return Number.isFinite(t) && t > 0 ? t : 60000;
}

function tolerance(): number {
  const t = Number(process.env.CYBERCLOUD_COMPARE_TOLERANCE || "0.01");
  return Number.isFinite(t) && t >= 0 ? t : 0.01;
}

export type VerifyStatus = "pending" | "consistent" | "divergent" | "unverifiable" | "agent_failed" | "agent_timeout";

export interface VerifyTask {
  taskId: string;
  status: VerifyStatus;
  verdict?: { directValue: number; agentNumbers: number[]; diffPct?: number };
  agentReply?: string;
  dataSource?: { mode: "dual"; agent?: AgentMeta };
  createdAt: number;
}

export interface AgentQueryResult {
  reply: string;
  meta: AgentMeta;
}

export class VerifyTaskRegistry {
  private readonly tasks = new Map<string, VerifyTask>();

  create(input: { directResult: DirectResult; agentPromise: Promise<AgentQueryResult> }): { taskId: string } {
    const taskId = randomUUID();
    const task: VerifyTask = { taskId, status: "pending", createdAt: Date.now() };
    this.tasks.set(taskId, task);
    const timeout = setTimeout(() => {
      if (task.status === "pending") {
        task.status = "agent_timeout";
        this.finalize(task, { ok: false, verifyStatus: "agent_timeout" });
      }
    }, verifyTimeoutMs());
    input.agentPromise
      .then((res) => {
        if (task.status !== "pending") return;
        clearTimeout(timeout);
        task.dataSource = { mode: "dual", agent: res.meta };
        if (res.meta.sseType === "ERROR") {
          task.status = "agent_failed";
          task.agentReply = res.reply;
          this.finalize(task, { ok: false, verifyStatus: "agent_failed" });
          return;
        }
        const directValue = input.directResult.applicable ? input.directResult.value : 0;
        const numbers = extractNumbers(res.reply);
        const cmp = compareValues(directValue, numbers, tolerance());
        task.status = cmp.status;
        task.verdict = { directValue, agentNumbers: cmp.agentNumbers, ...(cmp.diffPct !== undefined ? { diffPct: cmp.diffPct } : {}) };
        task.agentReply = res.reply;
        this.finalize(task, { ok: true, verifyStatus: cmp.status, ...(cmp.diffPct !== undefined ? { diffPct: cmp.diffPct } : {}) });
      })
      .catch(() => {
        if (task.status !== "pending") return;
        clearTimeout(timeout);
        task.status = "agent_failed";
        this.finalize(task, { ok: false, verifyStatus: "agent_failed" });
      });
    return { taskId };
  }

  private finalize(task: VerifyTask, call: { ok: boolean; verifyStatus: VerifyStatus; diffPct?: number }): void {
    const agentMeta = task.dataSource?.agent;
    insertCybercloudCall({
      route: "agent",
      endpoint: "block",
      ok: call.ok,
      latencyMs: agentMeta?.latencyMs ?? 0,
      error: call.ok ? undefined : call.verifyStatus,
      detail: { sse_type: agentMeta?.sseType, agent_reply: task.agentReply, verify_status: call.verifyStatus },
    })
      .then((row) => markVerifyStatus(row.id, call.verifyStatus, call.diffPct))
      .catch((e) => console.error("[verify] calls 写库失败", e));
    setTimeout(() => this.tasks.delete(task.taskId), TTL_MS).unref();
  }

  get(taskId: string): VerifyTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    if (Date.now() - task.createdAt > TTL_MS) {
      this.tasks.delete(taskId);
      return null;
    }
    return task;
  }
}
