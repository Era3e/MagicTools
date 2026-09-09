import { Button, Drawer, Dropdown, Layout } from "antd";
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
  /** 侧栏 eyebrow（mono 短名，如 SCHOLAR · CONTROL）；缺省 ADMIN CONSOLE */
  eyebrow?: string;
  children: ReactNode;
}

/** as-* 后台外壳静态样式（设计稿 v2.3：240 侧栏 + 52 玻璃顶栏 + 琥珀左指示条激活态） */
const SHELL_CSS = `
.as-layout { min-height: 100vh; }
.as-sider { position: sticky; top: 0; height: 100vh; overflow-y: auto; background: ${tokens.craft.siderGrad}; border-right: 1px solid ${tokens.dark.hairline}; box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.03); display: flex; flex-direction: column; }
.as-brand { padding: 18px 20px 16px; display: flex; flex-direction: column; gap: 3px; border-bottom: 1px solid ${tokens.dark.hairline}; }
.as-brand-eyebrow { font-family: ${tokens.font.mono}; font-size: 10px; font-weight: 600; line-height: 1.5; letter-spacing: 0.16em; text-transform: uppercase; color: ${tokens.scale.ink[3]}; white-space: nowrap; }
.as-brand-name { font-family: ${tokens.font.display}; font-size: 19px; font-weight: 600; line-height: 1.3; color: ${tokens.dark.textPrimary}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.as-nav { flex: 1; padding: 14px 12px; display: flex; flex-direction: column; gap: 2px; }
.as-nav-label { font-family: ${tokens.font.mono}; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: ${tokens.dark.textFaint}; padding: 0 8px; margin: 10px 0 6px; }
.as-nav a { display: flex; align-items: center; height: 36px; padding: 0 12px; border-radius: ${tokens.radiusTokens.md}; font-family: ${tokens.font.body}; font-size: 13.5px; font-weight: 500; color: ${tokens.dark.textTertiary}; text-decoration: none; white-space: nowrap; cursor: pointer; transition: color ${tokens.motion.durationFast} ${tokens.motion.easeStandard}, background ${tokens.motion.durationFast} ${tokens.motion.easeStandard}, box-shadow ${tokens.motion.durationFast} ${tokens.motion.easeStandard}; }
.as-nav a:hover { color: ${tokens.dark.textPrimary}; background: ${tokens.dark.menuHoverBg}; }
.as-nav a[data-active="true"] { color: ${tokens.dark.textPrimary}; box-shadow: inset 2px 0 0 ${tokens.dark.accent}; font-weight: 600; }
.as-sider-foot { padding: 12px 16px 16px; border-top: 1px solid ${tokens.dark.hairline}; display: flex; flex-direction: column; gap: 8px; }
.as-foot-link { display: inline-flex; align-items: center; gap: 5px; height: 32px; font-family: ${tokens.font.mono}; font-size: 11px; font-weight: 500; color: ${tokens.dark.textTertiary}; text-decoration: none; white-space: nowrap; cursor: pointer; transition: color ${tokens.motion.durationFast} ${tokens.motion.easeStandard}; }
.as-foot-link:hover { color: ${tokens.dark.textPrimary}; }
.as-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.as-topbar { position: sticky; top: 0; z-index: 20; height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 20px; background: ${tokens.craft.headerGlass}; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid ${tokens.dark.hairline}; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04); }
.as-crumb { font-family: ${tokens.font.mono}; font-size: 11px; letter-spacing: 0.04em; color: ${tokens.dark.textFaint}; display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.as-crumb-current { color: ${tokens.dark.textTertiary}; }
.as-topbar-right { display: inline-flex; align-items: center; gap: 10px; flex: none; }
.as-pill { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border: 1px solid ${tokens.dark.hairlineStrong}; border-radius: ${tokens.radiusTokens.full}; font-family: ${tokens.font.mono}; font-size: 11px; font-weight: 500; color: ${tokens.dark.textTertiary}; white-space: nowrap; }
.as-pill-dot { width: 5px; height: 5px; border-radius: 50%; background: ${tokens.scale.graphite[4]}; }
.as-content { position: relative; z-index: 2; flex: 1; padding: 24px; background-image: ${tokens.craft.glowDark}; background-repeat: no-repeat; }
.as-content :focus-visible { outline: 1px solid ${tokens.scale.ink[3]}; outline-offset: 2px; }
/* v2.3.1 平板/移动端表格兜底：后台表格列多（6-8 列），768 平板即需容器内横滚，
   否则 table 撑破 as-content 造成页面级横向溢出（responsive.spec 巡检在 768 档抓获） */
@media (max-width: 960px) {
  .as-content .ant-table-content { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .as-content .ant-table table { min-width: 640px; }
}
@media (max-width: 640px) {
  .as-content { padding: 16px 12px; }
  .as-topbar { padding: 0 12px; }
  /* v2.3 移动端折叠：KPI 行 2 列（偶数项保留左分隔线，n+3 项加顶分隔线）；表格容器内滚 */
  .mt-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; row-gap: 12px; }
  .mt-kpi-row > div:nth-child(2n) { border-left: 1px solid ${tokens.dark.hairline}; padding-left: 16px; }
  .mt-kpi-row > div:nth-child(2n+1) { border-left: none; padding-left: 0; }
  .mt-kpi-row > div:nth-child(n+3) { border-top: 1px solid ${tokens.dark.hairline}; padding-top: 12px; }
  /* 双栏演示台（1fr + 320px 导演台）堆叠为单列 */
  .as-content > div[style*="320px"] { grid-template-columns: minmax(0, 1fr) !important; }
  .as-content section[style*="320px"] { grid-template-columns: minmax(0, 1fr) !important; }
  .as-content section > div[style*="320px"], .as-content div[style*="grid-template-columns"][style*="320px"] { grid-template-columns: minmax(0, 1fr) !important; position: static !important; }
  .as-content aside[aria-label="导演台"] { position: static !important; }
}
@media (prefers-reduced-motion: reduce) {
  .as-nav a, .as-foot-link { transition: none; }
}
`;

