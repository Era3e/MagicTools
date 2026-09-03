import { Button } from "antd";
import { tokens } from "./tokens";

/**
 * MtEmptyState — v2 品牌化空态。
 * 弃用 AntD 默认简笔画插画（ui-spec v2 强制规则 6），
 * 改为「EMPTY」等宽字符印记 + 衬线主文案 + 引导操作。
 */
export function MtEmptyState(props: {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: `${tokens.spacing.xl * 2}px ${tokens.spacing.lg}px`,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.mono,
          fontSize: 11,
          letterSpacing: 3,
          color: tokens.color.textSecondary,
          textTransform: "uppercase",
          marginBottom: tokens.spacing.sm,
        }}
      >
        EMPTY
      </div>
      <div
        style={{
          fontFamily: tokens.font.display,
          fontSize: 16,
          fontWeight: 600,
          color: tokens.color.text,
          marginBottom: tokens.spacing.xs,
        }}
      >
        {props.title}
      </div>
      {props.description ? (
        <div style={{ fontSize: 13, color: tokens.color.textSecondary, marginBottom: tokens.spacing.md }}>
          {props.description}
        </div>
      ) : (
        <div style={{ height: tokens.spacing.md }} />
      )}
      {props.actionText && props.onAction ? (
        <Button type="primary" onClick={props.onAction}>
          {props.actionText}
        </Button>
      ) : null}
    </div>
  );
}
