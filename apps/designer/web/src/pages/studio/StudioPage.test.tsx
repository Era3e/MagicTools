import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioPage from "./StudioPage";
import { api } from "../../api";

vi.mock("../../api", () => ({
  api: {
    parseCode: vi.fn(),
    preview: vi.fn(),
    addComponent: vi.fn(),
    previewUrl: (id: string) => "/api/designer/preview/" + id,
  },
  downloadText: vi.fn(),
}));

const renderPage = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/studio", state }]}>
      <StudioPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.mocked(api.parseCode).mockReset();
  vi.mocked(api.preview).mockReset().mockResolvedValue({ ok: true, previewId: "p1" });
  vi.mocked(api.addComponent).mockReset();
});

afterEach(() => cleanup());

describe("StudioPage 画布工坊", () => {
  it("渲染三栏骨架：palette 分组 + 画布空态 + 属性面板提示", () => {
    renderPage();
    expect(screen.getByText("布局")).toBeTruthy();
    expect(screen.getByText("展示")).toBeTruthy();
    expect(screen.getByText("@mt/ui")).toBeTruthy();
    expect(screen.getByTestId("studio-canvas")).toBeTruthy();
    expect(screen.getByText(/选中节点后在此编辑属性/)).toBeTruthy();
  });

  it("画布 main 是注册的 droppable（data-testid + data-droppable 双锚点，拖拽放置判定依赖）", () => {
    renderPage();
    const canvas = screen.getByTestId("studio-canvas");
    expect(canvas.getAttribute("data-droppable-id")).toBe("canvas-root");
    expect(canvas.textContent).toContain("空画布");
  });

  it("双击 palette 卡片添加到根容器，画布与代码面板同步", async () => {
    renderPage();
    fireEvent.dblClick(screen.getByTestId("palette-card"));
    expect(await screen.findByText("卡片标题", { selector: ".ant-card-head-title" })).toBeTruthy();

    const codeArea = screen.getByTestId("studio-code") as HTMLTextAreaElement;
    expect(codeArea.value).toContain("<Card");
    expect(codeArea.value).toContain("export default function");
  });

  it("选中节点后属性面板联动：改 children 文本画布即变", async () => {
    renderPage();
    fireEvent.dblClick(screen.getByText("标题"));
    expect(await screen.findByText("标题文本")).toBeTruthy();

    fireEvent.click(screen.getByText("标题文本"));
    const input = await screen.findByLabelText("文本");
    fireEvent.change(input, { target: { value: "改过的标题" } });
    expect(await screen.findByText("改过的标题")).toBeTruthy();
  });

  it("节点操作条：删除节点", async () => {
    renderPage();
    fireEvent.dblClick(screen.getByText("标题"));
    expect(await screen.findByText("标题文本")).toBeTruthy();
    fireEvent.click(screen.getByText("标题文本"));
    fireEvent.click(screen.getByRole("button", { name: "删除节点" }));
    await waitFor(() => expect(screen.queryByText("标题文本")).toBeNull());
  });

  it("应用代码成功：doc 更新且未应用徽标清除", async () => {
    vi.mocked(api.parseCode).mockResolvedValue({
      doc: {
        componentName: "EditedCard",
        root: {
          id: "r1",
          type: "container",
          component: "div",
          props: { direction: "vertical", gap: "md", padding: "md" },
          children: [
            { id: "n1", type: "antd", component: "Button", props: { children: "服务端来的按钮", type: "primary", block: false }, children: [] },
          ],
        },
      },
    });
    renderPage();
    const codeArea = screen.getByTestId("studio-code") as HTMLTextAreaElement;
    fireEvent.change(codeArea, { target: { value: "export default function EditedCard() { return <Button>服务端来的按钮</Button>; }" } });
    expect(screen.getByText("未应用")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /应用代码/ }));
    expect(await screen.findByText("服务端来的按钮")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("未应用")).toBeNull());
  });

  it("应用代码失败：提示原因且保留编辑内容", async () => {
    vi.mocked(api.parseCode).mockRejectedValue(new Error("组件不在画布白名单: Statistic"));
    renderPage();
    const codeArea = screen.getByTestId("studio-code") as HTMLTextAreaElement;
    fireEvent.change(codeArea, { target: { value: "bad code" } });
    fireEvent.click(screen.getByRole("button", { name: /应用代码/ }));
    await waitFor(() => expect(screen.getByText(/白名单/)).toBeTruthy());
    expect((screen.getByTestId("studio-code") as HTMLTextAreaElement).value).toBe("bad code");
  });

  it("GeneratePage 跳转携带 doc 时直接装载（location.state）", async () => {
    renderPage({
      doc: {
        componentName: "FromGenerate",
        root: {
          id: "r1",
          type: "container",
          component: "div",
          props: { direction: "vertical", gap: "md", padding: "md" },
          children: [
            { id: "n1", type: "antd", component: "Button", props: { children: "生成页按钮", type: "default", block: false }, children: [] },
          ],
        },
      },
    });
    expect(await screen.findByText("生成页按钮")).toBeTruthy();
  });
});
