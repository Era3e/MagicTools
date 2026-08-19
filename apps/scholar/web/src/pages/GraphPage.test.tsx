import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GraphPage from "./GraphPage";

vi.mock("@antv/g6", () => ({
  Graph: class {
    render() {}
    destroy() {}
  },
}));

describe("GraphPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/scholar/graph") && init?.method === "POST") {
        return new Response(JSON.stringify({ entities: 2, relations: 1 }), { status: 201 });
      }
      if (String(url).includes("/api/scholar/graph")) {
        return new Response(
          JSON.stringify({
            nodes: [{ id: "n1", name: "知识库", type: "概念", entryCount: 2 }],
            edges: [],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("加载图谱数据并渲染节点", async () => {
    render(<GraphPage />);
    expect(await screen.findByText("知识库")).toBeTruthy();
    expect(screen.getByText(/实体 1/)).toBeTruthy();
  });

  it("生成图谱调用 POST 并刷新", async () => {
    render(<GraphPage />);
    fireEvent.click(await screen.findByText("生成图谱"));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => c[1] && (c[1] as RequestInit).method === "POST");
      expect(post).toBeTruthy();
      expect(String(post![0])).toContain("/api/scholar/graph/generate");
    });
  });
});
