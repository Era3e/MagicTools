import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { tokens } from "./tokens";

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
