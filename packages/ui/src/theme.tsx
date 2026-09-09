import { ConfigProvider, theme as antdTheme } from "antd";
import { createContext, useContext } from "react";
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

/**
 * v2.2 字体本地化说明：
 *   - 品牌 woff2 已随包分发（packages/ui/fonts/），经 `@mt/ui/fonts.css` 由各应用入口 import，
 *     Vite 负责按应用 base 打包与预览——零 CDN 依赖（离线/内网环境观感不再降级）。
 *   - 中文子集体积过大（数 MB/字重），继续走系统栈（PingFang/雅黑/宋体）；
 *     unicode-range 限定 latin——英文/数字（等宽读数、衬线标题）命中本地 woff2，中文命中系统栈。
 *   - 本组件不再注入任何字体 link（原 Google Fonts CDN 注入已移除）。
 */

/**
 * v2 全量主题注入：除主色/语义色外，补齐控件高度、正文字体、
 * 圆角、边框、浮层阴影与动效时长，消灭 AntD 出厂默认观感。
 */
export function MtThemeProvider(props: { children: ReactNode }) {
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
            borderColor: tokens.craft.hairline,
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

/** @internal AdminShell 暗色注入：v2.1 石墨深色控制台（四级表面阶梯 + 双层投影 + 透明度文字） */
export function AdminDarkThemeProvider(props: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: tokens.admin.accent,
          colorInfo: tokens.admin.accent,
          colorBgLayout: tokens.admin.contentBg,       // 画布级 #0e1218
          colorBgContainer: tokens.dark.surface1,       // 卡片表面 #181d26
          colorBgElevated: tokens.dark.surface3,        // 抬起表面 #252e3b（原 surface2→surface3）
          colorBorder: tokens.dark.border,             // 发丝边框 #2a3340
          colorBorderSecondary: tokens.dark.hairline,  // 二级边框（半透明白 7%）
          colorText: tokens.dark.text,                 // 兼容实色映射
          colorTextSecondary: tokens.dark.textSecondary,
          colorTextTertiary: tokens.dark.textTertiary,  // 透明度三级文字
          colorTextQuaternary: tokens.dark.textFaint,   // 透明度四级文字
          fontFamily: tokens.font.body,
          fontSize: 14,
          borderRadius: tokens.radiusTokens.md,
          controlHeight: tokens.size.buttonMd,
        },
        components: {
          Table: {
            headerBg: tokens.dark.tableHeaderBg,
            headerColor: tokens.dark.textTertiary,
            headerSplitColor: tokens.dark.hairline,
            rowHoverBg: tokens.dark.tableRowHoverBg,
            rowSelectedBg: tokens.dark.rowSelectedBg,
            rowSelectedHoverBg: tokens.dark.rowSelectedHoverBg,
            headerBorderRadius: tokens.radiusTokens.md,
            borderColor: tokens.dark.hairline,
            cellPaddingBlock: 12,
            cellPaddingInline: 12,
          },
          Card: {
            boxShadowTertiary: tokens.shadow.darkCard,
            colorBgContainer: tokens.dark.surface1,
            colorBorderSecondary: tokens.dark.hairline,
          },
          Modal: {
            boxShadowSecondary: tokens.shadow.darkModal,
            contentBg: tokens.dark.surface3,
            headerBg: tokens.dark.surface3,
          },
          Menu: {
            itemBg: "transparent",
            itemSelectedBg: tokens.dark.menuSelectedBg,
            itemHoverBg: tokens.dark.menuHoverBg,
            itemSelectedColor: tokens.admin.text,
            itemColor: tokens.dark.textTertiary,
          },
          Button: {
            primaryShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
          },
          Input: {
            colorBgContainer: tokens.dark.surface0,
            activeBorderColor: tokens.admin.accent,
            activeShadow: tokens.shadow.focusRing,
          },
          Select: {
            colorBgContainer: tokens.dark.surface0,
            optionSelectedBg: tokens.dark.menuSelectedBg,
          },
          Tag: {
            defaultBg: tokens.dark.tagBg,
            defaultColor: tokens.dark.textTertiary,
          },
        },
      }}
    >
      {props.children}
    </ConfigProvider>
  );
}
