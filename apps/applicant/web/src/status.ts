import type { MtStatusTagTone } from "@mt/ui";

// 岗位状态的唯一来源：value/label + v2 语义 tone（MtStatusTag 契约：底 50 阶 / 字 700 阶）
export const POSITION_STATUSES = [
  { value: "waiting", label: "待投递" },
  { value: "applied", label: "已投递" },
  { value: "written", label: "笔试" },
  { value: "interview", label: "面试" },
  { value: "offer", label: "offer" },
  { value: "rejected", label: "拒绝" },
] as const;

export const POSITION_STATUS_TONE: Record<string, MtStatusTagTone> = {
  waiting: "warning",
  applied: "info",
  written: "neutral",
  interview: "success",
  offer: "accent",
  rejected: "error",
};

export const POSITION_STATUS_OPTIONS = POSITION_STATUSES.map((s) => ({ value: s.value, label: s.label }));

export const POSITION_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  POSITION_STATUSES.map((s) => [s.value, s.label])
);
