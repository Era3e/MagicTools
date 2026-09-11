import type { PropValue } from "./schema";

export type PropFieldType = "text" | "number" | "boolean" | "select";

export interface PropField {
  name: string;
  label: string;
  type: PropFieldType;
  options?: { label: string; value: string }[];
}

export interface ComponentMeta {
  key: string;
  label: string;
  group: "布局" | "展示" | "交互" | "@mt/ui";
  component: string;
  kind: "container" | "antd" | "mtui";
  container: boolean;
  defaultProps: Record<string, PropValue>;
  propFields: PropField[];
}

const SPACING_OPTIONS = [
  { label: "无", value: "none" },
  { label: "小", value: "sm" },
  { label: "中", value: "md" },
  { label: "大", value: "lg" },
];

export const REGISTRY: ComponentMeta[] = [
  {
    key: "div",
    label: "容器",
    group: "布局",
    component: "div",
    kind: "container",
    container: true,
    defaultProps: { direction: "vertical", gap: "md", padding: "md" },
    propFields: [
      { name: "direction", label: "排列方向", type: "select", options: [{ label: "纵向", value: "vertical" }, { label: "横向", value: "horizontal" }] },
      { name: "gap", label: "子项间距", type: "select", options: SPACING_OPTIONS },
      { name: "padding", label: "内边距", type: "select", options: SPACING_OPTIONS },
    ],
  },
  {
    key: "card",
    label: "卡片容器",
    group: "布局",
    component: "Card",
    kind: "antd",
    container: true,
    defaultProps: { title: "卡片标题", direction: "vertical", gap: "sm", padding: "none" },
    propFields: [
      { name: "title", label: "卡片标题", type: "text" },
      { name: "direction", label: "排列方向", type: "select", options: [{ label: "纵向", value: "vertical" }, { label: "横向", value: "horizontal" }] },
      { name: "gap", label: "子项间距", type: "select", options: SPACING_OPTIONS },
    ],
  },
  {
    key: "title",
    label: "标题",
    group: "展示",
    component: "Typography.Title",
    kind: "antd",
    container: false,
    defaultProps: { children: "标题文本", level: 3 },
    propFields: [
      { name: "children", label: "文本", type: "text" },
      { name: "level", label: "层级", type: "select", options: [1, 2, 3, 4].map((n) => ({ label: "H" + n, value: String(n) })) },
    ],
  },
  {
    key: "text",
    label: "行内文本",
    group: "展示",
    component: "Typography.Text",
    kind: "antd",
    container: false,
    defaultProps: { children: "正文文本", strong: false },
    propFields: [
      { name: "children", label: "文本", type: "text" },
      { name: "strong", label: "加粗", type: "boolean" },
    ],
  },
  {
    key: "paragraph",
    label: "段落",
    group: "展示",
    component: "Typography.Paragraph",
    kind: "antd",
    container: false,
    defaultProps: { children: "段落文本，可以写长一点的说明内容。" },
    propFields: [{ name: "children", label: "文本", type: "text" }],
  },
  {
    key: "statusTag",
    label: "状态标签",
    group: "@mt/ui",
    component: "MtStatusTag",
    kind: "mtui",
    container: false,
    defaultProps: { children: "状态", tone: "info", emphasis: "soft", mono: false },
    propFields: [
      { name: "children", label: "文本", type: "text" },
      { name: "tone", label: "语义色", type: "select", options: ["neutral", "success", "warning", "error", "info", "accent"].map((v) => ({ label: v, value: v })) },
      { name: "emphasis", label: "强调", type: "select", options: [{ label: "soft", value: "soft" }, { label: "solid", value: "solid" }] },
      { name: "mono", label: "等宽", type: "boolean" },
    ],
  },
  {
    key: "empty",
    label: "空状态",
    group: "@mt/ui",
    component: "MtEmptyState",
    kind: "mtui",
    container: false,
    defaultProps: { title: "暂无数据", description: "这里还没有内容" },
    propFields: [
      { name: "title", label: "主文案", type: "text" },
      { name: "description", label: "说明", type: "text" },
    ],
  },
  {
    key: "button",
    label: "按钮",
    group: "交互",
    component: "Button",
    kind: "antd",
    container: false,
    defaultProps: { children: "按钮", type: "default", block: false },
    propFields: [
      { name: "children", label: "文本", type: "text" },
      { name: "type", label: "类型", type: "select", options: ["primary", "default", "dashed", "text"].map((v) => ({ label: v, value: v })) },
      { name: "block", label: "占满一行", type: "boolean" },
    ],
  },
];

export const REGISTRY_MAP: ReadonlyMap<string, ComponentMeta> = new Map(REGISTRY.map((m) => [m.key, m]));

export const PALETTE_GROUPS: ComponentMeta["group"][] = ["布局", "展示", "交互", "@mt/ui"];

export function metaByComponent(component: string): ComponentMeta | undefined {
  return REGISTRY.find((m) => m.component === component);
}
