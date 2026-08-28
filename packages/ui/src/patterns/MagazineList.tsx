import React from "react";
import { Row, Col, Divider } from "antd";
import { tokens } from "../tokens";
import { MtEmptyState } from "../MtEmptyState";

/**
 * 页面模式 · MagazineList（杂志风前台消费型列表骨架）
 *
 * 适用场景：
 *   - applicant PositionWall（岗位博览墙）
 *   - scholar SearchPage 书目检索结果
 *   - designer Gallery / ComponentList 等前台展示栅格
 *   - 任何「标题头 + 筛选条 + 栅格卡片 + 分页」的消费型页面
 *
 * 特点：
 *   - 视觉层次：眉题 → 大标题 → 副标题 → 筛选条 → 卡片栅格 → 分页
 *   - 间距/字号/颜色 100% 来自 tokens，不硬编码色值
 *   - 桌面端默认 3 列栅格（可改 cols），响应式由 AntD Col 响应断点控制
 */
export interface MagazineListProps {
  /** 眉题（顶部小号说明文字，如「文化 · 第 23 期」） */
  eyebrow?: React.ReactNode;
  /** 页面主标题 */
  title: React.ReactNode;
  /** 副标题（标题下方一行说明文案） */
  subtitle?: React.ReactNode;
  /** 筛选条（右对齐区域：搜索框 / 分类选择 / Tab 切换等自定义组件） */
  filterBar?: React.ReactNode;
  /** 栅格卡片：直接填 <Col span={x}><Card>...</Card></Col> 或自定义 children */
  children?: React.ReactNode;
  /** 分页 / 底部自定义 slot（放在栅格下方居中） */
  footer?: React.ReactNode;
  /** 空数据配置：为空时自动渲染 MtEmptyState（替代 children 区域） */
  empty?: {
    title: string;
    description?: string;
    actionText?: string;
    onAction?: () => void;
  };
  /** 桌面端 (≥1280) 栅格列数，默认 3；移动端自动单列 */
  cols?: 2 | 3 | 4;
}

const MagazineList: React.FC<MagazineListProps> = ({
  eyebrow,
  title,
  subtitle,
  filterBar,
  children,
  footer,
  empty,
  cols = 3,
}) => {
  const { color, spacing, fontSize, radius } = tokens;
  const colXxl = 24 / cols; // >=1600 按 cols 等分
  const colXl = 24 / cols;
  const colMd = cols === 2 ? 12 : 12; // <=992 改 2 列
  const colSm = 24; // <=576 手机 1 列

  const hasContent = !empty || (children && React.Children.count(children) > 0);

  return (
    <div
      style={{
        padding: `${spacing.xl}px ${spacing.xl}px ${spacing.lg}px`,
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* ---------- 头部：眉题 + 标题 + 副标题 + 筛选条 ---------- */}
      <header
        style={{
          marginBottom: spacing.lg,
          display: "flex",
          flexWrap: "wrap",
          gap: spacing.md,
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          {eyebrow && (
            <div
              style={{
                fontSize: fontSize.sm,
                color: color.textSecondary,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: spacing.sm,
              }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            style={{
              margin: 0,
              fontSize: 36,
              fontWeight: 700,
              lineHeight: 1.2,
              color: color.text,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                margin: `${spacing.sm}px 0 0`,
                fontSize: fontSize.lg,
                color: color.textSecondary,
                lineHeight: 1.7,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {filterBar && (
          <div
            style={{
              flex: "0 1 auto",
              minWidth: 280,
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              justifyContent: "flex-end",
              background: color.bgContainer,
              padding: spacing.sm,
              borderRadius: radius,
              border: `1px solid ${color.border}`,
              boxSizing: "border-box",
            }}
          >
            {filterBar}
          </div>
        )}
      </header>

      <Divider style={{ margin: `${spacing.md}px 0 ${spacing.lg}px` }} />

      {/* ---------- 主体：空态 / 栅格卡片 ---------- */}
      <main>
        {!hasContent && empty ? (
          <div
            style={{
              background: color.bgContainer,
              borderRadius: radius,
              border: `1px dashed ${color.border}`,
              padding: `${spacing.xl * 2}px 0`,
            }}
          >
            <MtEmptyState
              title={empty.title}
              description={empty.description}
              actionText={empty.actionText}
              onAction={empty.onAction}
            />
          </div>
        ) : (
          <Row gutter={[spacing.lg, spacing.lg]}>
            {/* 若 children 自行包 Col，直接渲染；否则按 cols 平分宽度包一层默认 Col（兼容裸 Card 数组） */}
            {React.Children.map(children, (child) => {
              if (
                child &&
                typeof child === "object" &&
                "type" in child &&
                (child as { type?: unknown }).type === Col
              ) {
                return child;
              }
              return (
                <Col xxl={colXxl} xl={colXl} lg={colXl} md={colMd} sm={colSm} xs={colSm}>
                  {child}
                </Col>
              );
            })}
          </Row>
        )}
      </main>

      {/* ---------- 底部分页 ---------- */}
      {footer && (
        <footer
          style={{
            marginTop: spacing.xl,
            display: "flex",
            justifyContent: "center",
            paddingTop: spacing.md,
          }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
};

export { MagazineList };
