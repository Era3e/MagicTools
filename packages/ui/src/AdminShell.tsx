import { Button, Dropdown, Layout, Menu, Tag, Typography } from "antd";
import type { MenuProps } from "antd";
import type { ReactNode } from "react";
import { APPS } from "./apps";

const ADMIN_TOKENS = {
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

  const switcherItems: MenuProps["items"] = APPS.map((app) => ({
    key: app.key,
    label: <a href={app.path}>{app.label}</a>,
  }));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider width={208} style={{ background: ADMIN_TOKENS.siderBg }}>
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
          items={navItems as MenuProps["items"]}
          onClick={(e) => onNavigate(e.key)}
          style={{ background: "transparent", borderInlineEnd: "none", fontSize: 13 }}
        />
        {frontPath ? (
          <div style={{ position: "absolute", bottom: 16, left: 16 }}>
            <a
              href={frontPath}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(frontPath);
              }}
              style={{ color: ADMIN_TOKENS.siderText, fontSize: 12 }}
            >
              ← {frontLabel}
            </a>
          </div>
        ) : null}
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{
            background: ADMIN_TOKENS.bgContainer,
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid " + ADMIN_TOKENS.border,
            height: 52,
            lineHeight: "52px",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tag color="blue" style={{ margin: 0 }}>
              后台
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {title} · 配置与数据管理
            </Typography.Text>
          </span>
          <Dropdown menu={{ items: switcherItems }}>
            <Button size="small">切换应用</Button>
          </Dropdown>
        </Layout.Header>
        <Layout.Content style={{ padding: 16, background: ADMIN_TOKENS.bgLayout }}>{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
