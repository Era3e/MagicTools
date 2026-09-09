import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { theme as antdTheme } from "antd";
import { UserShell, MAGAZINE_THEME } from "./UserShell";

afterEach(cleanup);

// antd Dropdown/Layout 依赖 matchMedia，jsdom 需 polyfill
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

describe("UserShell（v2.3 报头式外壳）", () => {
  it("渲染报头 eyebrow/应用名与水平导航，点击导航触发回调", () => {
    const onNavigate = vi.fn();
    render(
      <UserShell
        title="学者书库"
        eyebrow="SCHOLAR · 学者书库"
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
    expect(screen.getByText("学者书库")).toBeTruthy();
    expect(screen.getByText("SCHOLAR · 学者书库")).toBeTruthy();
    expect(screen.getByText("书目检索")).toBeTruthy();
    fireEvent.click(screen.getByText("书目检索"));
    expect(onNavigate).toHaveBeenCalledWith("/search");
  });

  it("导航激活项带 data-active 标记（accent 下边框态）", () => {
    const { container } = render(
      <UserShell
        title="学者书库"
        navItems={[
          { key: "/entries", label: "馆藏条目" },
          { key: "/search", label: "书目检索" },
        ]}
        selectedKey="/search"
        onNavigate={() => {}}
      >
        <div>内容区</div>
      </UserShell>
    );
    const active = container.querySelector('.us-nav a[data-active="true"]');
    expect(active?.textContent).toBe("书目检索");
  });

  it("页脚与报头均渲染管理后台入口（adminPath）", () => {
    render(
      <UserShell
        title="学者书库"
        navItems={[{ key: "/entries", label: "馆藏条目" }]}
        selectedKey="/entries"
        onNavigate={() => {}}
        adminPath="/admin/settings"
      >
        <div>内容区</div>
      </UserShell>
    );
    expect(screen.getAllByText(/管理后台/).length).toBeGreaterThanOrEqual(2);
  });

  it("应用主题 accent 真注入 AntD（前台控件跟随应用色）", () => {
    render(
      <UserShell
        title="学者书库"
        navItems={[{ key: "/entries", label: "馆藏条目" }]}
        selectedKey="/entries"
        onNavigate={() => {}}
        theme={{ ...MAGAZINE_THEME, primary: "#a8522e", accent: "#a8522e" }}
      >
        <AccentProbe />
      </UserShell>
    );
    const probe = screen.getByTestId("accent-probe");
    expect(probe.getAttribute("data-primary")).toBe("#a8522e");
    expect(probe.getAttribute("data-radius")).toBe("6");
  });

  it("subtitle 渲染为副文", () => {
    render(
      <UserShell
        title="智能助手"
        subtitle="有问题，就直接问"
        navItems={[{ key: "/chat", label: "对话" }]}
        selectedKey="/chat"
        onNavigate={() => {}}
      >
        <div>内容区</div>
      </UserShell>
    );
    expect(screen.getByText("有问题，就直接问")).toBeTruthy();
  });
});
