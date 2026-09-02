import { ConfigProvider, theme as antdTheme } from "antd";
import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { tokens } from "./tokens";
import { MAGAZINE_THEME, type UserShellTheme } from "./UserShell";

/**
 * 前台应用主题上下文：由 UserShell 注入当前应用自定义主题。
 * 页面组件通过 useTheme() 读取，避免在各页面复制硬编码色板。
 * 回退默认值为 MAGAZINE_THEME，保证未注入时也能渲染。
 */
const ThemeContext = createContext<UserShellTheme>(MAGAZINE_THEME);

export function useTheme(): UserShellTheme {
  return useContext(ThemeContext);
}

/** @internal 仅由 UserShell/AdminShell 内部使用 */
export const ThemeProvider = ThemeContext.Provider;

const BRAND_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Noto+Sans+SC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

/** 注入品牌字体样式表（幂等单例，离线环境静默降级到系统衬线/黑体/等宽栈） */
function useBrandFonts(): void {
  useEffect(() => {
    if (document.getElementById("mt-brand-fonts")) return;
    const link = document.createElement("link");
    link.id = "mt-brand-fonts";
    link.rel = "stylesheet";
    link.href = BRAND_FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

/**
 * v2 全量主题注入：除主色/语义色外，补齐控件高度、正文字体、
 * 圆角、边框、浮层阴影与动效时长，消灭 AntD 出厂默认观感。
 */
export function MtThemeProvider(props: { children: ReactNode }) {
  useBrandFonts();
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: tokens.color.primary,
          colorSuccess: tokens.color.success,
          colorWarning: tokens.color.warning,
          colorError: tokens.color.error,
          colorInfo: tokens.color.info,
          colorTextBase: tokens.color.text,
          colorBgLayout: tokens.color.bgLayout,
          colorBgContainer: tokens.color.bgContainer,
          colorBorder: tokens.color.border,
          colorBorderSecondary: tokens.color.border,
          fontFamily: tokens.font.body,
          borderRadius: tokens.radiusTokens.md,
          borderRadiusLG: tokens.radiusTokens.lg,
          controlHeight: tokens.size.buttonMd,
          motionDurationFast: tokens.motion.durationFast,
          motionDurationMid: tokens.motion.durationBase,
        },
        components: {
          Table: {
            headerBg: tokens.color.bgNeutral,
            headerColor: tokens.color.textSecondary,
            rowHoverBg: tokens.color.bgActive,
            headerBorderRadius: tokens.radiusTokens.md,
          },
          Card: { boxShadowTertiary: tokens.shadow.card },
          Modal: { boxShadowSecondary: tokens.shadow.modal },
        },
      }}
    >
      {props.children}
    </ConfigProvider>
  );
}

/** @internal AdminShell 暗色注入：石墨深色控制台（全平台统一） */
export function AdminDarkThemeProvider(props: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: tokens.admin.accent,
          colorInfo: tokens.admin.accent,
          colorBgLayout: tokens.admin.contentBg,
          colorBgContainer: tokens.dark.surface1,
          colorBgElevated: tokens.dark.surface2,
          colorBorder: tokens.dark.border,
          colorBorderSecondary: tokens.dark.border,
          colorText: tokens.dark.text,
          colorTextSecondary: tokens.dark.textSecondary,
          fontFamily: tokens.font.body,
          borderRadius: tokens.radiusTokens.md,
          controlHeight: tokens.size.buttonMd,
        },
        components: {
          Table: {
            headerBg: tokens.dark.surface2,
            headerColor: tokens.dark.textSecondary,
            rowHoverBg: tokens.dark.rowHover,
            headerBorderRadius: tokens.radiusTokens.md,
          },
        },
      }}
    >
      {props.children}
    </ConfigProvider>
  );
}
