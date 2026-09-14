import { randomUUID } from "node:crypto";
import { pool } from "./db";
import { mapRow } from "./requirement.repo";
import { canTransition } from "./requirement-policy";

export interface ClaimDeliveryInput {
  deliveryId: string;
  event: string;
  action: string;
  payloadSha256: string;
  leaseMilliseconds?: number;
}

export async function claimGithubDelivery(input: ClaimDeliveryInput): Promise<string | null> {
  const lockedBy = randomUUID();
  const leaseMilliseconds = input.leaseMilliseconds ?? 60_000;
  const rows = await pool.query(
    `INSERT INTO github_webhook_deliveries
      (delivery_id,event,action,status,locked_by,lease_expires_at,payload_sha256)
     VALUES ($1,$2,$3,'processing',$4,now()+($5 * interval '1 millisecond'),$6)
     ON CONFLICT (delivery_id) DO UPDATE SET
       status='processing', locked_by=EXCLUDED.locked_by,
       lease_expires_at=EXCLUDED.lease_expires_at, updated_at=now()
     WHERE github_webhook_deliveries.status='error'
       OR (github_webhook_deliveries.status='processing'
         AND github_webhook_deliveries.lease_expires_at < now())
     RETURNING delivery_id, locked_by`,
    [input.deliveryId, input.event, input.action, lockedBy, leaseMilliseconds, input.payloadSha256],
  );
  return rows.rowCount === 1 && rows.rows[0].locked_by === lockedBy ? lockedBy : null;
}

export async function finishGithubDelivery(
  deliveryId: string,
  lockedBy: string,
  status: "done" | "error",
): Promise<void> {
  await pool.query(
    `UPDATE github_webhook_deliveries
     SET status=$3, locked_by=NULL, lease_expires_at=NULL, updated_at=now()
     WHERE delivery_id=$1 AND locked_by=$2 AND status='processing'`,
    [deliveryId, lockedBy, status],
  );
}

export async function findRequirementByPrUrl(prUrl: string) {
  const rows = await pool.query("SELECT * FROM requirements WHERE pr_url=$1 LIMIT 1", [prUrl]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export interface ApplyGithubPrStateInput {
  prUrl: string;
  targetStatus: import("./requirement.repo").RequirementStatus;
  eventAt: string;
  note: string;
}

export type ApplyGithubPrStateResult =
  | { outcome: "no_match" }
  | { outcome: "out_of_order"; currentEventAt: string }
  | { outcome: "same_status"; id: string }
  | { outcome: "transition_not_allowed"; id: string; from: string; to: string }
  | { outcome: "status_updated"; id: string; status: import("./requirement.repo").RequirementStatus };

export async function applyGithubPrState(input: ApplyGithubPrStateInput): Promise<ApplyGithubPrStateResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "SELECT id,status,timeline,github_last_event_at FROM requirements WHERE pr_url=$1 FOR UPDATE",
      [input.prUrl],
    );
    if (!found.rowCount) {
      await client.query("COMMIT");
      return { outcome: "no_match" };
    }
    const current = found.rows[0] as {
      id: string;
      status: import("./requirement.repo").RequirementStatus;
      timeline: Array<{ at: string; from: string; to: string; note?: string }>;
      github_last_event_at: string | null;
    };
    const eventTime = new Date(input.eventAt);
    if (current.github_last_event_at && eventTime.getTime() <= new Date(current.github_last_event_at).getTime()) {
      await client.query("COMMIT");
      return { outcome: "out_of_order", currentEventAt: current.github_last_event_at };
    }
    const allowed = canTransition(current.status, input.targetStatus, "github");
    if (!allowed) {
      await client.query("UPDATE requirements SET github_last_event_at=$2,updated_at=now() WHERE id=$1", [current.id, input.eventAt]);
      await client.query("COMMIT");
      return { outcome: "transition_not_allowed", id: current.id, from: current.status, to: input.targetStatus };
    }
    if (current.status === input.targetStatus) {
      await client.query("UPDATE requirements SET github_last_event_at=$2,updated_at=now() WHERE id=$1", [current.id, input.eventAt]);
      await client.query("COMMIT");
      return { outcome: "same_status", id: current.id };
    }
    const timeline = [...current.timeline, {
      at: new Date().toISOString(), from: current.status, to: input.targetStatus, note: input.note,
    }];
    const updated = await client.query(
      "UPDATE requirements SET status=$2,timeline=$3,github_last_event_at=$4,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING id,status",
      [current.id, input.targetStatus, JSON.stringify(timeline), input.eventAt],
    );
    await client.query("COMMIT");
    return {
      outcome: "status_updated",
      id: updated.rows[0].id as string,
      status: updated.rows[0].status as import("./requirement.repo").RequirementStatus,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
