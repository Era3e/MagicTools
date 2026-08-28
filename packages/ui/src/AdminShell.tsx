import { Button, Dropdown, Layout, Menu, Tag, Typography, Drawer } from "antd";
import type { MenuProps } from "antd";
import { useState } from "react";
import { MenuOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { APPS } from "./apps";
import { ThemeProvider } from "./theme";
import { useResponsive } from "./useResponsive";

const ADMIN_TOKENS = {
  primary: "#4c7dff",
  background: "#f4f5f7",
  ink: "#1c1f26",
  muted: "#9aa3b2",
  displayFont: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  bodyFont: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  siderBg: "#1c1f26",
  siderText: "#9aa3b2",
  siderActive: "#ffffff",
  accent: "#4c7dff",
  bgLayout: "#f4f5f7",
  bgContainer: "#ffffff",
  border: "#e3e6ea",
};

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
        <Typography.Text style={{ color: ADMIN_TOKENS.siderText, fontSize: 11, letterSpacing: 2 }}>
          ADMIN CONSOLE
        </Typography.Text>
        <Typography.Text strong style={{ color: ADMIN_TOKENS.siderActive, fontSize: 16 }}>
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
            style={{ color: ADMIN_TOKENS.siderText, fontSize: 12 }}
          >
            ← {frontLabel}
          </a>
        </div>
      ) : null}
    </>
  );

  return (
    <ThemeProvider value={ADMIN_TOKENS}>
    <Layout style={{ minHeight: "100vh" }}>
      {isMobile ? (
        // 移动端：侧边栏用 Drawer 呈现
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          width={220}
          styles={{ body: { padding: 0, background: ADMIN_TOKENS.siderBg } }}
        >
          {siderContent}
        </Drawer>
      ) : (
        // 桌面端：固定侧边栏
        <Layout.Sider width={208} style={{ background: ADMIN_TOKENS.siderBg }}>
          {siderContent}
        </Layout.Sider>
      )}

      <Layout>
        <Layout.Header
          style={{
            background: ADMIN_TOKENS.bgContainer,
            padding: isMobile ? "0 12px" : "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid " + ADMIN_TOKENS.border,
            height: 52,
            lineHeight: "52px",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 8 }}>
            {isMobile && (
              <MenuOutlined
                style={{ fontSize: 18, cursor: "pointer" }}
                onClick={() => setDrawerOpen(true)}
              />
            )}
            <Tag color="blue" style={{ margin: 0 }}>
              后台
            </Tag>
            {!isMobile && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {title} · 配置与数据管理
              </Typography.Text>
            )}
          </span>
          <Dropdown menu={{ items: switcherItems }}>
            <Button size="small">切换应用</Button>
          </Dropdown>
        </Layout.Header>
        <Layout.Content style={{ padding: isMobile ? 12 : 16, background: ADMIN_TOKENS.bgLayout }}>
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
    </ThemeProvider>
  );
}
