import { describe, expect, it } from "vitest";
import { schemaToCode } from "./codegen";
import { addNode, createEmptyDoc, createNode, updateNodeProps } from "./schema";

describe("codegen schemaToCode", () => {
  it("空画布：div 根 + 容器样式 + tokens import", () => {
    const code = schemaToCode(createEmptyDoc("EmptyCard"));
    expect(code).toContain("import { tokens } from \"@mt/ui\"");
    expect(code).toContain("export default function EmptyCard()");
    expect(code).toContain("display: \"flex\"");
    expect(code).toContain("flexDirection: \"column\"");
    expect(code).toContain("gap: tokens.spacing.m");
    expect(code).toContain("<div");
    expect(code).not.toContain("<Card");
  });

  it("嵌套容器：Card 内标题+文本，tokens 间距映射", () => {
    let doc = createEmptyDoc("HeroCard");
    const card = createNode("card");
    const title = createNode("title");
    const text = createNode("text");
    doc = addNode(doc, doc.root.id, card);
    const cardId = doc.root.children[0].id;
    doc = addNode(doc, cardId, title);
    doc = addNode(doc, cardId, text);

    const code = schemaToCode(doc);
    expect(code).toContain("import { Card, Typography } from \"antd\"");
    expect(code).toContain("<Card title=\"卡片标题\"");
    expect(code).toContain("<Typography.Title level={3}>标题文本</Typography.Title>");
    expect(code).toContain("<Typography.Text>正文文本</Typography.Text>");
    expect(code).toContain("<Card title=\"卡片标题\""); // props 输出
  });

  it("水平容器 + 间距枚举映射 + MtStatusTag/MtEmptyState import", () => {
    let doc = createEmptyDoc("RowCard");
    const row = createNode("div");
    doc = addNode(doc, doc.root.id, row);
    const rowId = doc.root.children[0].id;
    const tag = createNode("statusTag");
    const empty = createNode("empty");
    doc = addNode(doc, rowId, tag);
    doc = addNode(doc, rowId, empty);
    doc = updateNodeProps(doc, rowId, { direction: "horizontal", gap: "lg", padding: "none" });

    const code = schemaToCode(doc);
    expect(code).toContain("flexDirection: \"row\"");
    expect(code).toContain("gap: tokens.spacing.l");
    expect(code).toContain('style={{ display: "flex", flexDirection: "row", gap: tokens.spacing.l }}'); // padding none → 该容器无 padding 键
    expect(code).toContain("import { MtEmptyState, MtStatusTag } from \"@mt/ui\"");
    expect(code).toContain("<MtStatusTag tone=\"info\" emphasis=\"soft\">状态</MtStatusTag>");
  });

  it("布尔与数字 props 用花括号；AntD Button type", () => {
    let doc = createEmptyDoc("BtnCard");
    const btn = createNode("button");
    doc = addNode(doc, doc.root.id, btn);
    doc = updateNodeProps(doc, doc.root.children[0].id, { children: "提交", type: "primary", block: true });

    const code = schemaToCode(doc);
    expect(code).toContain("<Button type=\"primary\" block={true}>提交</Button>");
  });

  it("未用到的组件不产生 import（两组件树）", () => {
    let doc = createEmptyDoc("OnlyTitle");
    doc = addNode(doc, doc.root.id, createNode("title"));
    const code = schemaToCode(doc);
    expect(code).toContain("import { Typography } from \"antd\"");
    expect(code).not.toContain("Card");
    expect(code).not.toContain("MtStatusTag");
  });
});
