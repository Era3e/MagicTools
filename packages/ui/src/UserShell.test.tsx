import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { theme as antdTheme } from "antd";
import { UserShell, MAGAZINE_THEME } from "./UserShell";

// antd Drawer/Layout 依赖 matchMedia，jsdom 需 polyfill
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

/** 探针组件：验证 UserShell 内 AntD 控件（分页/输入/按钮）跟随应用主题 accent */
function AccentProbe() {
  const { token } = antdTheme.useToken();
  return (
    <div data-testid="accent-probe" data-primary={String(token.colorPrimary)} data-radius={String(token.borderRadius)} />
  );
}

describe("UserShell（v2 主题真注入）", () => {
  it("渲染报头标题与水平导航，点击导航触发回调", () => {
    const onNavigate = vi.fn();
    render(
      <UserShell
        title="知识书院"
        subtitle="每一则知识，皆入馆藏"
        navItems={[
          { key: "/entries", label: "馆藏条目" },
          { key: "/search", label: "书目检索" },
        ]}
        selectedKey="/entries"
        onNavigate={onNavigate}
      >
        <div>内容区</div>
      </UserShell>
    );
    expect(screen.getByRole("heading", { name: "知识书院" })).toBeTruthy();
    expect(screen.getByText("书目检索")).toBeTruthy();
    fireEvent.click(screen.getByText("书目检索"));
    expect(onNavigate).toHaveBeenCalledWith("/search");
  });

  it("页脚渲染管理后台入口（adminPath）", () => {
    render(
      <UserShell
        title="知识书院"
        navItems={[{ key: "/entries", label: "馆藏条目" }]}
        selectedKey="/entries"
        onNavigate={() => {}}
        adminPath="/admin/settings"
      >
        <div>内容区</div>
      </UserShell>
    );
    expect(screen.getByText(/管理后台/)).toBeTruthy();
  });

  it("应用主题 accent 真注入 AntD（前台控件跟随应用色）", () => {
    render(
      <UserShell
        title="知识书院"
        navItems={[{ key: "/entries", label: "馆藏条目" }]}
        selectedKey="/entries"
        onNavigate={() => {}}
        theme={{ ...MAGAZINE_THEME, primary: "#a8522e" }}
      >
        <AccentProbe />
      </UserShell>
    );
    const probe = screen.getByTestId("accent-probe");
    expect(probe.getAttribute("data-primary")).toBe("#a8522e");
    expect(probe.getAttribute("data-radius")).toBe("6");
  });
});
