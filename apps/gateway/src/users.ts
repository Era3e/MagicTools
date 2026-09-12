import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export interface UserRecord {
  hash: string;
  role: "admin" | "user";
}

export function parseUsers(raw: string | undefined): Map<string, UserRecord> {
  const users = new Map<string, UserRecord>();
  if (!raw) return users;
  for (const entry of raw.split(",")) {
    const parts = entry.split(":");
    if (parts.length < 2) continue;
    const name = parts[0].trim();
    const hash = parts[1];
    if (!name || !hash) continue;
    const role: "admin" | "user" = parts.slice(2).join(":").trim() === "admin" ? "admin" : "user";
    users.set(name, { hash, role });
  }
  return users;
}

export function parseUserApps(raw: string | undefined): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!raw) return result;
  for (const entry of raw.split(";")) {
    const sep = entry.indexOf(":");
    if (sep <= 0) continue;
    const name = entry.slice(0, sep).trim();
    const apps = entry
      .slice(sep + 1)
      .split(",")
      .map((app) => app.trim())
      .filter(Boolean);
    if (!name || apps.length === 0) continue;
    result.set(name, apps);
  }
  return result;
}

export async function scryptHash(password: string, salt?: string): Promise<string> {
  const useSalt = salt ?? randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, useSalt, 32)) as Buffer;
  return `scrypt$${useSalt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hex] = parts;
  if (!/^[0-9a-f]+$/i.test(hex)) return false;
  const expected = Buffer.from(hex, "hex");
  if (expected.length === 0) return false;
  let derived: Buffer;
  try {
    derived = (await scryptAsync(password, salt, expected.length)) as Buffer;
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

interface ThrottleState {
  failures: number;
  lockedUntil: number;
}

export class LoginThrottle {
  private readonly states = new Map<string, ThrottleState>();

  constructor(
    private readonly maxFailures: number,
    private readonly lockMs: number
  ) {}

  isLocked(user: string, now: number): boolean {
    const state = this.states.get(user);
    if (!state) return false;
    if (state.lockedUntil > now) return true;
    if (state.lockedUntil !== 0 && state.lockedUntil <= now) this.states.delete(user);
    return false;
  }

  recordFailure(user: string, now: number): void {
    const state = this.states.get(user) ?? { failures: 0, lockedUntil: 0 };
    state.failures += 1;
    if (state.failures >= this.maxFailures) {
      state.lockedUntil = now + this.lockMs;
      state.failures = 0;
    }
    this.states.set(user, state);
  }

  recordSuccess(user: string): void {
    this.states.delete(user);
  }
}
