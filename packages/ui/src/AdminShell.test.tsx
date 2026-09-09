import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AdminShell } from "./AdminShell";

afterEach(cleanup);

// antd Drawer 依赖 matchMedia，jsdom 需 polyfill
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

describe("AdminShell（v2.3 设计稿 as-* 控制台）", () => {
  it("侧栏渲染品牌区 + 默认 ADMIN CONSOLE eyebrow（渐变底在 as-sider 类中，视觉由基线保障）", () => {
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
    const sider = container.querySelector(".as-sider");
    expect(sider).toBeTruthy();
    const brandName = container.querySelector(".as-brand-name");
    expect(brandName?.textContent).toBe("采集");
    expect(screen.getByText("ADMIN CONSOLE")).toBeTruthy();
    expect(container.querySelector(".as-nav")?.textContent).toContain("信息源管理");
  });

  it("导航激活态用琥珀左指示条（data-active）且点击触发回调", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <AdminShell
        title="求职"
        navItems={[
          { key: "/admin/positions", label: "岗位管理" },
          { key: "/admin/resumes", label: "简历管理" },
        ]}
        selectedKey="/admin/positions"
        onNavigate={onNavigate}
      >
        <div>内容区</div>
      </AdminShell>
    );
    const activeLink = container.querySelector('.as-nav a[data-active="true"]');
    expect(activeLink?.textContent).toContain("岗位管理");
    fireEvent.click(screen.getByText("简历管理"));
    expect(onNavigate).toHaveBeenCalledWith("/admin/resumes");
  });

  it("frontPath 存在时渲染返回前台入口与返回总览；eyebrow 可定制", () => {
    render(
      <AdminShell
        title="求职"
        navItems={[{ key: "/admin/positions", label: "岗位管理" }]}
        selectedKey="/admin/positions"
        onNavigate={() => {}}
        frontPath="/positions"
        eyebrow="APPLICANT · CONTROL"
      >
        <div>内容区</div>
      </AdminShell>
    );
    expect(screen.getByText(/返回前台/)).toBeTruthy();
    expect(screen.getByText(/返回总览/)).toBeTruthy();
    expect(screen.getByText("APPLICANT · CONTROL")).toBeTruthy();
    expect(screen.queryByText("ADMIN CONSOLE")).toBeNull();
  });

  it("顶栏渲染 mono 面包屑与版本胶囊", () => {
    const { container } = render(
      <AdminShell
        title="管理"
        navItems={[{ key: "/admin/requirements", label: "需求管理" }]}
        selectedKey="/admin/requirements"
        onNavigate={() => {}}
      >
        <div>内容区</div>
      </AdminShell>
    );
    const crumb = container.querySelector(".as-crumb");
    expect(crumb?.textContent).toContain("需求管理");
    expect(screen.getByText("V2.3")).toBeTruthy();
  });
});
