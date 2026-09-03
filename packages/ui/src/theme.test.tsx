import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { theme as antdTheme } from "antd";
import { MtThemeProvider } from "./theme";

/** 探针组件：读取 AntD 实际生效的 token（ConfigProvider 注入结果） */
function TokenProbe() {
  const { token } = antdTheme.useToken();
  return (
    <div
      data-testid="probe"
      data-primary={String(token.colorPrimary)}
      data-bg-container={String(token.colorBgContainer)}
      data-height={String(token.controlHeight)}
      data-radius={String(token.borderRadius)}
      data-font={String(token.fontFamily)}
      data-success={String(token.colorSuccess)}
    />
  );
}

describe("MtThemeProvider（v2 全量注入）", () => {
  it("渲染子元素", () => {
    render(
      <MtThemeProvider>
        <div>child</div>
      </MtThemeProvider>
    );
    expect(screen.getByText("child")).toBeTruthy();
  });

  it("向 AntD 注入 v2 品牌令牌（墨蓝主色/36 控件高/正文字体）", () => {
    render(
      <MtThemeProvider>
        <TokenProbe />
      </MtThemeProvider>
    );
    const probe = screen.getByTestId("probe");
    expect(probe.getAttribute("data-primary")).toBe("#2c4a6e");
    expect(probe.getAttribute("data-success")).toBe("#3a7049");
    expect(probe.getAttribute("data-height")).toBe("36");
    expect(probe.getAttribute("data-radius")).toBe("6");
    expect(probe.getAttribute("data-font")).toContain("Noto Sans SC");
  });

  it("注入品牌字体样式表（Google Fonts，幂等单例）", () => {
    render(
      <MtThemeProvider>
        <div>fonts</div>
      </MtThemeProvider>
    );
    const link = document.getElementById("mt-brand-fonts");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toContain("Noto+Serif+SC");
    expect(link?.getAttribute("href")).toContain("JetBrains+Mono");
  });
});
