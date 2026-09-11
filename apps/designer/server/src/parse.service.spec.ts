import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { parseComponentCode } from "./parse.service";

type ParseErr = { reason: string; line?: number };

function catchParse(code: string): ParseErr {
  try {
    parseComponentCode(code);
  } catch (err) {
    if (err instanceof BadRequestException) {
      const res = err.getResponse() as ParseErr;
      return res;
    }
    throw err;
  }
  throw new Error("应抛出 BadRequestException");
}

const VALID = `import { Card, Typography, Button } from "antd";
import { tokens } from "@mt/ui";

export default function HeroCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.m, padding: tokens.spacing.m }}>
      <Card title="卡片标题">
        <Typography.Title level={3}>标题文本</Typography.Title>
        <Typography.Text strong={true}>正文</Typography.Text>
        <Button type="primary">按钮</Button>
      </Card>
    </div>
  );
}
`;

describe("parseComponentCode", () => {
  it("合法白名单代码逆向为 CanvasDoc", () => {
    let doc: ReturnType<typeof parseComponentCode> | null = null;
    let thrown: ParseErr | null = null;
    try {
      doc = parseComponentCode(VALID);
    } catch (err) {
      thrown = err instanceof BadRequestException ? (err.getResponse() as ParseErr) : null;
    }
    if (thrown) {
      expect(thrown.reason, "合法代码不应被拒绝: " + JSON.stringify(thrown)).toBeUndefined();
    }
    expect(doc).not.toBeNull();
    expect(doc!.componentName).toBe("HeroCard");
    expect(doc!.root.component).toBe("div");
    expect(doc!.root.props.direction).toBe("vertical");
    expect(doc!.root.props.gap).toBe("md");
    const card = doc!.root.children[0];
    expect(card.component).toBe("Card");
    expect(card.props.title).toBe("卡片标题");
    expect(card.children).toHaveLength(3);
    expect(card.children[0].props.level).toBe(3);
    expect(card.children[0].props.children).toBe("标题文本");
    expect(card.children[1].props.strong).toBe(true);
    expect(card.children[2].component).toBe("Button");
  });

  it("水平容器 + 无 padding 还原", () => {
    let doc: ReturnType<typeof parseComponentCode> | null = null;
    let thrown: ParseErr | null = null;
    try {
      doc = parseComponentCode(`import { tokens } from "@mt/ui";
export default function R() {
  return <div style={{ display: "flex", flexDirection: "row", gap: tokens.spacing.l }} />;
}`);
    } catch (err) {
      thrown = err instanceof BadRequestException ? (err.getResponse() as ParseErr) : null;
    }
    if (thrown) {
      expect(thrown.reason, "合法代码不应被拒绝: " + JSON.stringify(thrown)).toBeUndefined();
    }
    expect(doc).not.toBeNull();
    expect(doc!.root.props.direction).toBe("horizontal");
    expect(doc!.root.props.gap).toBe("lg");
    expect(doc!.root.props.padding).toBe("none");
  });

  it("未知组件拒绝并指明行号", () => {
    const e = catchParse(`import { Statistic } from "antd";
export default function R() {
  return <Statistic title="x" value={1} />;
}`);
    expect(e.reason).toContain("Statistic");
    expect(typeof e.line).toBe("number");
  });

  it("任意 style 键拒绝", () => {
    const e = catchParse(`export default function R() {
  return <div style={{ display: "flex", flexDirection: "column", color: "red" }} />;
}`);
    expect(e.reason).toContain("color");
  });

  it("非字面量 props 拒绝（模板表达式）", () => {
    const e = catchParse(`export default function R() {
  return <Button disabled={count > 0}>x</Button>;
}`);
    expect(e.reason).toBeTruthy();
  });

  it("非 default export 函数拒绝", () => {
    const e = catchParse(`export const R = () => <div />;
export default R;`);
    expect(e.reason).toContain("default export");
  });

  it("语法错误拒绝并带行号", () => {
    const e = catchParse("export default function {{{");
    expect(e.reason).toBeTruthy();
  });

  it("MtStatusTag 白名单组件可解析", () => {
    let doc: ReturnType<typeof parseComponentCode> | null = null;
    let thrown: ParseErr | null = null;
    try {
      doc = parseComponentCode(`export default function T() {
  return <MtStatusTag tone="error" emphasis="solid">失败</MtStatusTag>;
}`);
    } catch (err) {
      thrown = err instanceof BadRequestException ? (err.getResponse() as ParseErr) : null;
    }
    if (thrown) {
      expect(thrown.reason, "合法代码不应被拒绝: " + JSON.stringify(thrown)).toBeUndefined();
    }
    expect(doc).not.toBeNull();
    const tag = doc!.root.children[0];
    expect(tag.component).toBe("MtStatusTag");
    expect(tag.props.tone).toBe("error");
    expect(tag.props.emphasis).toBe("solid");
    expect(tag.props.children).toBe("失败");
  });
});
