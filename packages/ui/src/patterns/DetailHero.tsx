import React from "react";
import { Row, Col } from "antd";
import { tokens } from "../tokens";

/**
 * 页面模式 · DetailHero（详情页首屏 Hero 骨架：面包屑 + 标题 + 元信息 + 操作按钮）
 *
 * 适用场景：
 *   - manager RequirementDetail 飞行日志
 *   - applicant PositionDetail 机会档案
 *   - investigator SurveyDetail / assessor RequestDetail
 *   - scholar EntryDetail（未来如做详情页）
 *
 * 特点：
 *   - 结构稳定：Breadcrumb → Title/Tag → Meta 行 → Actions 行
 *   - Meta 行按配置列数（默认 4）自动 grid，移动端变 2 列，避免窄屏横向溢出
 *   - 操作按钮分 PrimaryActions（主操作，左对齐加粗）+ SecondaryActions（次操作，右对齐次级按钮）
 */
export interface DetailHeroMetaItem {
  /** 元信息标签 */
  label: React.ReactNode;
  /** 元信息值 */
  value: React.ReactNode;
  /** 可选：值的强调样式（normal / success / warning / error / primary） */
  tone?: "normal" | "success" | "warning" | "error" | "primary";
}

export interface DetailHeroProps {
  /** 面包屑 slot（<Breadcrumb items={[...]} />，AntD Breadcrumb 直接传） */
  breadcrumb?: React.ReactNode;
  /** 详情标题（大号粗体） */
  title: React.ReactNode;
  /** 标题右侧徽章区（状态 Tag / 优先级 Tag / 自定义徽标组件；左到右排列） */
  badges?: React.ReactNode;
  /** 元信息 key-value 行 */
  metaItems: DetailHeroMetaItem[];
  /** 每行元信息列数（>=1280 宽度下），默认 4；<=992 自动变 2；<=576 自动变 1 */
  metaColumns?: 3 | 4 | 5;
  /** 主操作按钮区（左下）：新建、通过、推送 等高优操作 */
  primaryActions?: React.ReactNode;
  /** 次操作按钮区（右下）：返回、删除、导出 等次级操作 */
  secondaryActions?: React.ReactNode;
}

function toneColor(tone: DetailHeroMetaItem["tone"], colors: typeof tokens.color) {
  switch (tone) {
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    case "error":
      return colors.error;
    case "primary":
      return colors.primary;
    case "normal":
    default:
      return colors.text;
  }
}

const DetailHero: React.FC<DetailHeroProps> = ({
  breadcrumb,
  title,
  badges,
  metaItems,
  metaColumns = 4,
  primaryActions,
  secondaryActions,
}) => {
  const { color, spacing, fontSize, radius } = tokens;

  // 按 AntD 栅格：24 份 / cols = span
  const colXl = 24 / metaColumns; // >=1200 按配置
  const colMd = metaColumns >= 4 ? 12 : 8; // ≤992 变 2/3 列
  const colSm = 24; // ≤576 1 列

  return (
    <section
      style={{
        background: color.bgContainer,
        border: `1px solid ${color.border}`,
        borderRadius: radius,
        padding: `${spacing.lg}px ${spacing.lg}px`,
        marginBottom: spacing.lg,
        boxSizing: "border-box",
      }}
    >
      {/* ---------- 面包屑 ---------- */}
      {breadcrumb && (
        <div style={{ marginBottom: spacing.md }}>{breadcrumb}</div>
      )}

      {/* ---------- 标题 + 徽章 ---------- */}
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
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.3,
            color: color.text,
            letterSpacing: "-0.01em",
            flex: "1 1 280px",
            minWidth: 240,
          }}
        >
          {title}
        </h1>
        {badges && (
          <div
            style={{
              display: "flex",
              gap: spacing.xs,
              flexWrap: "wrap",
              alignItems: "center",
              flex: "0 1 auto",
            }}
          >
            {badges}
          </div>
        )}
      </div>

      {/* ---------- 元信息区 ---------- */}
      {metaItems && metaItems.length > 0 && (
        <div
          style={{
            background: color.bgNeutral,
            borderTop: `1px solid ${color.border}`,
            borderBottom: `1px solid ${color.border}`,
            padding: `${spacing.md}px 0`,
            marginBottom: spacing.md,
            borderRadius: radius,
          }}
        >
          <Row gutter={[spacing.lg, spacing.md]} style={{ margin: 0, padding: `0 ${spacing.md}px` }}>
            {metaItems.map((item, i) => (
              <Col
                key={i}
                xl={colXl}
                lg={colXl}
                md={colMd}
                sm={colSm}
                xs={colSm}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.xs,
                  }}
                >
                  <span
                    style={{
                      fontSize: fontSize.sm,
                      color: color.textSecondary,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: fontSize.lg,
                      color: toneColor(item.tone, color),
                      fontWeight:
                        item.tone && item.tone !== "normal" ? 600 : 500,
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                    }}
                  >
                    {item.value ?? <span style={{ color: color.textSecondary }}>—</span>}
                  </span>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* ---------- 操作按钮区 ---------- */}
      {(primaryActions || secondaryActions) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: spacing.sm,
          }}
        >
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {primaryActions}
          </div>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {secondaryActions}
          </div>
        </div>
      )}
    </section>
  );
};

export { DetailHero };
