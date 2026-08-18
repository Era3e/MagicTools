import { createHash, randomUUID } from "node:crypto";

export function idempotencyKey(prefix: string): string {
  return prefix + "-" + randomUUID();
}

export function contentFingerprint(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 32);
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
