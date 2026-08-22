import { Button, Dropdown, Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import type { ReactNode } from "react";
import { APPS } from "./apps";
import { tokens } from "./tokens";

export interface NavItem {
  key: string;
  label: string;
}

export interface AppShellProps {
  title: string;
  navItems: NavItem[];
  selectedKey: string;
  onNavigate: (key: string) => void;
  children: ReactNode;
}

export function AppShell(props: AppShellProps) {
  const { title, navItems, selectedKey, onNavigate, children } = props;

  const switcherItems: MenuProps["items"] = APPS.map((app) => ({
    key: app.key,
    label: <a href={app.path}>{app.label}</a>,
  }));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider
        width={200}
        style={{ background: tokens.color.bgContainer, borderRight: "1px solid " + tokens.color.border }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: "0 " + tokens.spacing.lg + "px",
            fontWeight: 600,
            fontSize: tokens.fontSize.lg,
            color: tokens.color.primary,
          }}
        >
          {title}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={navItems as MenuProps["items"]}
          onClick={(e) => onNavigate(e.key)}
          style={{ borderInlineEnd: "none" }}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{
            background: tokens.color.bgContainer,
            padding: "0 " + tokens.spacing.lg + "px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid " + tokens.color.border,
          }}
        >
          <Typography.Text strong>{title}</Typography.Text>
          <Dropdown menu={{ items: switcherItems }}>
            <Button>切换应用</Button>
          </Dropdown>
        </Layout.Header>
        <Layout.Content
          style={{ padding: tokens.spacing.lg, background: tokens.color.bgLayout }}
        >
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
