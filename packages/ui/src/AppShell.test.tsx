import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppShell } from "./AppShell";

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

describe("AppShell", () => {
  it("渲染标题、导航项与应用切换入口，点击导航触发回调", () => {
    const onNavigate = vi.fn();
    render(
      <AppShell
        title="求职"
        navItems={[
          { key: "/positions", label: "岗位" },
          { key: "/resumes", label: "简历" },
        ]}
        selectedKey="/positions"
        onNavigate={onNavigate}
      >
        <div>内容区</div>
      </AppShell>
    );

    expect(screen.getAllByText("求职").length).toBeGreaterThan(0);
    expect(screen.getByText("岗位")).toBeTruthy();
    expect(screen.getByText("简历")).toBeTruthy();
    expect(screen.getByText("内容区")).toBeTruthy();

    fireEvent.click(screen.getByText("简历"));
    expect(onNavigate).toHaveBeenCalledWith("/resumes");
  });
});