/**
 * AdminShell — v2.3 石墨深色控制台外壳（设计稿 as-* 复刻）。
 * 240px 侧栏（渐变底+右发丝线+琥珀左指示条激活）+ 52px 毛玻璃顶栏（mono 面包屑+胶囊）
 * + surface-0 画布（顶部环境光+噪点）+ p24 内容区；经 AdminDarkThemeProvider 全量暗色注入。
 */
export function AdminShell(props: AdminShellProps) {
  const { title, navItems, selectedKey, onNavigate, frontPath, frontLabel = "返回前台", eyebrow, children } = props;
  const { isMobile } = useResponsive();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const switcherItems: MenuProps["items"] = APPS.map((app) => ({
    key: app.key,
    label: <a href={app.path}>{app.label}</a>,
  }));

  const handleNav = (key: string) => {
    onNavigate(key);
    setDrawerOpen(false);
  };

  const siderContent = (
    <>
      <div className="as-brand">
        <span className="as-brand-eyebrow">{eyebrow ?? "ADMIN CONSOLE"}</span>
        <span className="as-brand-name">{title}</span>
      </div>
      <nav className="as-nav" aria-label="后台导航">
        {navItems.map((item) => (
          <a key={item.key} data-active={item.key === selectedKey} onClick={() => handleNav(item.key)}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="as-sider-foot">
        {frontPath ? (
          <a
            className="as-foot-link"
            href={frontPath}
            onClick={(e) => {
              e.preventDefault();
              handleNav(frontPath);
            }}
          >
            ← {frontLabel}
          </a>
        ) : null}
        <a className="as-foot-link" href="/">
          返回总览
        </a>
      </div>
    </>
  );

  return (
    <AdminDarkThemeProvider>
      <ThemeProvider value={{ ...MAGAZINE_THEME_STUB }}>
        <style>{SHELL_CSS}</style>
        <Layout className="mt-admin-shell as-layout" style={{ minHeight: "100vh", background: tokens.admin.contentBg, position: "relative" }}>
          {/* 质感层：多层环境聚光灯 + 噪点 */}
          <div aria-hidden style={{ position: "absolute", inset: "0 0 auto 0", height: 420, background: tokens.craft.glowDark, pointerEvents: "none", zIndex: 0 }} />
          <div aria-hidden style={{ position: "absolute", inset: "0 0 auto 0", height: 300, background: tokens.craft.glowDarkSecondary, pointerEvents: "none", zIndex: 0 }} />
          <div
            aria-hidden
            className="mt-noise-layer"
            style={{ position: "absolute", inset: 0, backgroundImage: tokens.craft.noise, backgroundRepeat: "repeat", opacity: tokens.craft.noiseOpacity, mixBlendMode: "overlay" as const, pointerEvents: "none", zIndex: 1 }}
          />
          {isMobile ? (
            <>
              <div className="as-topbar" style={{ position: "sticky", top: 0 }}>
                <MenuOutlined aria-label="导航" style={{ fontSize: 18, cursor: "pointer", color: tokens.admin.text }} onClick={() => setDrawerOpen(true)} />
                <span className="as-pill">
                  <span className="as-pill-dot" />
                  {eyebrow ?? "ADMIN CONSOLE"}
                </span>
              </div>
              <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                placement="left"
                width={240}
                styles={{ body: { padding: 0, background: tokens.craft.siderGrad } }}
              >
                {siderContent}
              </Drawer>
              <Layout.Content className="as-content">{children}</Layout.Content>
            </>
          ) : (
            <div style={{ display: "flex", flex: 1, minHeight: "100vh", position: "relative", zIndex: 2 }}>
              <aside className="as-sider" style={{ width: 240, flex: "none" }}>
                {siderContent}
              </aside>
              <div className="as-body">
                <div className="as-topbar">
                  <span className="as-crumb">
                    <span>{title}</span>
                    <span>/</span>
                    <span className="as-crumb-current">{navItems.find((m) => m.key === selectedKey)?.label ?? title}</span>
                  </span>
                  <span className="as-topbar-right">
                    <span className="as-pill">
                      <span className="as-pill-dot" />
                      V2.3
                    </span>
                    <Dropdown menu={{ items: switcherItems }}>
                      <Button size="small" ghost>
                        切换应用
                      </Button>
                    </Dropdown>
                  </span>
                </div>
                <Layout.Content className="as-content" role="main">
                  {children}
                </Layout.Content>
              </div>
            </div>
          )}
        </Layout>
    </ThemeProvider>
    </AdminDarkThemeProvider>
  );
}

/** @internal 后台不消费前台主题，注入最小 stub 仅保证 useTheme() 不炸 */
const MAGAZINE_THEME_STUB = {
  primary: tokens.admin.accent,
  background: tokens.admin.contentBg,
  ink: tokens.dark.textPrimary,       // 透明度文字（Vercel 风格）
  muted: tokens.dark.textTertiary,    // 透明度三级
  displayFont: tokens.font.display,
  bodyFont: tokens.font.body,
} as const;
