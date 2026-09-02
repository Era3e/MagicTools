import { Button, Drawer, Dropdown, Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { useState } from "react";
import { MenuOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { APPS } from "./apps";
import { AdminDarkThemeProvider, ThemeProvider } from "./theme";
import { tokens } from "./tokens";
import { useResponsive } from "./useResponsive";

export interface AdminNavItem {
  key: string;
  label: string;
}

export interface AdminShellProps {
  title: string;
  navItems: AdminNavItem[];
  selectedKey: string;
  onNavigate: (key: string) => void;
  frontPath?: string;
  frontLabel?: string;
  children: ReactNode;
}

/**
 * AdminShell — v2 石墨深色控制台外壳（全平台统一，禁止个性化）。
 * 表面色锚点取 tokens.admin / tokens.dark；内容区经 AdminDarkThemeProvider
 * 注入 AntD 暗色算法，后台表格/表单/浮层整体转深色（主题真注入）。
 */
export function AdminShell(props: AdminShellProps) {
  const { title, navItems, selectedKey, onNavigate, frontPath, frontLabel = "返回前台", children } = props;
  const { isMobile } = useResponsive();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const switcherItems: MenuProps["items"] = APPS.map((app) => ({
    key: app.key,
    label: <a href={app.path}>{app.label}</a>,
  }));

  const navMenuItems: MenuProps["items"] = navItems.map((item) => ({
    key: item.key,
    label: item.label,
  }));

  const handleNav = (key: string) => {
    onNavigate(key);
    setDrawerOpen(false);
  };

  const siderContent = (
    <>
      <div style={{ padding: "20px 16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography.Text style={{ color: tokens.admin.textSecondary, fontSize: 11, letterSpacing: 2, fontFamily: tokens.font.mono }}>
          ADMIN CONSOLE
        </Typography.Text>
        <Typography.Text strong style={{ color: tokens.admin.text, fontSize: 16 }}>
          {title}
        </Typography.Text>
      </div>
      <Menu
        mode="inline"
        theme="dark"
        selectedKeys={[selectedKey]}
        items={navMenuItems}
        onClick={(e) => handleNav(e.key)}
        style={{ background: "transparent", borderInlineEnd: "none", fontSize: 13 }}
      />
      {frontPath ? (
        <div style={{ position: "absolute", bottom: 16, left: 16 }}>
          <a
            href={frontPath}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(frontPath);
              setDrawerOpen(false);
            }}
            style={{ color: tokens.admin.textSecondary, fontSize: 12 }}
          >
            ← {frontLabel}
          </a>
        </div>
      ) : null}
    </>
  );

  return (
    <AdminDarkThemeProvider>
      <ThemeProvider value={{ ...MAGAZINE_THEME_STUB }}>
        <Layout style={{ minHeight: "100vh", background: tokens.admin.contentBg }}>
          {isMobile ? (
            // 移动端：侧边栏用 Drawer 呈现
            <Drawer
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              placement="left"
              width={220}
              styles={{ body: { padding: 0, background: tokens.admin.siderBg } }}
            >
              {siderContent}
            </Drawer>
          ) : (
            // 桌面端：固定侧边栏
            <Layout.Sider width={208} style={{ background: tokens.admin.siderBg }}>
              {siderContent}
            </Layout.Sider>
          )}

          <Layout>
            <Layout.Header
              style={{
                background: tokens.admin.headerBg,
                padding: isMobile ? "0 12px" : "0 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid " + tokens.admin.border,
                height: 52,
                lineHeight: "52px",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 8 }}>
                {isMobile && (
                  <MenuOutlined
                    style={{ fontSize: 18, cursor: "pointer", color: tokens.admin.text }}
                    onClick={() => setDrawerOpen(true)}
                  />
                )}
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 1,
                    padding: "2px 8px",
                    borderRadius: tokens.radiusTokens.sm,
                    color: tokens.dark.accent,
                    background: "rgba(207, 160, 76, 0.12)",
                    fontFamily: tokens.font.mono,
                  }}
                >
                  后台
                </span>
                {!isMobile && (
                  <Typography.Text style={{ fontSize: 12, color: tokens.admin.textSecondary }}>
                    {title} · 配置与数据管理
                  </Typography.Text>
                )}
              </span>
              <Dropdown menu={{ items: switcherItems }}>
                <Button size="small" ghost>
                  切换应用
                </Button>
              </Dropdown>
            </Layout.Header>
            <Layout.Content style={{ padding: isMobile ? 12 : 16, background: tokens.admin.contentBg }}>
              {children}
            </Layout.Content>
          </Layout>
        </Layout>
      </ThemeProvider>
    </AdminDarkThemeProvider>
  );
}

/** @internal 后台不消费前台主题，注入最小 stub 仅保证 useTheme() 不炸 */
const MAGAZINE_THEME_STUB = {
  primary: tokens.admin.accent,
  background: tokens.admin.contentBg,
  ink: tokens.admin.text,
  muted: tokens.admin.textSecondary,
  displayFont: tokens.font.body,
  bodyFont: tokens.font.body,
} as const;
