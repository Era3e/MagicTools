import { tokens } from "./tokens";

/**
 * MtStatusTag — v2 状态标签（ui-spec §四 · status-tag.json 契约）。
 * 低饱和语义底（50 阶）+ 深阶文字（700 阶），高 22px，禁用 AntD 预设色；
 * 意图/计数类内容用等宽小字号；solid 变体供看板高强调。
 */
export type MtStatusTagTone =
  | "neutral"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "accent";

export interface MtStatusTagProps {
  tone?: MtStatusTagTone;
  emphasis?: "soft" | "solid";
  mono?: boolean;
  count?: boolean;
  showDot?: boolean;
  onClick?: () => void;
  title?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const SEMANTIC_BG_FG: Record<MtStatusTagTone, { bg: string; fg: string }> = {
  neutral: { bg: tokens.scale.graphite[1], fg: tokens.scale.graphite[6] },
  success: { bg: tokens.scale.success[0], fg: tokens.scale.success[7] },
  warning: { bg: tokens.scale.warning[0], fg: tokens.scale.warning[7] },
  error: { bg: tokens.scale.error[0], fg: tokens.scale.error[7] },
  info: { bg: tokens.scale.info[0], fg: tokens.scale.info[7] },
  accent: { bg: tokens.scale.amber[0], fg: tokens.scale.amber[7] },
};

const DOT_COLOR: Record<MtStatusTagTone, string> = {
  neutral: tokens.scale.graphite[4],
  success: tokens.color.success,
  warning: tokens.color.warning,
  error: tokens.color.error,
  info: tokens.color.info,
  accent: tokens.scale.amber[5],
};

/** 意图标签默认色：ink-50 底 + ink-700 字（status-tag.json 契约 Intent tag 变体） */
const INTENT_BG_FG = { bg: tokens.scale.ink[0], fg: tokens.scale.ink[7] };

export function MtStatusTag(props: MtStatusTagProps) {
  const {
    tone = "neutral",
    emphasis = "soft",
    mono = false,
    count = false,
    showDot = false,
    onClick,
    title,
    style,
    children,
  } = props;

  const isSolid = emphasis === "solid";
  const palette = mono && !isSolid ? INTENT_BG_FG : (SEMANTIC_BG_FG[tone] ?? SEMANTIC_BG_FG.neutral);
  const bg = isSolid ? tokens.tagSolid.bg : palette.bg;
  const fg = isSolid ? tokens.tagSolid.fg : palette.fg;
  const dotColor = isSolid ? tokens.tagSolid.dot : DOT_COLOR[tone] ?? DOT_COLOR.neutral;

  return (
    <span
      title={title}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 22,
        padding: count ? "0 8px" : "0 8px",
        borderRadius: tokens.radiusTokens.sm,
        backgroundColor: bg,
        color: fg,
        fontFamily: mono ? tokens.font.mono : tokens.font.body,
        fontSize: mono ? 11 : 12,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: mono ? "0.02em" : undefined,
        minWidth: count ? 24 : undefined,
        textAlign: count ? "center" : undefined,
        whiteSpace: "nowrap",
        boxSizing: "border-box",
        cursor: onClick ? "pointer" : undefined,
        ...(showDot ? {} : {}),
        ...style,
      }}
    >
      {showDot ? (
        <span
          data-mt-tag-dot
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: dotColor,
            flexShrink: 0,
          }}
        />
      ) : null}
      {children}
    </span>
  );
}
