import { Tag } from "antd";
import { tokens } from "@mt/ui";

const MAP: Record<string, { label: string; color: string }> = {
  waiting: { label: "待投递", color: tokens.color.warning },
  applied: { label: "已投递", color: tokens.color.primary },
  written: { label: "笔试", color: "#722ed1" },
  interview: { label: "面试", color: tokens.color.success },
  offer: { label: "offer", color: "#13c2c2" },
  rejected: { label: "拒绝", color: tokens.color.error },
};

export function StatusTag(props: { status: string }) {
  const item = MAP[props.status] ?? { label: props.status, color: tokens.color.textSecondary };
  return <Tag color={item.color}>{item.label}</Tag>;
}
