import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ComponentList from "./ComponentList";

describe("ComponentList", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/api/designer/components") && method === "GET") {
        return new Response(
          JSON.stringify([{ id: "c1", name: "CardX", description: "卡片", code: "export default () => null", createdAt: "2026-01-01T00:00:00Z" }]),
          { status: 200 }
        );
      }
      if (u.includes("/api/designer/components") && method === "DELETE") {
        return new Response(JSON.stringify({ deleted: true }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("渲染组件列表", async () => {
    render(<ComponentList />);
    expect(await screen.findByText("CardX")).toBeTruthy();
    expect(screen.getByText("卡片")).toBeTruthy();
  });

  it("删除组件调用 DELETE", async () => {
    render(<ComponentList />);
    fireEvent.click(await screen.findByRole("button", { name: /删\s*除/ }));
    await waitFor(() => {
      const del = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "DELETE");
      expect(del).toBeTruthy();
      expect(String(del![0])).toContain("/api/designer/components/c1");
    });
  });
});
