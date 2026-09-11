import type { CanvasDoc, CanvasNode, PropValue } from "./schema";
import { metaByComponent } from "./registry";

const SPACING_MAP: Record<string, string> = { sm: "s", md: "m", lg: "l" };

const MTUI_COMPONENTS = new Set(["MtStatusTag", "MtEmptyState"]);

const CONTAINER_PROP_KEYS = new Set(["direction", "gap", "padding"]);

function needTokens(doc: CanvasDoc): boolean {
  const walk = (n: CanvasNode): boolean => {
    const isFlexContainer = n.component === "div" || metaByComponent(n.component)?.container === true;
    if (isFlexContainer && (n.props.gap !== "none" || n.props.padding !== "none")) return true;
    return n.children.some(walk);
  };
  return walk(doc.root);
}

function collectImports(doc: CanvasDoc): string[] {
  const antd = new Set<string>();
  const mtui = new Set<string>();
  const walk = (n: CanvasNode) => {
    if (n.component === "div") {
      // no import
    } else if (MTUI_COMPONENTS.has(n.component)) {
      mtui.add(n.component);
    } else if (n.component.startsWith("Typography.")) {
      antd.add("Typography");
    } else {
      antd.add(n.component);
    }
    n.children.forEach(walk);
  };
  walk(doc.root);
  const lines: string[] = [];
  if (antd.size > 0) lines.push(`import { [...Array.from(antd)].sort().join(", ") } from "antd";`.replace("[...Array.from(antd)].sort().join(\", \")", Array.from(antd).sort().join(", ")));
  if (mtui.size > 0) lines.push(`import { [...Array.from(mtui)].sort().join(", ") } from "@mt/ui";`.replace("[...Array.from(mtui)].sort().join(\", \")", Array.from(mtui).sort().join(", ")));
  if (needTokens(doc)) lines.push("import { tokens } from \"@mt/ui\";");
  return lines;
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

function propValueLiteral(value: PropValue): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return `{${value}}`;
  return `{${value}}`;
}

function containerStyleExpr(node: CanvasNode): string {
  const parts: string[] = ['display: "flex"'];
  parts.push(`flexDirection: ${node.props.direction === "horizontal" ? '"row"' : '"column"'}`);
  if (node.props.gap && node.props.gap !== "none") parts.push(`gap: tokens.spacing.${SPACING_MAP[String(node.props.gap)] ?? "m"}`);
  if (node.props.padding && node.props.padding !== "none") parts.push(`padding: tokens.spacing.${SPACING_MAP[String(node.props.padding)] ?? "m"}`);
  return `{{ ${parts.join(", ")} }}`;
}

function renderNode(node: CanvasNode, depth: number): string {
  const pad = indent(depth);
  const meta = metaByComponent(node.component);
  const isContainer = node.component === "div" || meta?.container === true;
  const attrs: string[] = [];
  for (const [key, value] of Object.entries(node.props)) {
    if (value === undefined) continue;
    if (typeof value === "boolean" && !value) continue;
    if (isContainer && CONTAINER_PROP_KEYS.has(key)) continue;
    if (key === "children") continue;
    attrs.push(`${key}=${propValueLiteral(value)}`);
  }
  if (isContainer) attrs.push(`style=${containerStyleExpr(node)}`);

  const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
  const tag = node.component;

  if (isContainer) {
    if (node.children.length === 0) return `${pad}<${tag}${attrStr} />`;
    const inner = node.children.map((c) => renderNode(c, depth + 1)).join("\n");
    return `${pad}<${tag}${attrStr}>\n${inner}\n${pad}</${tag}>`;
  }

  const children = String(node.props.children ?? "");
  if (!children) return `${pad}<${tag}${attrStr} />`;
  return `${pad}<${tag}${attrStr}>${children}</${tag}>`;
}

export function schemaToCode(doc: CanvasDoc): string {
  const imports = collectImports(doc);
  const name = doc.componentName || "CanvasComponent";
  const body = renderNode(doc.root, 1);
  const lines = [
    ...imports,
    "",
    `export default function ${name}() {`,
    "  return (",
    body,
    "  );",
    "}",
    "",
  ];
  return lines.join("\n");
}

export type { CanvasDoc };
