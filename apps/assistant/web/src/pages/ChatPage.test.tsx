import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChatPage from "./ChatPage";

const mkMsg = (role: "user" | "assistant", content: string) => ({
  id: "m" + Math.random().toString(36).slice(2),
  conversationId: "c1",
  role,
  content,
  intent: role === "assistant" ? "product_inquiry" : "",
  citations: [] as Array<{ id: string; title: string; source: string; score: number }>,
  createdAt: "2026-01-01T00:00:00Z",
});

describe("ChatPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/api/assistant/chat") && method === "POST") {
        return new Response(
          JSON.stringify({
            sessionId: "c1",
            reply: "这是基于圈定知识的回答。",
            intent: "product_inquiry",
            citations: [{ id: "e1", title: "苹果公司发布新手机", source: "manual", score: 0.95 }],
          }),
          { status: 201 }
        );
      }
      if (u.includes("/api/assistant/conversations/c1/messages")) {
        return new Response(JSON.stringify([mkMsg("user", "你好"), mkMsg("assistant", "你好呀，有什么可以帮你？")]), { status: 200 });
      }
      if (u.includes("/api/assistant/conversations") && method === "GET") {
        return new Response(JSON.stringify([{ id: "c1", title: "你好", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }]), { status: 200 });
      }
      if (u.includes("/api/assistant/conversations") && method === "DELETE") {
        return new Response(JSON.stringify({ deleted: true }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("发送消息渲染回答气泡与引用卡片", async () => {
    render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText("输入消息"), { target: { value: "苹果公司有什么新动态" } });
    fireEvent.click(screen.getByRole("button", { name: /发\s*送/ }));
    expect(await screen.findByText("这是基于圈定知识的回答。")).toBeTruthy();
    const cite = await screen.findByText("苹果公司发布新手机");
    const link = cite.closest("a");
    expect(link).toBeTruthy();
    expect(link!.getAttribute("href")).toContain("/scholar/entries");
  });

  it("点击会话加载历史消息", async () => {
    render(<ChatPage />);
    fireEvent.click(await screen.findByText("你好"));
    expect(await screen.findByText("你好呀，有什么可以帮你？")).toBeTruthy();
    const msgsCall = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/messages"));
    expect(msgsCall).toContain("/conversations/c1/messages");
  });

  it("删除会话调用 DELETE", async () => {
    render(<ChatPage />);
    fireEvent.click(await screen.findByRole("button", { name: /删\s*除/ }));
    await waitFor(() => {
      const del = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "DELETE");
      expect(del).toBeTruthy();
      expect(String(del![0])).toContain("/api/assistant/conversations/c1");
    });
  });
});
