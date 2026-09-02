import React from "react";
import { Divider } from "antd";
import { tokens } from "../tokens";
import { MtEmptyState } from "../MtEmptyState";

/**
 * 页面模式 · ControlTable（后台控制台风表格管理骨架）
 *
 * 适用场景：
 *   - 全部 8 应用后台列表（PositionList / SourceList / SurveyList / RequestList / RequirementList / ComponentList / FeedbackList / IntentLogList）
 *   - 任何「标题 + 操作按钮组 + 筛选条 + 表格 + 分页」的 CRUD 管理页
 *
 * 特点：
 *   - 严格遵循 AdminShell 信息架构一致性，禁止每个应用后台自定义不同头部
 *   - 布局分层：TitleBar（左标题+说明 / 右操作） → Toolbar（筛选） → Table Slot → Pagination Slot
 *   - 操作按钮语义化：新建按钮放右上，筛选放左上，避免不同应用按钮位置跳来跳去
 */
export interface ControlTableProps {
  /** 页面标题（大字号标题） */
  title: React.ReactNode;
  /** 标题下的功能说明文字（一行小字，如「管理岗位信息，支持新增、编辑、删除」） */
  description?: React.ReactNode;
  /** 右上角主要操作按钮区：一般放「新增 + 批量操作」按钮组 */
  actions?: React.ReactNode;
  /** 筛选条 slot：查询条件（Input / Select / RangePicker + 查询/重置按钮），左对齐排布 */
  toolbar?: React.ReactNode;
  /** 表格 + 分页 slot：直接填 <Table /> + <Pagination />，或自定义列表；外部负责数据绑定 */
  children?: React.ReactNode;
  /** 空数据配置：无数据时在表格区域展示 MtEmptyState（如 children 也为空） */
  empty?: {
    title: string;
    description?: string;
    actionText?: string;
    onAction?: () => void;
  };
}

const ControlTable: React.FC<ControlTableProps> = ({
  title,
  description,
  actions,
  toolbar,
  children,
  empty,
}) => {
  const { color, spacing, fontSize, radius } = tokens;
  const hasTableContent = !empty || (children && React.Children.count(children) > 0);

  return (
    <div
      style={{
        padding: `${spacing.lg}px ${spacing.lg}px`,
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {/* ---------- TitleBar：标题 + 操作按钮 ---------- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: spacing.md,
          flexWrap: "wrap",
          marginBottom: spacing.md,
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              lineHeight: 1.4,
              color: color.text,
            }}
          >
            {title}
          </h2>
          {description && (
            <div
              style={{
                marginTop: spacing.xs,
                fontSize: fontSize.sm,
                color: color.textSecondary,
                lineHeight: 1.6,
              }}
            >
              {description}
            </div>
          )}
        </div>
        {actions && (
          <div
            style={{
              display: "flex",
              gap: spacing.sm,
              alignItems: "center",
              flex: "0 1 auto",
              flexWrap: "wrap",
            }}
          >
            {actions}
          </div>
        )}
      </div>

      {/* ---------- Toolbar：筛选条 ---------- */}
      {toolbar && (
        <div
          style={{
            background: color.bgContainer,
            border: `1px solid ${color.border}`,
            borderRadius: radius,
            padding: `${spacing.md}px ${spacing.md}px`,
            marginBottom: spacing.md,
            display: "flex",
            flexWrap: "wrap",
            gap: spacing.sm,
            alignItems: "center",
            justifyContent: "flex-start",
            boxSizing: "border-box",
          }}
        >
          {toolbar}
        </div>
      )}

      <Divider style={{ margin: `0 0 ${spacing.md}px` }} />

      {/* ---------- 主体：Table / Empty ---------- */}
      <div
        style={{
          background: color.bgContainer,
          borderRadius: radius,
          border: `1px solid ${color.border}`,
          padding: spacing.md,
          boxShadow: tokens.shadow.card,
          boxSizing: "border-box",
        }}
      >
        {!hasTableContent && empty ? (
          <div style={{ padding: `${spacing.xl}px 0` }}>
            <MtEmptyState
              title={empty.title}
              description={empty.description}
              actionText={empty.actionText}
              onAction={empty.onAction}
            />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export { ControlTable };
