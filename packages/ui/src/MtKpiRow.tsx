import { tokens } from "./tokens";

/**
 * MtKpiRow — 等宽 KPI 读数行（dashboard UIKit kpi-grid 契约）。
 * 数字一律 JetBrains Mono + tabular-nums（ui-spec v2 规则 3）；
 * 单元格间以 1px 左分隔线（首格无），替代 AntD Statistic 默认观感。
 */
export interface MtKpiItem {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaTone?: "up" | "flat";
}

export interface MtKpiRowProps {
  items: MtKpiItem[];
}

export function MtKpiRow(props: MtKpiRowProps) {
  const { items } = props;
  return (
    <div
      className="mt-kpi-row"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        minWidth: 0,
      }}
    >
      {items.map((item, i) => (
        <div
          key={item.label + i}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingLeft: i === 0 ? 0 : tokens.spacing.md,
            minWidth: 0,
            borderLeft: i === 0 ? undefined : `1px solid ${tokens.color.border}`,
          }}
        >
          <span style={{ fontSize: 12, color: tokens.color.textSecondary }}>{item.label}</span>
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontWeight: 600,
              fontSize: 22,
              lineHeight: 1.2,
              color: tokens.color.text,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {item.value}
            {item.unit ? (
              <span style={{ fontSize: 12, fontWeight: 400, color: tokens.color.textSecondary, marginLeft: 2 }}>
                {item.unit}
              </span>
            ) : null}
          </span>
          {item.delta ? (
            <span
              style={{
                fontFamily: tokens.font.mono,
                fontSize: 12,
                color:
                  item.deltaTone === "up" ? tokens.color.success : tokens.color.textSecondary,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {item.delta}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
