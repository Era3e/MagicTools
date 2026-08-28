import { Dropdown, Layout, Typography } from "antd";
import type { MenuProps } from "antd";
import type { ReactNode } from "react";
import { APPS } from "./apps";
import { ThemeProvider } from "./theme";

export interface UserNavItem {
  key: string;
  label: string;
}

export interface UserShellTheme {
  primary: string;
  background: string;
  ink: string;
  muted: string;
  displayFont: string;
  bodyFont: string;
  /** 各应用可选扩展色板键（按项目约定自行填入页面需要的面板/分割线/纸底色等） */
  [key: string]: string;
}

export const MAGAZINE_THEME: UserShellTheme = {
  primary: "#b4532a",
  background: "#f8f5ef",
  ink: "#2b2620",
  muted: "#8a8175",
  displayFont: 'Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", serif',
  bodyFont: '"Noto Serif SC", Georgia, serif',
};

export interface UserShellProps {
  title: string;
  subtitle?: string;
  navItems: UserNavItem[];
  selectedKey: string;
  onNavigate: (key: string) => void;
  adminPath?: string;
  adminLabel?: string;
  footerNote?: string;
  theme?: UserShellTheme;
  children: ReactNode;
}

export function UserShell(props: UserShellProps) {
  const { title, subtitle, navItems, selectedKey, onNavigate, adminPath, adminLabel = "管理后台", footerNote = "MagicTools", theme = MAGAZINE_THEME, children } = props;

  const switcherItems: MenuProps["items"] = APPS.map((app) => ({
    key: app.key,
    label: <a href={app.path}>{app.label}</a>,
  }));

  return (
    <ThemeProvider value={theme}>
      <Layout style={{ minHeight: "100vh", background: theme.background, fontFamily: theme.bodyFont }}>
      <header
        style={{
          borderBottom: "3px double " + theme.ink,
          padding: "36px 24px 0",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 6, color: theme.muted, textTransform: "uppercase" }}>
          MagicTools
        </div>
        <h1
          style={{
            fontFamily: theme.displayFont,
            fontSize: 40,
            fontWeight: 700,
            color: theme.ink,
            margin: "8px 0 4px",
            letterSpacing: 2,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <Typography.Paragraph style={{ color: theme.muted, fontStyle: "italic", marginBottom: 16 }}>
            {subtitle}
          </Typography.Paragraph>
        ) : null}
        <nav
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 36,
            padding: "12px 0",
            borderTop: "1px solid " + theme.ink,
            borderBottom: "1px solid " + theme.ink,
          }}
        >
          {navItems.map((item) => {
            const active = item.key === selectedKey;
            return (
              <a
                key={item.key}
                onClick={() => onNavigate(item.key)}
                style={{
                  fontFamily: theme.displayFont,
                  fontSize: 15,
                  letterSpacing: 2,
                  color: active ? theme.primary : theme.ink,
                  borderBottom: active ? "2px solid " + theme.primary : "2px solid transparent",
                  paddingBottom: 2,
                  cursor: "pointer",
                }}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </header>
      <Layout.Content style={{ maxWidth: 1080, width: "100%", margin: "0 auto", padding: "32px 24px 64px" }}>
        {children}
      </Layout.Content>
      <footer
        style={{
          borderTop: "1px solid " + theme.muted,
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: theme.muted,
          fontSize: 12,
        }}
      >
        <span>{footerNote}</span>
        <span style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {adminPath ? (
            <a href={adminPath} onClick={(e) => { e.preventDefault(); onNavigate(adminPath); }} style={{ color: theme.muted }}>
              {adminLabel} →
            </a>
          ) : null}
          <Dropdown menu={{ items: switcherItems }}>
            <a style={{ color: theme.muted }}>切换应用</a>
          </Dropdown>
        </span>
      </footer>
    </Layout>
    </ThemeProvider>
  );
}
