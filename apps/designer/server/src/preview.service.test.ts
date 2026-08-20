import { describe, expect, it } from "vitest";
import { buildPreviewHtml } from "./preview.service";

const VALID_CODE = `import { Card } from "antd";
import { tokens } from "@mt/ui";

export default function Demo() {
  return <Card title="演示"><span style={{ color: tokens.color.primary }}>你好</span></Card>;
}
`;

describe("buildPreviewHtml", () => {
  it("合法组件源码编译为可执行 HTML", async () => {
    const html = await buildPreviewHtml(VALID_CODE);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<div id="root">');
    expect(html).toContain("createRoot");
    expect(html.length).toBeGreaterThan(1000);
  }, 30000);

  it("非法源码编译抛错", async () => {
    await expect(buildPreviewHtml("const x = {")).rejects.toThrow();
  }, 30000);
});
