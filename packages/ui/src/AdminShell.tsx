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
 * AdminShell — v2.1 石墨深色控制台外壳（全平台统一，禁止个性化）。
 * 质感升级：Linear 噪点 + 多层环境光 + GitHub 发丝边框 + Vercel 透明度文字层级。
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
        {/* 质感 CSS：焦点环 + 表格行悬浮重音条 + 卡片渐变描边 */}
        <style>{`
          .mt-admin-shell *:focus-visible {
            outline: none;
            box-shadow: ${tokens.shadow.focusRing};
          }
          .mt-admin-shell .ant-table-tbody > tr:hover > td {
            background: rgba(255, 255, 255, 0.035) !important;
            box-shadow: inset 2px 0 0 ${tokens.admin.accent};
          }
          .mt-admin-shell .ant-table-tbody > tr > td {
            border-bottom: 1px solid ${tokens.dark.hairline};
            transition: background ${tokens.motion.durationFast} ${tokens.motion.easeStandard};
          }
          .mt-admin-shell .ant-table-thead > tr > th {
            background: rgba(255, 255, 255, 0.03) !important;
            border-bottom: 1px solid ${tokens.dark.hairlineStrong};
          }
          .mt-admin-shell .ant-card {
            box-shadow: ${tokens.shadow.darkCard};
            transition: box-shadow ${tokens.motion.durationBase} ${tokens.motion.easeStandard}, border-color ${tokens.motion.durationFast} ${tokens.motion.easeStandard};
          }
          .mt-admin-shell .ant-card:hover {
            box-shadow: ${tokens.shadow.darkCardHover};
            border-color: ${tokens.dark.hairlineHover};
          }
          .mt-admin-shell .ant-btn-primary {
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
          }
          .mt-admin-shell .ant-btn-primary:hover {
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15), 0 0 20px rgba(110, 139, 173, 0.15);
          }
          .mt-admin-shell .ant-btn-primary:active {
            transform: scale(0.98);
          }
          .mt-admin-shell .ant-typography {
            font-variant-numeric: tabular-nums;
          }
          /* 暗色光学修正：亮文字在暗底上有"光渗"幻觉 → 字重降一档 */
          .mt-admin-shell, .mt-admin-shell .ant-typography, .mt-admin-shell .ant-btn, .mt-admin-shell .ant-menu-item {
            font-weight: 350;
          }
          .mt-admin-shell h1, .mt-admin-shell h2, .mt-admin-shell h3,
          .mt-admin-shell .ant-typography-h1, .mt-admin-shell .ant-typography-h2, .mt-admin-shell .ant-typography-h3 {
            font-weight: 500;
            letter-spacing: -0.01em;
          }
          .mt-admin-shell h4, .mt-admin-shell .ant-typography-h4 {
            font-weight: 500;
          }
          /* 表格数字列对齐 */
          .mt-admin-shell .ant-table-cell {
            font-variant-numeric: tabular-nums;
          }
        `}</style>
        <Layout className="mt-admin-shell" style={{ minHeight: "100vh", background: tokens.admin.contentBg, position: "relative" }}>
          {/* 质感层：Linear 式多层环境聚光灯 */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "0 0 auto 0",
              height: 420,
              background: tokens.craft.glowDark,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "0 0 auto 0",
              height: 300,
              background: tokens.craft.glowDarkSecondary,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {/* 质感层：Linear 式噪点纹理（mix-blend-mode overlay） */}
          <div
            aria-hidden
            className="mt-noise-layer"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: tokens.craft.noise,
              backgroundRepeat: "repeat",
              opacity: tokens.craft.noiseOpacity,
              mixBlendMode: "overlay" as const,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
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
            // 桌面端：固定侧边栏（纵向渐变 + 右缘发丝线 + 顶部高光）
            <Layout.Sider
              width={208}
              style={{
                background: tokens.craft.siderGrad,
                borderRight: "1px solid " + tokens.dark.hairline,
                boxShadow: "inset 1px 0 0 rgba(255, 255, 255, 0.03)",
                position: "relative",
                zIndex: 2,
              }}
            >
              {siderContent}
            </Layout.Sider>
          )}

          <Layout>
            <Layout.Header
              style={{
                background: tokens.craft.headerGlass,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                padding: isMobile ? "0 12px" : "0 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid " + tokens.dark.hairline,
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
                height: 52,
                lineHeight: "52px",
                position: "sticky",
                top: 0,
                zIndex: 3,
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
            <Layout.Content style={{ padding: isMobile ? 12 : 16, background: "transparent", position: "relative", zIndex: 2 }}>
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
  ink: tokens.dark.textPrimary,       // 透明度文字（Vercel 风格）
  muted: tokens.dark.textTertiary,    // 透明度三级
  displayFont: tokens.font.body,
  bodyFont: tokens.font.body,
} as const;
