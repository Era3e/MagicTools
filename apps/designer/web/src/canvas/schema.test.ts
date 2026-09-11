import { describe, expect, it } from "vitest";
import {
  addNode,
  createEmptyDoc,
  createNode,
  findNode,
  findParent,
  moveNode,
  removeNode,
  renameComponent,
  updateNodeProps,
  type CanvasDoc,
} from "./schema";

function seedDoc(): CanvasDoc {
  const doc = createEmptyDoc("DemoCard");
  const card = createNode("card");
  const title = createNode("title");
  title.props = { ...title.props, children: "标题一" };
  const text = createNode("text");
  text.props = { ...text.props, children: "正文内容" };
  let next = addNode(doc, doc.root.id, card);
  const cardId = next.root.children[0].id;
  next = addNode(next, cardId, title);
  next = addNode(next, cardId, text);
  return next;
}

describe("canvas schema 纯函数", () => {
  it("createEmptyDoc 根为 container div 且带画布默认容器样式", () => {
    const doc = createEmptyDoc("MyCard");
    expect(doc.componentName).toBe("MyCard");
    expect(doc.root.type).toBe("container");
    expect(doc.root.component).toBe("div");
    expect(doc.root.children).toEqual([]);
    expect(doc.root.id).toBeTruthy();
  });

  it("createNode 按注册表组件给默认 props 与随机 id", () => {
    const n = createNode("button");
    expect(n.type).toBe("antd");
    expect(n.component).toBe("Button");
    expect(n.props.type).toBe("default");
    expect(n.children).toEqual([]);
    const m = createNode("button");
    expect(m.id).not.toBe(n.id);
  });

  it("findNode 深度查找；findParent 返回父节点", () => {
    const doc = seedDoc();
    const card = doc.root.children[0];
    const title = card.children[0];
    expect(findNode(doc, title.id)?.props.children).toBe("标题一");
    expect(findParent(doc, title.id)?.id).toBe(card.id);
    expect(findParent(doc, doc.root.id)).toBeNull();
    expect(findNode(doc, "nope")).toBeUndefined();
  });

  it("addNode 只允许 container 接收子节点", () => {
    const doc = seedDoc();
    const text = doc.root.children[0].children[1];
    expect(() => addNode(doc, text.id, createNode("button"))).toThrow(/container/i);
  });

  it("addNode 支持 index 插入且不可变", () => {
    const doc = seedDoc();
    const cardId = doc.root.children[0].id;
    const before = JSON.stringify(doc);
    const next = addNode(doc, cardId, createNode("button"), 0);
    expect(JSON.stringify(doc)).toBe(before);
    const card = next.root.children[0];
    expect(card.children).toHaveLength(3);
    expect(card.children[0].component).toBe("Button");
    expect(card.children[1].props.children).toBe("标题一");
  });

  it("removeNode 根不可删；子节点删除返回新 doc", () => {
    const doc = seedDoc();
    expect(() => removeNode(doc, doc.root.id)).toThrow(/根节点/);
    const textId = doc.root.children[0].children[1].id;
    const next = removeNode(doc, textId);
    expect(next.root.children[0].children).toHaveLength(1);
    expect(findNode(next, textId)).toBeUndefined();
  });

  it("moveNode 容器内上下移且越界不动", () => {
    const doc = seedDoc();
    const textId = doc.root.children[0].children[1].id;
    const up = moveNode(doc, textId, -1);
    const card = up.root.children[0];
    expect(card.children.map((c) => c.component)).toEqual(["Typography.Text", "Typography.Title"]);
    const again = moveNode(up, card.children[0].id, -1);
    expect(again.root.children[0].children.map((c) => c.component)).toEqual(["Typography.Text", "Typography.Title"]);
    expect(() => moveNode(doc, doc.root.id, 1)).toThrow(/根节点/);
  });

  it("updateNodeProps 局部覆盖且不可变", () => {
    const doc = seedDoc();
    const titleId = doc.root.children[0].children[0].id;
    const next = updateNodeProps(doc, titleId, { children: "新标题", level: 2 });
    const t = findNode(next, titleId);
    expect(t?.props.children).toBe("新标题");
    expect(t?.props.level).toBe(2);
    expect(findNode(doc, titleId)?.props.children).toBe("标题一");
  });

  it("renameComponent 更新名称", () => {
    const next = renameComponent(seedDoc(), "HeroCard");
    expect(next.componentName).toBe("HeroCard");
  });
});
