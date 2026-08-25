import { tokens } from "@mt/ui";

// 岗位状态的唯一来源：value/label/color
export const POSITION_STATUSES = [
  { value: "waiting", label: "待投递", color: tokens.color.warning },
  { value: "applied", label: "已投递", color: tokens.color.primary },
  { value: "written", label: "笔试", color: tokens.color.purple },
  { value: "interview", label: "面试", color: tokens.color.success },
  { value: "offer", label: "offer", color: tokens.color.cyan },
  { value: "rejected", label: "拒绝", color: tokens.color.error },
] as const;

export const POSITION_STATUS_OPTIONS = POSITION_STATUSES.map((s) => ({ value: s.value, label: s.label }));

export const POSITION_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  POSITION_STATUSES.map((s) => [s.value, s.label])
);
