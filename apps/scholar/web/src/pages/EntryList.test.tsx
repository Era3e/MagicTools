import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EntryList from "./EntryList";

const entry = (id: string, title: string) => ({
  id,
  source: "manual",
  sourceRef: null,
  title,
  content: "",
  summary: "",
  category: "",
  tags: [] as string[],
  assistantScope: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("EntryList", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/scholar/entries") && !init?.method) {
        return new Response(JSON.stringify([entry("e1", "条目甲"), entry("e2", "条目乙")]), { status: 200 });
      }
      if (String(url).includes("/api/scholar/entries") && init?.method === "POST") {
        return new Response(JSON.stringify(entry("e3", "条目丙")), { status: 201 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("渲染条目列表", async () => {
    render(<EntryList />);
    expect(await screen.findByText("条目甲")).toBeTruthy();
    expect(screen.getByText("条目乙")).toBeTruthy();
  });

  it("新增条目提交 POST 并刷新", async () => {
    render(<EntryList />);
    fireEvent.click(screen.getByRole("button", { name: "新增条目" }));
    fireEvent.change(screen.getByPlaceholderText("标题"), { target: { value: "新条目" } });
    fireEvent.change(screen.getByPlaceholderText("内容"), { target: { value: "新内容" } });
    fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => c[1] && (c[1] as RequestInit).method === "POST");
      expect(post).toBeTruthy();
      expect(String(post![0])).toContain("/api/scholar/entries");
      const body = JSON.parse(String((post![1] as RequestInit).body));
      expect(body.title).toBe("新条目");
    });
  });
});
