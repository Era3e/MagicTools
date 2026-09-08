import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ChatPage, { VERIFY_POLL_MS } from "./ChatPage";

type VerifyStub = { httpStatus?: number; body?: { status: string; verdict?: Record<string, unknown>; agentReply?: string } };

describe("ChatPage 核验标签（verify 轮询）", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let verifyInChat: Record<string, unknown> | undefined;
  let verifyResponses: VerifyStub[];

  beforeEach(() => {
    verifyInChat = undefined;
    verifyResponses = [];
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/api/assistant/chat/verify/") && method === "GET") {
        const stub = verifyResponses.shift() ?? { body: { status: "pending" } };
        if (stub.httpStatus && stub.httpStatus !== 200) {
          return new Response(JSON.stringify({ message: "not found" }), { status: stub.httpStatus });
        }
        return new Response(JSON.stringify(stub.body ?? { status: "pending" }), { status: 200 });
      }
      if (u.includes("/api/assistant/chat") && method === "POST") {
        return new Response(
          JSON.stringify({
            sessionId: "s1",
            reply: "「本月销售额」本月为 12345 元（直连实时查询）",
            intent: "data_query",
            citations: [],
            verify: verifyInChat,
            dataSource: { mode: "dual" },
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

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const verifyCallCount = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("/verify/")).length;

  const send = async () => {
    fireEvent.change(screen.getByPlaceholderText("输入消息"), { target: { value: "本月销售额" } });
    fireEvent.click(screen.getByRole("button", { name: /发\s*送/ }));
    await screen.findByText(/12345 元/);
  };

  it("pending → divergent：标签更新为不一致并展示差值，展开可见智能体原文", async () => {
    verifyInChat = { taskId: "t1", status: "pending" };
    verifyResponses = [
      { body: { status: "pending" } },
      {
        body: {
          status: "divergent",
          verdict: { directValue: 12345, agentNumbers: [99999], diffPct: 710 },
          agentReply: "其实是 99999 元",
        },
      },
    ];
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ChatPage />);
    await send();
    expect(await screen.findByText(/核验中/)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERIFY_POLL_MS);
    });
    expect(screen.getByText(/核验中/)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERIFY_POLL_MS);
    });
    expect(await screen.findByText(/不一致/)).toBeTruthy();
    expect(screen.getByText(/710%/)).toBeTruthy();
    fireEvent.click(screen.getByText(/智能体回答不一致/));
    expect(await screen.findByText(/99999/)).toBeTruthy();
  });

  it("not_applicable（无 taskId）不轮询，直接显示来自智能体标签", async () => {
    verifyInChat = { status: "not_applicable" };
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ChatPage />);
    await send();
    expect(await screen.findByText(/来自智能体 · 直连不适用/)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERIFY_POLL_MS * 3);
    });
    expect(verifyCallCount()).toBe(0);
  });

  it("轮询 404 → 显示智能体超时标签且停止轮询（有限次请求）", async () => {
    verifyInChat = { taskId: "t3", status: "pending" };
    verifyResponses = [{ httpStatus: 404 }];
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ChatPage />);
    await send();
    expect(await screen.findByText(/核验中/)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERIFY_POLL_MS);
    });
    expect(await screen.findByText(/智能体超时/)).toBeTruthy();
    const afterFirst = verifyCallCount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERIFY_POLL_MS * 5);
    });
    expect(verifyCallCount()).toBe(afterFirst);
    expect(afterFirst).toBe(1);
  });
});
