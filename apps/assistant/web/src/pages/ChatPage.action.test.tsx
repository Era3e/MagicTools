import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChatPage from "./ChatPage";

describe("ChatPage 动作结果展示", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/api/assistant/chat") && method === "POST") {
        return new Response(
          JSON.stringify({
            sessionId: "c1",
            reply: "已执行动作：create_requirement（ACTION_STUB 桩模式）",
            intent: "process_execution",
            citations: [],
            actionResult: { ok: true, action: "create_requirement", stub: true },
          }),
          { status: 201 }
        );
      }
      if (u.includes("/api/assistant/conversations") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("渲染动作执行结果标签", async () => {
    render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText("输入消息"), { target: { value: "帮我创建一个需求" } });
    fireEvent.click(screen.getByRole("button", { name: /发\s*送/ }));
    expect(await screen.findByText(/已执行动作/)).toBeTruthy();
    expect(screen.getByText(/动作已执行/)).toBeTruthy();
  });
});
