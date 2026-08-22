import { Tag } from "antd";
import { tokens } from "@mt/ui";
import { POSITION_STATUSES } from "../status";

export function StatusTag(props: { status: string }) {
  const item = POSITION_STATUSES.find((s) => s.value === props.status);
  return <Tag color={item?.color ?? tokens.color.textSecondary}>{item?.label ?? props.status}</Tag>;
}
