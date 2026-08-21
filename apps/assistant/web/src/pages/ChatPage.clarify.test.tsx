import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChatPage from "./ChatPage";

describe("ChatPage 澄清选项", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/api/assistant/chat") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        if (body.message === "1" || body.message === "process_execution") {
          return new Response(
            JSON.stringify({
              sessionId: "c1",
              reply: "已执行动作：create_requirement（ACTION_STUB 桩模式）",
              intent: "process_execution",
              clarifying: false,
              citations: [],
              actionResult: { ok: true, action: "create_requirement", stub: true },
            }),
            { status: 201 }
          );
        }
        return new Response(
          JSON.stringify({
            sessionId: "c1",
            reply: "我不太确定你的意思，请选择：\n1. 创建需求或触发采集\n2. 数据查询 / cybercloud 域操作",
            intent: "process_execution",
            clarifying: true,
            clarifyOptions: [
              { label: "1. 创建需求或触发采集", intent: "process_execution" },
              { label: "2. 数据查询 / cybercloud 域操作", intent: "data_query" },
            ],
            citations: [],
            actionResult: {},
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

  it("澄清回复渲染选项按钮，点击后发送确认", async () => {
    render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText("输入消息"), { target: { value: "帮我创建一个东西" } });
    fireEvent.click(screen.getByRole("button", { name: /发\s*送/ }));
    const opt = await screen.findByRole("button", { name: /创建需求或触发采集/ });
    expect(opt).toBeTruthy();
    fireEvent.click(opt);
    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST" && String(c[0]).includes("/chat"));
      expect(posts.length).toBe(2);
      const body = JSON.parse(String((posts[1][1] as RequestInit).body));
      expect(body.message).toBe("process_execution");
    });
    expect(await screen.findByText(/已执行动作/)).toBeTruthy();
  });
});
