import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "mt_session";

export interface SessionPayload {
  user: string;
  role: "admin" | "user";
  iat: number;
  exp: number;
}

export interface VerifiedSession extends SessionPayload {
  needsRefresh(now: number, ttlMs: number): boolean;
}

const b64url = (input: string): string => Buffer.from(input, "utf8").toString("base64url");
const fromB64url = (input: string): string => Buffer.from(input, "base64url").toString("utf8");

function hmac(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function signSession(
  base: { user: string; role: "admin" | "user" },
  secret: string,
  issuedAt: number,
  ttlMs: number
): string {
  const payload: SessionPayload = { ...base, iat: issuedAt, exp: issuedAt + ttlMs };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${hmac(payloadB64, secret)}`;
}

export function verifySession(cookie: string, secret: string, now: number): VerifiedSession | null {
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = cookie.slice(0, dot);
  const signature = cookie.slice(dot + 1);
  let expected: string;
  try {
    expected = hmac(payloadB64, secret);
  } catch {
    return null;
  }
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromB64url(payloadB64)) as SessionPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.user !== "string" ||
    !payload.user ||
    (payload.role !== "admin" && payload.role !== "user") ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number" ||
    payload.exp <= now
  ) {
    return null;
  }
  return {
    ...payload,
    needsRefresh: (at: number, ttlMs: number) => at >= payload.exp - ttlMs / 3,
  };
}
