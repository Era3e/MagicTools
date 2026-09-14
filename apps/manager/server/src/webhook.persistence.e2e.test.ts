// @database-integration: required by test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureDatabase, migrate, pool } from "./db";
import { WebhookController } from "./webhook.controller";
import { claimGithubDelivery, finishGithubDelivery } from "./webhook.repo";

let available = false;

beforeAll(async () => {
  process.env.GITHUB_STUB = "1";
  process.env.GITHUB_WEBHOOK_SECRET = "";
  await ensureDatabase();
  await migrate();
  available = true;
}, 20000);

afterAll(async () => {
  delete process.env.GITHUB_STUB;
  process.env.GITHUB_WEBHOOK_SECRET = "";
  await pool.end();
});

describe("GitHub Webhook 持久幂等", () => {
  it("旧消费者不能回写新领取的delivery租约", async () => {
    if (!available) return;
    const deliveryId = "webhook-lock-owner-test";
    await pool.query("DELETE FROM github_webhook_deliveries WHERE delivery_id=$1", [deliveryId]);
    const firstOwner = await claimGithubDelivery({
      deliveryId,
      event: "pull_request",
      action: "synchronize",
      payloadSha256: "test-sha",
      leaseMilliseconds: 60_000,
    });
    expect(firstOwner).toEqual(expect.any(String));
    await pool.query(
      "UPDATE github_webhook_deliveries SET lease_expires_at=now()-interval '1 second' WHERE delivery_id=$1",
      [deliveryId],
    );
    const secondOwner = await claimGithubDelivery({
      deliveryId,
      event: "pull_request",
      action: "synchronize",
      payloadSha256: "test-sha",
      leaseMilliseconds: 60_000,
    });
    expect(secondOwner).toEqual(expect.any(String));
    expect(secondOwner).not.toBe(firstOwner);

    await finishGithubDelivery(deliveryId, firstOwner as string, "error");
    const staleResult = await pool.query(
      "SELECT status,locked_by FROM github_webhook_deliveries WHERE delivery_id=$1",
      [deliveryId],
    );
    expect(staleResult.rows[0]).toMatchObject({ status: "processing", locked_by: secondOwner });

    await finishGithubDelivery(deliveryId, secondOwner as string, "done");
    const finalResult = await pool.query(
      "SELECT status,locked_by FROM github_webhook_deliveries WHERE delivery_id=$1",
      [deliveryId],
    );
    expect(finalResult.rows[0]).toEqual({ status: "done", locked_by: null });
  });

  it("异常delivery可被同ID重试重新领取", async () => {
    if (!available) return;
    const deliveryId = "webhook-error-retry-test";
    const input = {
      deliveryId,
      event: "pull_request",
      action: "synchronize",
      payloadSha256: "test-sha",
    };
    await pool.query("DELETE FROM github_webhook_deliveries WHERE delivery_id=$1", [deliveryId]);
    const firstOwner = await claimGithubDelivery(input);
    expect(firstOwner).toEqual(expect.any(String));
    await finishGithubDelivery(deliveryId, firstOwner as string, "error");

    const retryOwner = await claimGithubDelivery(input);
    expect(retryOwner).toEqual(expect.any(String));
    expect(retryOwner).not.toBe(firstOwner);
    const row = await pool.query(
      "SELECT status,locked_by FROM github_webhook_deliveries WHERE delivery_id=$1",
      [deliveryId],
    );
    expect(row.rows[0]).toMatchObject({ status: "processing", locked_by: retryOwner });
    await finishGithubDelivery(deliveryId, retryOwner as string, "done");
  });

  it("相同delivery跨实例只产生一次状态效果并持久记录", async () => {
    if (!available) return;
    const prUrl = "https://github.com/Era3e/MagicTools/pull/9001";
    await pool.query("DELETE FROM requirements WHERE pr_url=$1", [prUrl]);
    await pool.query(
      `INSERT INTO requirements(title, description, source, source_ref, status, pr_url, labels)
       VALUES('Webhook幂等需求', '验证跨实例delivery', 'github', $1, 'developing', $2, '[]'::jsonb)`,
      ["webhook-persistence-9001", prUrl],
    );
    const payload = {
      action: "closed",
      pull_request: {
        html_url: prUrl,
        state: "closed" as const,
        merged: true,
        number: 9001,
        title: "merged PR",
        updated_at: "2026-09-14T06:00:00Z",
        base: { ref: "main" },
        head: { ref: "feature", user: { login: "dev" } },
      },
      repository: { name: "MagicTools" },
    };

    const first = await new WebhookController().github(
      undefined, "pull_request", "delivery-persistent-9001", Buffer.from(JSON.stringify(payload)), payload,
    );
    const second = await new WebhookController().github(
      undefined, "pull_request", "delivery-persistent-9001", Buffer.from(JSON.stringify(payload)), payload,
    );

    expect(first).toMatchObject({ ok: true, action: "status_updated", status: "accepting" });
    expect(second).toMatchObject({ ok: true, action: "deduplicated" });
    const requirement = await pool.query("SELECT status FROM requirements WHERE pr_url=$1", [prUrl]);
    expect(requirement.rows[0].status).toBe("accepting");
    const deliveries = await pool.query(
      "SELECT status FROM github_webhook_deliveries WHERE delivery_id=$1",
      ["delivery-persistent-9001"],
    );
    expect(deliveries.rows).toEqual([{ status: "done" }]);
  });

  it("按PR updated_at拒绝旧事件并推进新事件时间", async () => {
    if (!available) return;
    const prUrl = "https://github.com/Era3e/MagicTools/pull/9002";
    await pool.query("DELETE FROM requirements WHERE pr_url=$1", [prUrl]);
    await pool.query(
      `INSERT INTO requirements(title, description, source, source_ref, status, pr_url, labels, github_last_event_at)
       VALUES('Webhook顺序需求', '验证乱序保护', 'github', $1, 'developing', $2, '[]'::jsonb, '2026-09-14T12:00:00Z')`,
      ["webhook-order-9002", prUrl],
    );
    const payload = (updated_at: string, action: string, state: "open" | "closed", merged: boolean) => ({
      action,
      pull_request: {
        html_url: prUrl, state, merged, number: 9002, title: "ordered PR",
        updated_at, base: { ref: "main" }, head: { ref: "feature", user: { login: "dev" } },
      },
      repository: { name: "MagicTools" },
    });

    const older = await new WebhookController().github(
      undefined, "pull_request", "webhook-order-old", Buffer.from("{}"),
      payload("2026-09-14T11:00:00Z", "closed", "closed", false),
    );
    expect(older).toMatchObject({ ok: true, action: "out_of_order" });
    const timestamp = `to_char(github_last_event_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
    const before = await pool.query(`SELECT ${timestamp} AS github_last_event_at FROM requirements WHERE pr_url=$1`, [prUrl]);
    expect(before.rows[0].github_last_event_at).toBe("2026-09-14T12:00:00.000Z");

    const newer = await new WebhookController().github(
      undefined, "pull_request", "webhook-order-new", Buffer.from("{}"),
      payload("2026-09-14T13:00:00Z", "closed", "closed", true),
    );
    expect(newer).toMatchObject({ ok: true, action: "status_updated", status: "accepting" });
    const after = await pool.query(`SELECT status,${timestamp} AS github_last_event_at FROM requirements WHERE pr_url=$1`, [prUrl]);
    expect(after.rows[0]).toMatchObject({
      status: "accepting",
      github_last_event_at: "2026-09-14T13:00:00.000Z",
    });
  });

  it("处理中租约过期后可重新领取", async () => {
    if (!available) return;
    const prUrl = "https://github.com/Era3e/MagicTools/pull/9003";
    await pool.query("DELETE FROM requirements WHERE pr_url=$1", [prUrl]);
    await pool.query(
      `INSERT INTO requirements(title, description, source, source_ref, status, pr_url, labels)
       VALUES('Webhook恢复需求', '验证过期租约', 'github', $1, 'developing', $2, '[]'::jsonb)`,
      ["webhook-recovery-9003", prUrl],
    );
    const payload = {
      action: "closed",
      pull_request: {
        html_url: prUrl, state: "closed" as const, merged: true, number: 9003,
        title: "recoverable PR", updated_at: "2026-09-14T14:00:00Z",
        base: { ref: "main" }, head: { ref: "feature", user: { login: "dev" } },
      },
      repository: { name: "MagicTools" },
    };
    await new WebhookController().github(
      undefined, "pull_request", "delivery-recovery-9003", Buffer.from(JSON.stringify(payload)), payload,
    );
    await pool.query(
      "UPDATE github_webhook_deliveries SET status='processing',locked_by='crashed',lease_expires_at=now()-interval '1 second' WHERE delivery_id=$1",
      ["delivery-recovery-9003"],
    );

    const recovered = await new WebhookController().github(
      undefined, "pull_request", "delivery-recovery-9003", Buffer.from(JSON.stringify(payload)), payload,
    );
    const delivery = await pool.query(
      "SELECT status,locked_by FROM github_webhook_deliveries WHERE delivery_id=$1",
      ["delivery-recovery-9003"],
    );
    expect(recovered).toMatchObject({ ok: true, action: "out_of_order" });
    expect(delivery.rows[0]).toEqual({ status: "done", locked_by: null });
  });
});
