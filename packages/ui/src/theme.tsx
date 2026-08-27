import { ConfigProvider } from "antd";
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

/** @internal 仅由 UserShell 内部使用 */
export const ThemeProvider = ThemeContext.Provider;

export function MtThemeProvider(props: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: tokens.color.primary,
          colorSuccess: tokens.color.success,
          colorWarning: tokens.color.warning,
          colorError: tokens.color.error,
          borderRadius: tokens.radius,
          fontSize: tokens.fontSize.md,
        },
      }}
    >
      {props.children}
    </ConfigProvider>
  );
}
