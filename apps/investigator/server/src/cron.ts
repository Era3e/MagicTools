import cron from "node-cron";

export function isValidCron(expr: string): boolean {
  if (!expr) return false;
  try {
    return cron.validate(expr);
  } catch {
    return false;
  }
}
