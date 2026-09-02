import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { theme as antdTheme } from "antd";
import { AdminShell } from "./AdminShell";

// antd Layout.Sider 依赖 matchMedia，jsdom 需 polyfill
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** 探针组件：验证 AdminShell 内部 AntD 组件实际生效的暗色 token */
function DarkTokenProbe() {
  const { token } = antdTheme.useToken();
  return (
    <div
      data-testid="dark-probe"
      data-primary={String(token.colorPrimary)}
      data-bg-container={String(token.colorBgContainer)}
      data-bg-layout={String(token.colorBgLayout)}
      data-bg-elevated={String(token.colorBgElevated)}
      data-text={String(token.colorText)}
      data-border={String(token.colorBorder)}
    />
  );
}

describe("AdminShell（v2 石墨深色控制台）", () => {
  it("侧栏为石墨深色（v2.1 质感升级渐变）", () => {
    const { container } = render(
      <AdminShell
        title="采集"
        navItems={[{ key: "/admin/sources", label: "信息源管理" }]}
        selectedKey="/admin/sources"
        onNavigate={() => {}}
      >
        <div>内容区</div>
      </AdminShell>
    );
    const sider = container.querySelector(".ant-layout-sider");
    expect(sider).toBeTruthy();
    // v2.1 质感层：侧栏为更深纵向渐变（siderGrad #161b24→#0e1218）
    const siderBg = (sider as HTMLElement).style.background.toLowerCase();
    const isGraphite =
      siderBg.startsWith("linear-gradient(180deg, #161b24") ||
      ["#0e1218", "rgb(14, 18, 24)"].includes(siderBg);
    expect(isGraphite).toBe(true);
    expect(screen.getByText("信息源管理")).toBeTruthy();
  });

  it("内容区注入暗色 AntD 令牌（暗色为一等公民）", () => {
    render(
      <AdminShell
        title="采集"
        navItems={[{ key: "/admin/sources", label: "信息源管理" }]}
        selectedKey="/admin/sources"
        onNavigate={() => {}}
      >
        <DarkTokenProbe />
      </AdminShell>
    );
    const probe = screen.getByTestId("dark-probe");
    // v2.1 四级表面阶梯：画布 #0e1218 / 卡片 #181d26 / 抬起 #252e3b / 边框 #2a3340
    const darkPrimary = probe.getAttribute("data-primary");
    expect(["#6e8bad", "#617996"]).toContain(darkPrimary);
    expect(darkPrimary).not.toBe("#2c4a6e");
    expect(darkPrimary).not.toBe("#1677ff");
    expect(probe.getAttribute("data-bg-container")).toBe("#181d26");
    expect(probe.getAttribute("data-bg-layout")).toBe("#0e1218");
    expect(probe.getAttribute("data-bg-elevated")).toBe("#252e3b");
    expect(probe.getAttribute("data-text")).toBe("#dde4ec");
    expect(probe.getAttribute("data-border")).toBe("#2a3340");
  });

  it("点击导航触发回调；frontPath 存在时渲染返回前台入口", () => {
    const onNavigate = vi.fn();
    render(
      <AdminShell
        title="求职"
        navItems={[
          { key: "/admin/positions", label: "岗位管理" },
          { key: "/admin/resumes", label: "简历管理" },
        ]}
        selectedKey="/admin/positions"
        onNavigate={onNavigate}
        frontPath="/positions"
      >
        <div>内容区</div>
      </AdminShell>
    );
    fireEvent.click(screen.getByText("简历管理"));
    expect(onNavigate).toHaveBeenCalledWith("/admin/resumes");
    expect(screen.getByText(/返回前台/)).toBeTruthy();
  });
});
