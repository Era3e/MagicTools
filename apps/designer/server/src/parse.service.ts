import { BadRequestException, Injectable } from "@nestjs/common";
import { parse } from "@babel/parser";
import { randomUUID } from "node:crypto";

type PropValue = string | number | boolean;

interface ParsedNode {
  id: string;
  type: "container" | "antd" | "mtui";
  component: string;
  props: Record<string, PropValue>;
  children: ParsedNode[];
}

interface ParsedDoc {
  componentName: string;
  root: ParsedNode;
}

const KNOWN: Record<string, { container: boolean; kind: ParsedNode["type"]; props: string[] }> = {
  div: { container: true, kind: "container", props: ["direction", "gap", "padding"] },
  Card: { container: true, kind: "antd", props: ["title", "direction", "gap"] },
  "Typography.Title": { container: false, kind: "antd", props: ["children", "level"] },
  "Typography.Text": { container: false, kind: "antd", props: ["children", "strong"] },
  "Typography.Paragraph": { container: false, kind: "antd", props: ["children"] },
  Button: { container: false, kind: "antd", props: ["children", "type", "block"] },
  MtStatusTag: { container: false, kind: "mtui", props: ["children", "tone", "emphasis", "mono"] },
  MtEmptyState: { container: false, kind: "mtui", props: ["title", "description"] },
};

const SPACING_TO_ENUM: Record<string, string> = { s: "sm", m: "md", l: "lg" };
const ENUM_TO_SPACING: Record<string, string> = { sm: "s", md: "m", lg: "l" };

function fail(reason: string, line?: number): never {
  throw new BadRequestException({ error: "parse_failed", reason, line });
}

type AnyNode = ReturnType<typeof parse>["program"]["body"][number];

function findDefaultExport(body: AnyNode[]): { name: string; node: Extract<AnyNode, { type: "ExportDefaultDeclaration" }> } | null {
  for (const stmt of body) {
    if (stmt.type === "ExportDefaultDeclaration" && stmt.declaration.type === "FunctionDeclaration" && stmt.declaration.id) {
      return { name: stmt.declaration.id.name, node: stmt };
    }
  }
  return null;
}

export function parseComponentCode(code: string): ParsedDoc {
  if (!code || !code.trim()) fail("代码为空");
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx", "typescript"] });
  } catch (err) {
    const e = err as { message?: string; loc?: { line: number } };
    fail("语法错误: " + (e.message ?? String(err)), e.loc?.line);
  }

  const def = findDefaultExport(ast.program.body as AnyNode[]);
  if (!def) fail("未找到 default export 的具名函数组件声明");

  const fn = def.node.declaration as Extract<AnyNode, { type: "FunctionDeclaration" }>;
  const bodyStmt = fn.body.body.find((s) => s.type === "ReturnStatement") as Extract<AnyNode, { type: "ReturnStatement" }> | undefined;
  if (!bodyStmt || !bodyStmt.argument) fail("函数体无 return");
  const rootExpr = bodyStmt.argument;
  if (rootExpr.type !== "JSXElement") fail("return 不是 JSX 元素");

  const parsedRoot = parseJsxElement(rootExpr as never);
  const root: ParsedNode =
    parsedRoot.component === "div"
      ? parsedRoot
      : {
          id: randomUUID(),
          type: "container",
          component: "div",
          props: defaultsFor("div"),
          children: [parsedRoot],
        };
  return { componentName: def.name, root };
}

import type { JSXElement, JSXAttribute, JSXExpressionContainer, ObjectProperty, ObjectExpression } from "@babel/types";

function parseJsxAttr(attr: JSXAttribute): [string, PropValue] {
  if (attr.name.type !== "JSXIdentifier") fail("不支持展开属性", attr.name.loc?.start.line);
  const name = attr.name.name;
  if (attr.value == null) return [name, true];
  if (attr.value.type === "StringLiteral") return [name, attr.value.value];
  if (attr.value.type === "JSXExpressionContainer") {
    const expr = attr.value.expression;
    if (expr.type === "StringLiteral") return [name, expr.value];
    if (expr.type === "NumericLiteral") return [name, expr.value];
    if (expr.type === "BooleanLiteral") return [name, expr.value];
  }
  fail(`属性 ${name} 的值不是字面量`, attr.value.loc?.start.line);
}

function spacingExprToEnum(node: ObjectExpression["properties"][number], key: string): PropValue {
  const prop = node as ObjectProperty;
  if (prop.type !== "ObjectProperty") fail(`style.${key} 不是普通属性`, prop.loc?.start.line);
  const v = prop.value;
  // tokens.spacing.m → MemberExpression(MemberExpression(Identifier(tokens), spacing), m)
  if (
    v.type === "MemberExpression" &&
    v.property.type === "Identifier" &&
    v.object.type === "MemberExpression" &&
    v.object.object.type === "Identifier" &&
    v.object.object.name === "tokens" &&
    v.object.property.type === "Identifier" &&
    v.object.property.name === "spacing"
  ) {
    const token = v.property.name;
    const mapped = SPACING_TO_ENUM[token];
    if (mapped) return mapped;
  }
  fail(`style.${key} 的值不在支持的枚举内`, prop.loc?.start.line);
}

