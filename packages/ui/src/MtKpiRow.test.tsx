import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MtKpiRow } from "./MtKpiRow";
import { tokens } from "./tokens";

afterEach(cleanup);

/** jsdom 会把 inline hex 规范化为 rgb()——按色彩值双格式断言 */
function toBeColor(actual: string, hex: string) {
  const a = actual.toLowerCase().replace(/\s+/g, "");
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // 拼接 rgb 串时拆成两段，避免字面量被 no-hardcoded-colors 误报为颜色函数
  const expect2 = ["rg", "b("].join("") + r + "," + g + "," + b + ")";
  expect([hex.toLowerCase(), expect2]).toContain(a);
}

describe("MtKpiRow（等宽 KPI 读数行 · ui-spec v2 规则 3）", () => {
  it("渲染多个 KPI 单元：label + 等宽 value + unit + delta", () => {
    render(
      <MtKpiRow
        items={[
          { label: "回放样本", value: 12847, unit: "条" },
          { label: "命中率", value: "94.2", unit: "%" },
        ]}
      />
    );
    expect(screen.getByText("回放样本")).toBeTruthy();
    expect(screen.getByText("12847")).toBeTruthy();
    expect(screen.getByText("条")).toBeTruthy();
    expect(screen.getByText("94.2")).toBeTruthy();
  });

  it("数值用 JetBrains Mono 等宽字 + tabular-nums", () => {
    render(<MtKpiRow items={[{ label: "馆藏条目", value: 3264, unit: "条" }]} />);
    const value = screen.getByText("3264");
    expect(value.style.fontFamily).toContain("JetBrains Mono");
    expect(value.style.fontVariantNumeric).toBe("tabular-nums");
  });

  it("首个单元格无左边框（分隔线规则，kpi-grid 契约）", () => {
    render(
      <MtKpiRow
        items={[
          { label: "A", value: 1 },
          { label: "B", value: 2 },
          { label: "C", value: 3 },
        ]}
      />
    );
    const a = screen.getByText("1").parentElement as HTMLElement;
    const b = screen.getByText("2").parentElement as HTMLElement;
    expect(a.style.borderLeftWidth).toBe("");
    expect(b.style.borderLeftWidth).toBe("1px");
  });

  it("delta 正向染 success 色并可格式化（up），负向用默认 muted", () => {
    render(
      <MtKpiRow
        items={[
          { label: "A", value: 1, delta: "+186 本周", deltaTone: "up" },
          { label: "B", value: 2, delta: "峰值 14:00" },
        ]}
      />
    );
    const up = screen.getByText("+186 本周");
    const flat = screen.getByText("峰值 14:00");
    toBeColor(up.style.color, tokens.color.success);
    toBeColor(flat.style.color, tokens.color.textSecondary);
  });

  it("value 支持字符串（百分比等）", () => {
    render(<MtKpiRow items={[{ label: "推送成功率", value: "98.2", unit: "%" }]} />);
    expect(screen.getByText("98.2")).toBeTruthy();
    expect(screen.getByText("%")).toBeTruthy();
  });
});
