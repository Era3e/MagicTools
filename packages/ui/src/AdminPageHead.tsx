import { tokens } from "./tokens";

/**
 * AdminPageHead — 后台页面头模式（ui_kits/dashboard page-head 契约沉淀）。
 *
 * 结构：eyebrow（等宽眉题）→ 标题行（衬线大标题 + 状态徽章 + 右侧操作）→ 说明行 → KPI slot
 * 用途：终结「Card title 当页头」的 CRUD 模板感——每个后台页拥有驾驶舱式页面级版式。
 * 颜色全部来自 tokens（AdminShell 暗色画布下由发丝线收尾，不依赖壳注入）。
 */
export interface AdminPageHeadProps {
  /** 眉题：等宽小字，如「ADMIN CONSOLE · 交付驾驶舱」 */
  eyebrow: React.ReactNode;
  /** 页面主标题（衬线展示字体） */
  title: React.ReactNode;
  /** 标题右侧状态徽章区（推荐放 MtStatusTag） */
  badges?: React.ReactNode;
  /** 标题行下的说明小字（等宽读数建议放这里） */
  description?: React.ReactNode;
  /** 标题行右侧主操作区（新建/批量按钮） */
  actions?: React.ReactNode;
  /** KPI 读数行 slot（推荐 MtKpiRow） */
  kpi?: React.ReactNode;
}

export function AdminPageHead(props: AdminPageHeadProps) {
  const { eyebrow, title, badges, description, actions, kpi } = props;
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.sm,
        paddingBottom: tokens.spacing.md,
        marginBottom: tokens.spacing.md,
        borderBottom: `1px solid ${tokens.craft.hairline}`,
        minWidth: 0,
      }}
    >
      <div style={{ fontFamily: tokens.font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.color.textSecondary }}>
        {eyebrow}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: tokens.spacing.md, flexWrap: "wrap", minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: tokens.font.display,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: tokens.font.letterSpacingHeadingSm,
            lineHeight: 1.3,
            color: "inherit",
            overflowWrap: "break-word",
          }}
        >
          {title}
        </h1>
        {badges ? <span style={{ display: "inline-flex", gap: tokens.spacing.xs, alignItems: "center" }}>{badges}</span> : null}
        {actions ? (
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: tokens.spacing.sm, alignItems: "center", flexWrap: "wrap" }}>{actions}</span>
        ) : null}
      </div>
      {description ? (
        <div style={{ fontSize: 12, color: tokens.color.textSecondary }}>{description}</div>
      ) : null}
      {kpi ? <div>{kpi}</div> : null}
    </header>
  );
}
