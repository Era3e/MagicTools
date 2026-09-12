import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateHeaderName, validateHeaderValue } from "node:http";

const OPERATIONS = ["create", "verify", "restore", "prune", "ssh"];
const STAGES = ["preflight", "physical-backup", "restore-validation", "encrypt", "cleanup", "decrypt", "physical-validation", "database-startup", "retention", "unlock", "receipt", "ssh-prepare", "ssh-create", "ssh-download", "ssh-verify", "ssh-export", "ssh-cleanup"];

function failureEvent(input) {
  const operation = OPERATIONS.includes(input.operation) ? input.operation : "unknown";
  return { schema: "magictools-backup-failure/1", event: "backup.failed", eventId: randomBytes(8).toString("hex"),
    operation, operationId: /^[a-f0-9]{16}$/.test(input.operationId) ? input.operationId : randomBytes(8).toString("hex"),
    backupId: /^[a-f0-9]{16}$/.test(input.backupId) ? input.backupId : null,
    stage: STAGES.includes(input.stage) ? input.stage : "unknown", errorCode: operation === "prune" ? "BACKUP_RETENTION_FAILED" : "BACKUP_OPERATION_FAILED",
    occurredAt: new Date().toISOString() };
}

export function validateBackupAlertConfiguration(configuration) {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) return { status: "configuration-failed", code: "INVALID_CONFIGURATION" };
  let url;
  try { url = new URL(configuration.url); } catch { return { status: "configuration-failed", code: "INVALID_URL" }; }
  if (configuration.schema !== "magictools-backup-alert/1" || configuration.type !== "webhook" || !["http:", "https:"].includes(url.protocol) || url.username || url.password) return { status: "configuration-failed", code: "INVALID_CONFIGURATION" };
  const timeout = configuration.timeoutMilliseconds ?? 5000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60000) return { status: "configuration-failed", code: "INVALID_TIMEOUT" };
  const headers = configuration.headers ?? {};
  const forbidden = ["host", "content-length", "transfer-encoding", "connection", "upgrade", "expect", "trailer", "te", "proxy-authorization", "proxy-connection", "content-type"];
  try {
    if (typeof headers !== "object" || headers === null || Array.isArray(headers)) throw new Error();
    const seen = new Set();
    for (const [name, value] of Object.entries(headers)) {
      validateHeaderName(name); validateHeaderValue(name, value);
      if (typeof value !== "string" || forbidden.includes(name.toLowerCase()) || seen.has(name.toLowerCase())) throw new Error();
      seen.add(name.toLowerCase());
    }
  } catch { return { status: "configuration-failed", code: "INVALID_HEADERS" }; }
  return null;
}

export async function deliverBackupFailure(event, configuration) {
  if (configuration === undefined) return { status: "not-configured" };
  const invalid = validateBackupAlertConfiguration(configuration);
  if (invalid) return invalid;
  try {
    const response = await fetch(configuration.url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(configuration.timeoutMilliseconds ?? 5000),
      headers: { ...configuration.headers, "content-type": "application/json" },
      body: JSON.stringify({ text: "MagicTools备份失败：" + event.operation + " / " + event.stage + " / " + event.operationId, event }) });
    await response.body?.cancel();
    return response.ok ? { status: "accepted", httpStatus: response.status } : { status: "failed", code: "HTTP_REJECTED", httpStatus: response.status };
  } catch { return { status: "failed", code: "TRANSPORT_FAILED" }; }
}

export async function recordBackupFailure(input) {
  const event = failureEvent(input); const root = resolve(input.directory);
  const eventFile = join(root, event.eventId + ".event.json"); const deliveryFile = join(root, event.eventId + ".delivery.json");
  const persistence = { event: "pending", delivery: "pending" };
  try { mkdirSync(root, { recursive: true, mode: 0o700 }); writeFileSync(eventFile, JSON.stringify(event, null, 2) + "\n", { flag: "wx", mode: 0o600 }); persistence.event = "written"; }
  catch { persistence.event = "failed"; }
  const notification = await deliverBackupFailure(event, input.configuration);
  try { writeFileSync(deliveryFile, JSON.stringify({ schema: "magictools-backup-alert-delivery/1", eventId: event.eventId, notification, attemptedAt: new Date().toISOString() }, null, 2) + "\n", { flag: "wx", mode: 0o600 }); persistence.delivery = "written"; }
  catch { persistence.delivery = "failed"; }
  return { eventId: event.eventId, operationId: event.operationId, eventFile: persistence.event === "written" ? eventFile : null,
    deliveryFile: persistence.delivery === "written" ? deliveryFile : null, persistence, notification };
}
