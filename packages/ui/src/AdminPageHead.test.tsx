import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AdminPageHead } from "./AdminPageHead";
import { tokens } from "./tokens";

afterEach(cleanup);

describe("AdminPageHead（页面头模式 · UIKit page-head 契约）", () => {
  it("渲染 eyebrow / 标题 / 状态徽章 slot / 说明行", () => {
    render(
      <AdminPageHead
        eyebrow="ADMIN CONSOLE · 交付驾驶舱"
        title="需求管理"
        badges={<span>运行正常</span>}
        description="今日读数 · 更新于 09:00"
      />
    );
    expect(screen.getByText("ADMIN CONSOLE · 交付驾驶舱")).toBeTruthy();
    expect(screen.getByText("需求管理")).toBeTruthy();
    expect(screen.getByText("运行正常")).toBeTruthy();
    expect(screen.getByText("今日读数 · 更新于 09:00")).toBeTruthy();
  });

  it("eyebrow 用等宽小字 + 弱化色（识别度信号）", () => {
    render(<AdminPageHead eyebrow="ADMIN CONSOLE" title="T" />);
    const eyebrow = screen.getByText("ADMIN CONSOLE");
    expect(eyebrow.style.fontFamily).toContain("JetBrains Mono");
    expect(eyebrow.style.fontSize).toBe("11px");
    expect(eyebrow.style.letterSpacing).toBeTruthy();
  });

  it("标题用衬线展示字体 + 大字号（UIKit mt-h1 口径）", () => {
    render(<AdminPageHead eyebrow="E" title="需求管理" />);
    const title = screen.getByText("需求管理");
    expect(title.style.fontFamily).toContain("Noto Serif SC");
    expect(parseInt(title.style.fontSize, 10)).toBeGreaterThanOrEqual(24);
  });

  it("kpi slot 渲染在标题行下方（与 MtKpiRow 组合）", () => {
    render(
      <AdminPageHead
        eyebrow="E"
        title="T"
        kpi={<div data-testid="kpi-slot">KPI</div>}
      />
    );
    expect(screen.getByTestId("kpi-slot")).toBeTruthy();
  });

  it("actions slot 渲染在标题行右侧", () => {
    render(
      <AdminPageHead
        eyebrow="E"
        title="T"
        actions={<button>新建</button>}
      />
    );
    expect(screen.getByText("新建")).toBeTruthy();
  });

  it("底部细分隔线（发丝线，结束页面头区域）", () => {
    const { container } = render(<AdminPageHead eyebrow="E" title="T" />);
    const head = container.firstElementChild as HTMLElement;
    expect(head.style.borderBottom).toContain(tokens.craft.hairline);
  });
});