function parseStyleAttr(expr: JSXExpressionContainer["expression"]): Record<string, PropValue> {
  if (expr.type !== "ObjectExpression") fail("style 必须是对象字面量", expr.loc?.start.line);
  const out: Record<string, PropValue> = {};
  const seen = new Set<string>();
  for (const p of expr.properties) {
    if (p.type !== "ObjectProperty" || p.key.type !== "Identifier") fail("style 含不支持的属性形式", p.loc?.start.line);
    const key = p.key.name;
    seen.add(key);
    if (key === "display") {
      const v = p.value as ObjectProperty["value"];
      if (v.type === "StringLiteral" && v.value === "flex") continue;
      fail("style.display 仅支持 flex", p.loc?.start.line);
    }
    if (key === "flexDirection") {
      const v = p.value as ObjectProperty["value"];
      if (v.type === "StringLiteral" && (v.value === "row" || v.value === "column")) {
        out.direction = v.value === "row" ? "horizontal" : "vertical";
        continue;
      }
      fail("style.flexDirection 值不合法", p.loc?.start.line);
    }
    if (key === "gap" || key === "padding") {
      out[key] = spacingExprToEnum(p, key);
      continue;
    }
    fail(`style 含不支持的键: ${key}`, p.loc?.start.line);
  }
  if (!seen.has("display")) fail("style 缺少 display: flex");
  if (!("gap" in out)) out.gap = "none";
  if (!("padding" in out)) out.padding = "none";
  return out;
}

function textOfChildren(children: import("@babel/types").JSXElement["children"]): { text: string; elements: import("@babel/types").JSXElement[] } {
  const textParts: string[] = [];
  const elements: import("@babel/types").JSXElement[] = [];
  for (const c of children) {
    if (c.type === "JSXText") {
      const t = c.value.replace(/\s+/g, " ").trim();
      if (t) textParts.push(t);
    } else if (c.type === "JSXElement") {
      elements.push(c);
    } else if (c.type === "JSXExpressionContainer") {
      if (c.expression.type === "JSXEmptyExpression") continue;
      fail("子节点含表达式容器（仅支持文本与元素）", c.loc?.start.line);
    }
  }
  if (textParts.length > 0 && elements.length > 0) fail("子节点混用文本与元素");
  return { text: textParts.join(" "), elements };
}

function parseJsxElement(el: JSXElement): ParsedNode {
  const nameNode = el.openingElement.name;
  if (nameNode.type !== "JSXMemberExpression" && nameNode.type !== "JSXIdentifier") {
    fail("仅支持 JSX 标识符/成员表达式组件", nameNode.loc?.start.line);
  }
  const name =
    nameNode.type === "JSXIdentifier"
      ? nameNode.name
      : nameNode.object.type === "JSXIdentifier"
        ? `${nameNode.object.name}.${nameNode.property.name}`
        : "";
  const meta = KNOWN[name];
  if (!meta) fail(`组件不在画布白名单: ${name}`, nameNode.loc?.start.line);

  const props: Record<string, PropValue> = { ...defaultsFor(name) };
  let styleProps: Record<string, PropValue> = {};
  for (const attr of el.openingElement.attributes) {
    if (attr.type !== "JSXAttribute") fail("不支持展开属性", attr.loc?.start.line);
    if (attr.name.name === "style") {
      if (attr.value?.type !== "JSXExpressionContainer") fail("style 必须是表达式容器", attr.loc?.start.line);
      styleProps = parseStyleAttr(attr.value.expression);
      continue;
    }
    const [k, v] = parseJsxAttr(attr);
    if (!meta.props.includes(k)) fail(`组件 ${name} 不支持属性 ${k}`, attr.loc?.start.line);
    props[k] = v;
  }
  if (meta.container) Object.assign(props, styleProps);

  const { text, elements } = textOfChildren(el.children);
  if (meta.container) {
    if (text) fail(`容器 ${name} 不支持文本子节点`);
    return {
      id: randomUUID(),
      type: meta.kind,
      component: name,
      props,
      children: elements.map(parseJsxElement),
    };
  }
  if (elements.length > 0) fail(`非容器组件 ${name} 不支持元素子节点`);
  if (text) props.children = text;
  return { id: randomUUID(), type: meta.kind, component: name, props, children: [] };
}

function defaultsFor(name: string): Record<string, PropValue> {
  const d: Record<string, Record<string, PropValue>> = {
    div: { direction: "vertical", gap: "md", padding: "md" },
    Card: { title: "卡片标题", direction: "vertical", gap: "sm" },
    "Typography.Title": { children: "", level: 3 },
    "Typography.Text": { children: "", strong: false },
    "Typography.Paragraph": { children: "" },
    Button: { children: "", type: "default", block: false },
    MtStatusTag: { children: "", tone: "info", emphasis: "soft", mono: false },
    MtEmptyState: { title: "", description: "" },
  };
  return { ...d[name] };
}

@Injectable()
export class ParseService {
  parse(input: unknown): { doc: ParsedDoc } {
    const code = typeof (input as { code?: unknown })?.code === "string" ? (input as { code: string }).code : "";
    return { doc: parseComponentCode(code) };
  }
}

export { ENUM_TO_SPACING };
export type { ParsedDoc, ParsedNode, PropValue };
