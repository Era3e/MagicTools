import { ConfigProvider, Dropdown, Layout } from "antd";
import { useState } from "react";
import { MenuOutlined } from "@ant-design/icons";
import type { CSSProperties, ReactNode } from "react";
import { APPS } from "./apps";
import { ThemeProvider } from "./theme";
import { tokens } from "./tokens";
import { useResponsive } from "./useResponsive";

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

/** v2.3 报头式默认主题：墨蓝 accent + 平台亮色底（设计稿 us-* 亮色锚点） */
export const MAGAZINE_THEME: UserShellTheme = {
  primary: "#2c4a6e",
  background: "#f4f6f8",
  ink: "#1c2530",
  muted: "#5f6c7c",
  displayFont: `"Noto Serif SC", "Source Serif 4", "Songti SC", serif`,
  bodyFont: `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`,
  accent: "#2c4a6e",
  tint: "#e3eaf2",
  panel: "#ffffff",
  rule: "#d9dde3",
  card: "#ffffff",
  border: "#d9dde3",
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
  /** 报头 eyebrow（mono 小字，如 SCHOLAR · 学者书库）；缺省取 title 大写 */
  eyebrow?: string;
  children: ReactNode;
}

/** us-* 报头外壳静态样式（墨蓝石墨·工房感 v2.3；色值全部经 CSS 变量注入，规则见 tokens） */
const SHELL_CSS = `
.us-masthead { position: relative; background: var(--us-bg); border-bottom: 1px solid ${tokens.craft.hairline}; }
.us-masthead-inner { max-width: 1080px; min-height: 72px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 24px; }
.us-brand { display: flex; flex-direction: column; gap: 3px; flex: none; min-width: 0; }
.us-eyebrow { font-family: ${tokens.font.mono}; font-size: 11px; font-weight: 600; line-height: 1.4; letter-spacing: 0.08em; text-transform: uppercase; color: var(--us-muted); white-space: nowrap; }
.us-appname { font-family: var(--us-display); font-size: 18px; font-weight: 600; line-height: 1.25; color: var(--us-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.us-nav { display: flex; align-items: center; gap: 26px; margin-inline: auto; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.us-nav::-webkit-scrollbar { display: none; }
.us-nav a { font-family: var(--us-display); font-size: 15px; font-weight: 600; letter-spacing: 0.02em; line-height: 1.4; color: var(--us-muted); text-decoration: none; white-space: nowrap; flex: none; padding: 4px 1px 6px; border-bottom: 2px solid transparent; cursor: pointer; transition: color ${tokens.motion.durationFast} ${tokens.motion.easeStandard}, border-color ${tokens.motion.durationFast} ${tokens.motion.easeStandard}; }
.us-nav a:hover { color: var(--us-ink); }
.us-nav a[data-active="true"] { color: var(--us-accent); border-bottom-color: var(--us-accent); }
.us-actions { display: flex; align-items: center; gap: 14px; flex: none; }
.us-switch { display: inline-flex; align-items: center; gap: 5px; font-family: ${tokens.font.body}; font-size: 13px; font-weight: 500; line-height: 1.4; color: var(--us-muted); text-decoration: none; white-space: nowrap; cursor: pointer; background: none; border: none; padding: 0; transition: color ${tokens.motion.durationFast} ${tokens.motion.easeStandard}; }
.us-switch:hover { color: var(--us-ink); }
.us-admin-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; background: var(--us-panel); border: 1px solid ${tokens.scale.amber[5]}; border-radius: ${tokens.radiusTokens.md}; font-family: ${tokens.font.body}; font-size: 13px; font-weight: 600; line-height: 1; color: ${tokens.scale.amber[6]}; text-decoration: none; white-space: nowrap; cursor: pointer; transition: border-color ${tokens.motion.durationFast} ${tokens.motion.easeStandard}, background-color ${tokens.motion.durationFast} ${tokens.motion.easeStandard}; }
.us-admin-btn:hover { border-color: ${tokens.scale.amber[6]}; background: var(--us-bg); }
.us-admin-btn:active { background: ${tokens.color.bgUser}; }
.us-main { max-width: 1080px; min-height: 320px; margin: 0 auto; padding: 32px 24px 64px; box-sizing: border-box; }
.us-masthead-inner, .us-footer-inner { box-sizing: border-box; }
.us-footer { background: var(--us-bg); border-top: 1px solid ${tokens.craft.hairline}; }
.us-footer-inner { max-width: 1080px; margin: 0 auto; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.us-footer-note { font-family: ${tokens.font.mono}; font-size: 12px; font-weight: 500; line-height: 1.5; letter-spacing: 0.02em; color: var(--us-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.us-footer-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex: none; }
.us-footer-admin { display: inline-flex; align-items: center; gap: 4px; font-family: ${tokens.font.body}; font-size: 13px; font-weight: 500; line-height: 1.4; color: var(--us-muted); text-decoration: none; white-space: nowrap; cursor: pointer; transition: color ${tokens.motion.durationFast} ${tokens.motion.easeStandard}; }
.us-footer-admin:hover { color: var(--us-ink); }
.us-footer-copy { font-family: ${tokens.font.body}; font-size: 12px; line-height: 1.5; color: var(--us-muted); white-space: nowrap; }
.us-masthead-inner :focus-visible, .us-main :focus-visible, .us-footer :focus-visible { outline: 2px solid var(--us-accent); outline-offset: 2px; }
@media (max-width: 920px) {
  .us-masthead-inner { flex-wrap: wrap; align-content: center; min-height: 0; padding: 12px 16px 0; row-gap: 2px; }
  .us-nav { order: 3; flex: 1 1 100%; margin-inline: 0; gap: 20px; padding: 2px 0 10px; }
  .us-actions { margin-left: auto; }
  .us-main { padding: 20px 16px 48px; max-width: 100%; box-sizing: border-box; }
}
/* v2.3.1 平板表格兜底：与 AdminShell 同口径，768 平板即容器内横滚（responsive.spec 768 档抓获） */
@media (max-width: 960px) {
  .us-main .ant-table-content { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .us-main .ant-table table { min-width: 560px; }
}
@media (max-width: 640px) {
  .us-brand { max-width: 58%; }
  .us-actions { gap: 10px; }
  .us-admin-btn { padding: 0 12px; }
  .us-footer-inner { flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px 16px; }
  .us-footer-meta { align-items: flex-start; }
  /* v2.3 前台移动端折叠：KPI/网格类通用规则 */
  .us-main .mt-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; row-gap: 12px; }
  .us-main .mt-kpi-row > div:nth-child(2n) { border-left: 1px solid ${tokens.craft.hairlineStrong}; padding-left: 16px; }
  .us-main .mt-kpi-row > div:nth-child(2n+1) { border-left: none; padding-left: 0; }
  .us-main .mt-kpi-row > div:nth-child(n+3) { border-top: 1px solid ${tokens.craft.hairline}; padding-top: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .us-nav a, .us-switch, .us-admin-btn, .us-footer-admin { transition: none; }
}
`;

