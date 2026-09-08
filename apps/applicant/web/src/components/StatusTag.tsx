import { MtStatusTag, type MtStatusTagTone } from "@mt/ui";
import { POSITION_STATUSES, POSITION_STATUS_TONE } from "../status";

export function StatusTag(props: { status: string }) {
  const item = POSITION_STATUSES.find((s) => s.value === props.status);
  const tone: MtStatusTagTone = POSITION_STATUS_TONE[props.status] ?? "neutral";
  return <MtStatusTag tone={tone}>{item?.label ?? props.status}</MtStatusTag>;
}
