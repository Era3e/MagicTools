import { Body, Controller, Headers, HttpCode, Post, RawBody } from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { RequirementStatus } from "./requirement.repo";
import { applyGithubPrState, claimGithubDelivery, finishGithubDelivery } from "./webhook.repo";

const PR_ACTIONS = new Set(["opened", "reopened", "closed", "merged", "synchronize", "edited"]);

interface PullRequestPayload {
  action: string;
  pull_request: {
    html_url: string;
    state: "open" | "closed";
    merged: boolean;
    number: number;
    title: string;
    updated_at?: string;
    base: { ref: string };
    head: { ref: string; user: { login: string } };
  };
  repository: { name: string };
  sender?: { login: string };
}

interface WebhookResponse {
  ok: boolean;
  action: string;
  reason?: string;
  id?: string;
  status?: string;
}

@Controller("webhook")
export class WebhookController {
  @Post("github")
  @HttpCode(200)
  async github(
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Headers("x-github-event") event: string | undefined,
    @Headers("x-github-delivery") delivery: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
    @Body() body: unknown,
  ): Promise<WebhookResponse> {
    const deliveryId = delivery ?? "";
    if (!deliveryId) return { ok: false, action: "missing_delivery" };
    const payloadBytes = rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
    const stub = process.env.GITHUB_STUB === "1";
    const production = process.env.NODE_ENV === "production" || process.env.MT_PROD === "1";
    if (production && (!secret || stub)) {
      return { ok: false, action: "signature_required" };
    }
    if (!stub) {
      if (!secret) return { ok: false, action: "signature_required" };
      if (!rawBody) return { ok: false, action: "signature_mismatch", reason: "raw body required" };
      const expected = "sha256=" + createHmac("sha256", secret).update(payloadBytes).digest("hex");
      const provided = signature ?? "";
      if (!provided.startsWith("sha256=") || provided.length !== expected.length ||
          !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
        return { ok: false, action: "signature_mismatch" };
      }
    }

    if (event !== "pull_request") {
      return { ok: true, action: "ignored", reason: "only pull_request handled" };
    }

    const payload = body as PullRequestPayload;
    if (!payload?.pull_request) return { ok: false, action: "no_pull_request" };
    if (!PR_ACTIONS.has(payload.action)) {
      return { ok: true, action: "ignored", reason: `action ${payload.action} not in whitelist` };
    }

    const lockedBy = await claimGithubDelivery({
      deliveryId,
      event,
      action: payload.action,
      payloadSha256: createHash("sha256").update(payloadBytes).digest("hex"),
    });
    if (!lockedBy) return { ok: true, action: "deduplicated" };

    try {
      return await this.applyPullRequest(payload, deliveryId, lockedBy);
    } catch (error) {
      await finishGithubDelivery(deliveryId, lockedBy, "error").catch(() => undefined);
      throw error;
    }
  }

  private async applyPullRequest(payload: PullRequestPayload, deliveryId: string, lockedBy: string): Promise<WebhookResponse> {
    const pr = payload.pull_request;
    let targetStatus: RequirementStatus;
    let note: string;
    if (pr.merged) {
      targetStatus = "accepting";
      note = "Webhook: PR merged";
    } else if (pr.state === "open") {
      targetStatus = "developing";
      note = "Webhook: PR " + payload.action + " (open)";
    } else {
      targetStatus = "todo";
      note = "Webhook: PR closed without merge";
    }

    if (!pr.updated_at || Number.isNaN(Date.parse(pr.updated_at))) {
      await finishGithubDelivery(deliveryId, lockedBy, "done");
      return { ok: false, action: "invalid_event_time" };
    }

    const result = await applyGithubPrState({
      prUrl: pr.html_url,
      targetStatus,
      eventAt: pr.updated_at,
      note,
    });
    await finishGithubDelivery(deliveryId, lockedBy, "done");
    if (result.outcome === "no_match") {
      return { ok: true, action: "no_match", reason: `no requirement linked to ${pr.html_url}` };
    }
    if (result.outcome === "out_of_order") {
      return { ok: true, action: "out_of_order", reason: `last event ${result.currentEventAt}` };
    }
    if (result.outcome === "same_status") {
      return { ok: true, action: "skipped", reason: "same status", id: result.id };
    }
    if (result.outcome === "transition_not_allowed") {
      return { ok: true, action: "skipped", id: result.id, reason: `transition ${result.from}→${result.to} not allowed` };
    }
    return { ok: true, action: "status_updated", id: result.id, status: result.status };
  }
}