/**
 * UserShell — v2.3 前台报头式外壳（设计稿 us-* 复刻）。
 * 报头（brand eyebrow+appname / 水平导航 / 返回总览+琥珀后台按钮）+ 1080px 主区 + 页脚。
 * AntD 控件经嵌套 ConfigProvider 跟随应用 accent（主题真注入）。
 */
export function UserShell(props: UserShellProps) {
  const {
    title,
    subtitle,
    navItems,
    selectedKey,
    onNavigate,
    adminPath,
    adminLabel = "管理后台",
    footerNote = "MagicTools",
    theme = MAGAZINE_THEME,
    eyebrow,
    children,
  } = props;
  const { isMobile } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);

  const switcherItems = APPS.map((app) => ({
    key: app.key,
    label: <a href={app.path}>{app.label}</a>,
  }));

  const cssVars = {
    "--us-bg": theme.background,
    "--us-ink": theme.ink,
    "--us-muted": theme.muted,
    "--us-accent": theme.accent ?? theme.primary,
    "--us-panel": theme.panel ?? theme.card ?? theme.background,
    "--us-display": theme.displayFont,
  } as CSSProperties;

  const eyebrowText = eyebrow ?? `${title} · MagicTools`;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: theme.primary,
          colorLink: theme.primary,
          colorInfo: theme.primary,
          borderRadius: tokens.radiusTokens.md,
          controlHeight: tokens.size.buttonMd,
          fontFamily: theme.bodyFont,
        },
        components: {
          Table: {
            headerBg: theme.panel ?? theme.background,
            headerColor: theme.muted,
            rowHoverBg: theme.card ?? theme.background,
          },
        },
      }}
    >
      <ThemeProvider value={theme}>
        <style>{SHELL_CSS}</style>
        <Layout style={{ minHeight: "100vh", background: theme.background, fontFamily: theme.bodyFont }}>
          <header className="us-masthead" style={cssVars}>
            <div className="us-masthead-inner">
              <div className="us-brand">
                <div className="us-eyebrow">{eyebrowText.toUpperCase()}</div>
                <div className="us-appname">{title}</div>
              </div>
              {isMobile ? (
                <span className="us-actions">
                  <MenuOutlined
                    aria-label="导航"
                    style={{ fontSize: 18, cursor: "pointer", color: theme.ink }}
                    onClick={() => setMenuOpen((v) => !v)}
                  />
                </span>
              ) : (
                <nav className="us-nav" aria-label="主导航">
                  {navItems.map((item) => (
                    <a key={item.key} data-active={item.key === selectedKey} onClick={() => onNavigate(item.key)}>
                      {item.label}
                    </a>
                  ))}
                </nav>
              )}
              <div className="us-actions">
                <Dropdown menu={{ items: switcherItems }}>
                  <button type="button" className="us-switch">
                    切换应用
                  </button>
                </Dropdown>
                {adminPath ? (
                  <a
                    className="us-admin-btn"
                    href={adminPath}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(adminPath);
                    }}
                  >
                    {adminLabel}
                  </a>
                ) : null}
              </div>
            </div>
            {isMobile && menuOpen ? (
              <nav className="us-nav" aria-label="移动端导航" style={{ padding: "8px 16px 12px", flexWrap: "wrap" }}>
                {navItems.map((item) => (
                  <a
                    key={item.key}
                    data-active={item.key === selectedKey}
                    onClick={() => {
                      onNavigate(item.key);
                      setMenuOpen(false);
                    }}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            ) : null}
          </header>

          <Layout.Content role="main" className="us-main" style={cssVars}>
            {subtitle ? (
              <p style={{ color: theme.muted, fontSize: 14, marginTop: 0, marginBottom: tokens.spacing.lg, fontFamily: theme.bodyFont }}>{subtitle}</p>
            ) : null}
            {children}
          </Layout.Content>

          <footer className="us-footer" style={cssVars}>
            <div className="us-footer-inner">
              <div className="us-footer-note">{footerNote}</div>
              <div className="us-footer-meta">
                {adminPath ? (
                  <a
                    className="us-footer-admin"
                    href={adminPath}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(adminPath);
                    }}
                  >
                    {adminLabel} →
                  </a>
                ) : null}
                <div className="us-footer-copy">© 2026 MagicTools · 墨蓝石墨工房</div>
              </div>
            </div>
          </footer>
        </Layout>
      </ThemeProvider>
    </ConfigProvider>
  );
}
