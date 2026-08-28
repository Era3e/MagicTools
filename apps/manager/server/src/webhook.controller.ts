/**
 * GitHub Webhook Controller
 *
 * 实现 D-03：Manager PR 状态 Webhook 自动刷新
 *
 * 接收 GitHub pull_request 事件，校验 HMAC-SHA256 签名，
 * 解析 action（opened/reopened/closed/merged/synchronize/edit），
 * 通过 prUrl 或 sourceRef 匹配 requirement，联动状态 + 追加 timeline 记录。
 *
 * 幂等策略：同 pr 号的同动作在 5 分钟内已处理则直接返回 200（避免 GitHub 重试放大写入）
 */
import { Body, Controller, Headers, HttpCode, Post, RawBody } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { getRequirement, setStatusWithTimeline, type RequirementStatus } from "./requirement.repo";

/** 允许的 PR 事件动作白名单（其他直接 200 忽略） */
const PR_ACTIONS = new Set(["opened", "reopened", "closed", "merged", "synchronize", "edited"]);

/** 当前状态在哪些前置状态下才允许迁移（避免 accepting/done 被回退） */
const STATUS_TRANSITIONS: Record<RequirementStatus, RequirementStatus[]> = {
  waiting: ["developing", "todo"],
  designing: ["developing", "todo"],
  todo: ["developing"],
  developing: ["testing", "todo", "accepting"],
  testing: ["accepting", "developing"],
  accepting: ["done"],
  done: [],
};

@Controller("webhook")
export class WebhookController {
  /** 最近处理记录 { signature: timestamp }，用于幂等去重（TTL 5min） */
  private readonly recent = new Map<string, number>();
  private readonly RECENT_TTL_MS = 5 * 60 * 1000;

  constructor() {
    // 定时清理过期记录
    setInterval(() => {
      const now = Date.now();
      for (const [sig, ts] of this.recent) {
        if (now - ts > this.RECENT_TTL_MS) this.recent.delete(sig);
      }
    }, 60_000);
  }

  @Post("github")
  @HttpCode(200)
  async github(
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Headers("x-github-event") event: string | undefined,
    @Headers("x-github-delivery") delivery: string | undefined,
    @RawBody() rawBody: Buffer,
    @Body() body: unknown,
  ): Promise<WebhookResponse> {
    // 1. 幂等：相同 delivery id 5 分钟内已处理直接 200
    const dedupeKey = delivery ?? signature ?? "";
    if (dedupeKey && this.recent.has(dedupeKey)) {
      return { ok: true, action: "deduplicated" };
    }

    // 2. 签名校验（生产环境必须，桩环境跳过）
    const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
    if (secret && !process.env.GITHUB_STUB) {
      const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
      if (!signature || signature !== expected) {
        return { ok: false, action: "signature_mismatch" };
      }
    }

    // 3. 事件类型白名单
    if (event !== "pull_request") {
      return { ok: true, action: "ignored", reason: "only pull_request handled" };
    }

    const payload = body as {
      action: string;
      pull_request: {
        html_url: string;
        state: "open" | "closed";
        merged: boolean;
        number: number;
        title: string;
        base: { ref: string };
        head: { ref: string; user: { login: string } };
      };
      repository: { name: string };
      sender?: { login: string };
    };

    if (!payload?.pull_request) {
      return { ok: false, action: "no_pull_request" };
    }

    if (!PR_ACTIONS.has(payload.action)) {
      return { ok: true, action: "ignored", reason: `action ${payload.action} not in whitelist` };
    }

    // 4. 幂等登记（在真正处理之前登记，避免并发重复处理）
    if (dedupeKey) this.recent.set(dedupeKey, Date.now());

    // 5. 解析 PR 状态 → 映射到 RequirementStatus
    const pr = payload.pull_request;
    let targetStatus: RequirementStatus | null = null;
    let note = "";

    if (pr.merged) {
      targetStatus = "accepting";
      note = "Webhook: PR merged";
    } else if (pr.state === "open") {
      targetStatus = payload.action === "synchronize" ? "developing" : "developing";
      note = "Webhook: PR " + payload.action + " (open)";
    } else if (pr.state === "closed" && !pr.merged) {
      targetStatus = "todo";
      note = "Webhook: PR closed without merge";
    }

    if (!targetStatus) {
      return { ok: true, action: "ignored", reason: "no target status resolved" };
    }

    // 6. 查找关联的 requirement
    const prUrl = pr.html_url;
    const row = await findRequirementByPrUrl(prUrl);
    if (!row) {
      return { ok: true, action: "no_match", reason: `no requirement linked to ${prUrl}` };
    }

    // 7. 应用状态迁移（遵守状态机）
    const allowed = STATUS_TRANSITIONS[row.status];
    if (!allowed.includes(targetStatus) && row.status !== targetStatus) {
      // 允许 accepting → done 的自动推进
      if (row.status === "accepting" && targetStatus === "accepting") {
        // 同状态忽略
        return { ok: true, action: "skipped", reason: "same status" };
      }
      if (targetStatus === "accepting" && row.status === "done") {
        return { ok: true, action: "skipped", reason: "cannot regress done" };
      }
      // 其他非允许的迁移，记录但不执行
      return {
        ok: true,
        action: "skipped",
        reason: `transition ${row.status}→${targetStatus} not allowed`,
      };
    }

    await setStatusWithTimeline(row.id, targetStatus, row.status, note);

    return { ok: true, action: "status_updated", id: row.id, status: targetStatus };
  }
}

/** 按 prUrl 查找 requirement */
async function findRequirementByPrUrl(prUrl: string): Promise<Awaited<ReturnType<typeof getRequirement>>> {
  // 直接用 getRequirement 不够，需要按 prUrl 反查
  // 这里复用 findRequirementByRef 的 source=github，或新增一个 findRequirementByPrUrl
  // 简化实现：从 pool 里查（requirement.repo 未暴露此方法时直接写 SQL）
  const { pool } = await import("./db");
  const rows = await pool.query(
    "SELECT * FROM requirements WHERE pr_url = $1 LIMIT 1",
    [prUrl],
  );
  if (!rows.rowCount) return null;
  // 映射回 RequirementRow
  const r = rows.rows[0] as Record<string, unknown>;
  return {
    id: r.id as string,
    title: r.title as string,
    description: r.description as string,
    source: r.source as string,
    sourceRef: r.source_ref as string,
    sourcePayload: (r.source_payload as Record<string, unknown>) ?? null,
    status: r.status as RequirementStatus,
    priority: r.priority as string,
    iterationId: (r.iteration_id as string) ?? null,
    branch: r.branch as string,
    prUrl: r.pr_url as string,
    labels: (r.labels as string[]) ?? [],
    timeline: (r.timeline as Array<{ at: string; from: string; to: string; note?: string }>) ?? [],
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

interface WebhookResponse {
  ok: boolean;
  action: string;
  reason?: string;
  id?: string;
  status?: string;
}
