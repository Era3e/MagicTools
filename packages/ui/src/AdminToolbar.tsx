import type { ReactNode } from "react";
import { tokens } from "./tokens";

/**
 * AdminToolbar — 后台工具栏行模式（设计稿 as-toolbar/pg-toolbar 契约）。
 * surface-1 卡 + 34px 控件高度 + mono 分组标签 + 弹性占位 + 尾部动作区。
 * 与 AdminPageHead（页头）/ Table（直铺画布）组成后台页三段式版式。
 */
export interface AdminToolbarProps {
  children: ReactNode;
  /** 工具栏右上角动作区（如重置按钮） */
  extra?: ReactNode;
  style?: React.CSSProperties;
}

export function AdminToolbar(props: AdminToolbarProps) {
  const { children, extra, style } = props;
  return (
    <div
      data-testid="admin-toolbar"
      className="mt-admin-toolbar"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: tokens.spacing.md,
        padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
        background: tokens.dark.surface1,
        border: `1px solid ${tokens.dark.hairline}`,
        borderRadius: tokens.radiusTokens.md,
        boxShadow: tokens.shadow.darkCard,
        marginBottom: tokens.spacing.md,
        ...style,
      }}
    >
      {children}
      <span style={{ flex: "1 1 auto" }} />
      {extra}
    </div>
  );
}

/** 工具栏内 mono 分组标签（「状态」「优先级」等，置于 Select 之前） */
export function AdminToolbarLabel(props: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: tokens.font.mono,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: tokens.dark.textFaint,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </span>
  );
}

/** 工具栏右侧 mono 读数（共 N 条 · 第 x/y 页） */
export function AdminToolbarCount(props: { children: ReactNode }) {
  return (
    <span
      data-testid="toolbar-count"
      style={{
        fontFamily: tokens.font.mono,
        fontSize: 12,
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        color: tokens.dark.textTertiary,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </span>
  );
}
