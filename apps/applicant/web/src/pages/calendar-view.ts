import type { InterviewWithPosition, Position } from "../api";

export type EventKind = "applied" | "scheduled" | "interviewed";

export interface TimelineNode {
  ymd: string;
  kind: EventKind;
  dday: number;
  title: string;
  org: string;
  company: string;
  positionId: string;
}

export interface FollowUpItem {
  position: Position;
  days: number;
}

export interface CalendarKpi {
  active: number;
  inInterview: number;
  upcoming7d: number;
  followUp: number;
  windowDays: number | null;
  closedThisMonth: number;
}

export const FOLLOW_UP_DAYS = 7;
const DAY_MS = 86_400_000;
const pad2 = (n: number) => String(n).padStart(2, "0");

export const ymdOf = (iso: string) => iso.slice(0, 10);
export const todayYmd = () => new Date().toISOString().slice(0, 10);
export const diffDays = (fromYmd: string, toYmd: string) =>
  Math.round((Date.parse(toYmd) - Date.parse(fromYmd)) / DAY_MS);

const CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

export function cnNum(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n >= 100) return String(n);
  if (n < 10) return CN_DIGITS[n];
  const tens = Math.floor(n / 10) === 1 ? "十" : CN_DIGITS[Math.floor(n / 10)] + "十";
  const ones = n % 10;
  return ones === 0 ? tens : tens + CN_DIGITS[ones];
}

const localMdHm = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const localMd = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export function buildTimeline(
  positions: Position[],
  interviews: InterviewWithPosition[],
  today = todayYmd()
): TimelineNode[] {
  const nodes: TimelineNode[] = [];
  for (const p of positions) {
    if (!p.appliedAt) continue;
    const day = ymdOf(p.appliedAt);
    nodes.push({
      ymd: day,
      kind: "applied",
      dday: diffDays(today, day),
      title: `${p.title} · 投递`,
      org: `${p.company} · ${localMd(p.appliedAt)}`,
      company: p.company,
      positionId: p.id,
    });
  }
  for (const i of interviews) {
    const day = ymdOf(i.happenedAt);
    nodes.push({
      ymd: day,
      kind: i.status === "scheduled" ? "scheduled" : "interviewed",
      dday: diffDays(today, day),
      title: `${i.title} · 第${i.round}面`,
      org: `${i.company} · ${localMdHm(i.happenedAt)}`,
      company: i.company,
      positionId: i.positionId,
    });
  }
  const upcoming = nodes.filter((n) => n.dday >= 0).sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
  const past = nodes.filter((n) => n.dday < 0).sort((a, b) => (a.ymd > b.ymd ? -1 : 1));
  return [...upcoming, ...past];
}

export function buildFollowUps(
  positions: Position[],
  interviews: InterviewWithPosition[],
  today = todayYmd()
): FollowUpItem[] {
  return positions
    .filter((p) => {
      if (!p.appliedAt || p.status !== "applied") return false;
      if (diffDays(ymdOf(p.appliedAt), today) <= FOLLOW_UP_DAYS) return false;
      return !interviews.some((i) => i.positionId === p.id);
    })
    .map((p) => ({ position: p, days: diffDays(ymdOf(p.appliedAt!), today) }))
    .sort((a, b) => b.days - a.days);
}

export function computeKpi(
  positions: Position[],
  interviews: InterviewWithPosition[],
  today = todayYmd()
): CalendarKpi {
  const active = positions.filter((p) => ["applied", "written", "interview"].includes(p.status)).length;
  const inInterview = positions.filter((p) => p.status === "interview").length;
  const nodes = buildTimeline(positions, interviews, today);
  const upcoming = nodes.filter((n) => n.dday >= 0);
  const upcoming7d = upcoming.filter((n) => n.kind === "scheduled" && n.dday <= 7).length;
  const followUp = buildFollowUps(positions, interviews, today).length;
  const windowDays = upcoming.length ? Math.max(...upcoming.map((n) => n.dday)) : null;
  const monthPrefix = today.slice(0, 7);
  const closedThisMonth = nodes.filter((n) => n.kind === "interviewed" && n.ymd.startsWith(monthPrefix)).length;
  return { active, inInterview, upcoming7d, followUp, windowDays, closedThisMonth };
}

export function monthMatrix(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${year}-${pad2(month + 1)}-${pad2(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const padDay = pad2;
