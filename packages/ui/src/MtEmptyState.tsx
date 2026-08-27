import { Button, Empty } from "antd";

export function MtEmptyState(props: {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <Empty description={props.description ?? props.title}>
      {props.actionText && props.onAction ? (
        <Button type="primary" onClick={props.onAction}>
          {props.actionText}
        </Button>
      ) : null}
    </Empty>
  );
}
