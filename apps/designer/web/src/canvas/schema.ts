import { REGISTRY_MAP, metaByComponent } from "./registry";

export type PropValue = string | number | boolean;

export interface CanvasNode {
  id: string;
  type: "container" | "antd" | "mtui";
  component: string;
  props: Record<string, PropValue>;
  children: CanvasNode[];
}

export interface CanvasDoc {
  componentName: string;
  description?: string;
  root: CanvasNode;
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createNode(key: string): CanvasNode {
  const meta = REGISTRY_MAP.get(key);
  if (!meta) throw new Error("未知组件: " + key);
  return {
    id: newId(),
    type: meta.container && meta.component === "div" ? "container" : meta.kind,
    component: meta.component,
    props: { ...meta.defaultProps },
    children: [],
  };
}

export function createEmptyDoc(componentName: string, description?: string): CanvasDoc {
  return {
    componentName,
    description,
    root: createNode("div"),
  };
}

export function findNode(doc: CanvasDoc, id: string): CanvasNode | undefined {
  if (doc.root.id === id) return doc.root;
  const walk = (nodes: CanvasNode[]): CanvasNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const hit = walk(n.children);
      if (hit) return hit;
    }
    return undefined;
  };
  return walk(doc.root.children);
}

export function findParent(doc: CanvasDoc, id: string): CanvasNode | null {
  const walk = (parent: CanvasNode): CanvasNode | null => {
    for (const child of parent.children) {
      if (child.id === id) return parent;
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(doc.root);
}

function isContainer(node: CanvasNode): boolean {
  if (node.children === undefined) return false;
  if (node.component === "div") return true;
  return metaByComponent(node.component)?.container === true;
}

export function isContainerNode(node: CanvasNode): boolean {
  return isContainer(node);
}

function cloneWith(node: CanvasNode, mutate: (n: CanvasNode) => void): CanvasNode {
  const copy: CanvasNode = { ...node, props: { ...node.props }, children: node.children.map((c) => cloneWith(c, mutate)) };
  mutate(copy);
  return copy;
}

export function addNode(doc: CanvasDoc, containerId: string, node: CanvasNode, index?: number): CanvasDoc {
  const target = findNode(doc, containerId);
  if (!target) throw new Error("目标节点不存在: " + containerId);
  if (!isContainer(target)) throw new Error("目标不是 container，无法添加子节点: " + target.component);
  const root = cloneWith(doc.root, (n) => {
    if (n.id === containerId) {
      const at = index === undefined || index < 0 || index > n.children.length ? n.children.length : index;
      n.children.splice(at, 0, cloneWith(node, () => undefined));
    }
  });
  return { ...doc, root };
}

export function removeNode(doc: CanvasDoc, id: string): CanvasDoc {
  if (doc.root.id === id) throw new Error("根节点不可删除");
  const parent = findParent(doc, id);
  if (!parent) throw new Error("节点不存在: " + id);
  const root = cloneWith(doc.root, (n) => {
    if (n.id === parent.id) {
      n.children = n.children.filter((c) => c.id !== id);
    }
  });
  return { ...doc, root };
}

export function moveNode(doc: CanvasDoc, id: string, direction: -1 | 1): CanvasDoc {
  if (doc.root.id === id) throw new Error("根节点不可移动");
  const parent = findParent(doc, id);
  if (!parent) throw new Error("节点不存在: " + id);
  const idx = parent.children.findIndex((c) => c.id === id);
  const next = idx + direction;
  if (next < 0 || next >= parent.children.length) return doc;
  const root = cloneWith(doc.root, (n) => {
    if (n.id === parent.id) {
      const [moved] = n.children.splice(idx, 1);
      n.children.splice(next, 0, moved);
    }
  });
  return { ...doc, root };
}

export function duplicateNode(doc: CanvasDoc, id: string): CanvasDoc {
  const parent = findParent(doc, id);
  if (!parent) throw new Error("节点不存在: " + id);
  const idx = parent.children.findIndex((c) => c.id === id);
  const copy = cloneWith(parent.children[idx], () => undefined);
  const reassign = (n: CanvasNode) => {
    n.id = newId();
    n.children.forEach(reassign);
  };
  reassign(copy);
  return addNode(doc, parent.id, copy, idx + 1);
}

export function updateNodeProps(doc: CanvasDoc, id: string, patch: Record<string, PropValue>): CanvasDoc {
  const root = cloneWith(doc.root, (n) => {
    if (n.id === id) n.props = { ...n.props, ...patch };
  });
  return { ...doc, root };
}

export function renameComponent(doc: CanvasDoc, name: string): CanvasDoc {
  return { ...doc, componentName: name };
}

export function setDocDescription(doc: CanvasDoc, description: string): CanvasDoc {
  return { ...doc, description };
}
