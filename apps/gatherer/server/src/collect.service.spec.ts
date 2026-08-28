/**
 * D-12 Gatherer 死信队列 — CollectService 单元测试
 *
 * 覆盖场景：
 *   1. 首次采集成功 → 直接返回结果，无重试
 *   2. 首次失败 + 重试成功 → 返回成功结果
 *   3. 全部重试耗尽 → 标记 dead + 发告警 + 抛 BadGatewayException
 *   4. 死信告警 → 通过 outbox 发出 gatherer.collect.dead_letter 事件
 *   5. 第 3 次重试成功 → 重试次数 ≤ MAX_ATTEMPTS-1，不触发告警
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockGetSource,
  mockTouchRun,
  mockStartRun,
  mockFinishRun,
  mockMarkRunDead,
  mockIncrementRunAttempt,
  mockAppendOutbox,
} = vi.hoisted(() => ({
  mockGetSource: vi.fn(),
  mockTouchRun: vi.fn(),
  mockStartRun: vi.fn(),
  mockFinishRun: vi.fn(),
  mockMarkRunDead: vi.fn(),
  mockIncrementRunAttempt: vi.fn(),
  mockAppendOutbox: vi.fn(),
}));

vi.mock("./source.repo", () => ({
  getSource: mockGetSource,
  touchRun: mockTouchRun,
}));

vi.mock("./item.repo", () => ({
  startRun: mockStartRun,
  finishRun: mockFinishRun,
  upsertItem: vi.fn().mockResolvedValue(true),
  listItems: vi.fn().mockResolvedValue([]),
  markPushed: vi.fn().mockResolvedValue(undefined),
  markRunDead: mockMarkRunDead,
  incrementRunAttempt: mockIncrementRunAttempt,
}));

vi.mock("@mt/db", () => ({
  appendOutbox: mockAppendOutbox,
}));

vi.mock("@mt/model-client", () => ({
  parseJson: vi.fn().mockReturnValue({ summary: "测试摘要", category: "科技", keywords: ["AI"] }),
}));

vi.mock("@mt/utils", () => ({
  contentFingerprint: vi.fn().mockReturnValue("fp-123"),
  idempotencyKey: vi.fn().mockReturnValue("idem-001"),
}));

vi.mock("./feed/parser", () => ({
  parseFeed: vi.fn(),
}));

vi.mock("./llm", () => ({
  llmChat: vi.fn().mockResolvedValue('{"summary":"测试","category":"科技","keywords":["AI"]}'),
}));

vi.mock("./schemas", () => ({
  enrichSchema: { parse: vi.fn().mockReturnValue({ summary: "测试", category: "科技", keywords: ["AI"] }) },
}));

vi.mock("./db", () => ({
  pool: {},
}));

import { parseFeed } from "./feed/parser";
import { CollectService } from "./collect.service";

const MOCK_SOURCE = {
  id: "src-1",
  type: "rss" as const,
  url: "https://example.com/feed.xml",
  options: {},
};

const MOCK_ITEMS = [
  { url: "https://example.com/1", title: "文章一", content: "内容一", publishedAt: new Date().toISOString() },
  { url: "https://example.com/2", title: "文章二", content: "内容二", publishedAt: new Date().toISOString() },
];

describe("CollectService — D-12 死信队列", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetSource.mockResolvedValue(MOCK_SOURCE);
    mockStartRun.mockResolvedValue("run-001");
    mockFinishRun.mockResolvedValue(undefined);
    mockTouchRun.mockResolvedValue(undefined);
    mockMarkRunDead.mockResolvedValue(undefined);
    mockAppendOutbox.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 场景 1：首次采集成功 ─────────────────────────────────────────
  it("首次采集成功 → 直接返回结果，无重试", async () => {
    const mockParse = vi.mocked(parseFeed);
    mockParse.mockResolvedValueOnce(MOCK_ITEMS);

    const svc = new CollectService();
    const result = await svc.collect("src-1");

    expect(result.fetched).toBe(2);
    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(mockMarkRunDead).not.toHaveBeenCalled();
    expect(mockAppendOutbox).not.toHaveBeenCalled();
  });

  // ── 场景 2：首次失败 + 重试成功 ─────────────────────────────────
  it("首次失败 + 重试成功 → 返回成功结果", async () => {
    const mockParse = vi.mocked(parseFeed);
    mockParse
      .mockRejectedValueOnce(new Error("网络超时"))
      .mockResolvedValueOnce(MOCK_ITEMS);

    const svc = new CollectService();
    // 让所有定时器立即触发（await 处理 async 定时器）
    const collectPromise = svc.collect("src-1");
    await vi.runAllTimersAsync();
    const result = await collectPromise;

    expect(result.fetched).toBe(2);
    // 1 次原始调用 + 1 次重试
    expect(mockParse).toHaveBeenCalledTimes(2);
    expect(mockMarkRunDead).not.toHaveBeenCalled();
  });

  // ── 场景 3：全部重试耗尽 → 标 dead + 抛异常 ────────────────────
  it("全部重试耗尽 → 标记 dead + 发告警 + 抛 BadGatewayException", async () => {
    const mockParse = vi.mocked(parseFeed);
    mockParse.mockRejectedValue(new Error("持续失败"));

    const svc = new CollectService();
    // 用 .catch() 立即消费 rejection，避免 Vitest 未处理警告
    let caughtErr: unknown;
    const collectPromise = svc.collect("src-1").catch((e: unknown) => { caughtErr = e; });
    await vi.runAllTimersAsync();
    await collectPromise; // 此 promise 已被 catch 转为 resolved

    expect(caughtErr).toBeInstanceOf(Error);
    expect(String(caughtErr)).toMatch(/采集失败.*已重试 5 次/);

    // 1 次原始调用 + 4 次重试 = 5 次总计
    expect(mockParse).toHaveBeenCalledTimes(5);
    // 确认标记为 dead — String(new Error("持续失败")) = "Error: 持续失败"
    expect(mockMarkRunDead).toHaveBeenCalledWith("run-001", "Error: 持续失败");
    // 确认告警事件发出
    expect(mockAppendOutbox).toHaveBeenCalled();
  });

  // ── 场景 4：死信告警事件内容验证 ──────────────────────────────
  it("死信告警 → 通过 outbox 发出 gatherer.collect.dead_letter 事件", async () => {
    const mockParse = vi.mocked(parseFeed);
    mockParse.mockRejectedValue(new Error("致命错误"));

    const svc = new CollectService();
    let caughtErr: unknown;
    const collectPromise = svc.collect("src-1").catch((e: unknown) => { caughtErr = e; });
    await vi.runAllTimersAsync();
    await collectPromise;

    expect(caughtErr).toBeInstanceOf(Error);

    expect(mockAppendOutbox).toHaveBeenCalledWith(
      {}, // pool
      expect.objectContaining({
        event: "gatherer.collect.dead_letter",
        source: "gatherer",
        payload: expect.objectContaining({
          sourceId: "src-1",
          runId: "run-001",
          error: "Error: 致命错误",
          maxAttempts: 5,
        }),
      })
    );
  });

  // ── 场景 5：重试成功后不再触发告警 ─────────────────────────────
  it("第 3 次重试成功 → 重试次数 ≤ MAX_ATTEMPTS-1，不触发告警", async () => {
    const mockParse = vi.mocked(parseFeed);
    mockParse
      .mockRejectedValueOnce(new Error("失败1"))
      .mockRejectedValueOnce(new Error("失败2"))
      .mockResolvedValueOnce(MOCK_ITEMS);

    const svc = new CollectService();
    const collectPromise = svc.collect("src-1");
    await vi.runAllTimersAsync();
    const result = await collectPromise;

    expect(result.fetched).toBe(2);
    // 1 次原始 + 2 次重试 = 3 次
    expect(mockParse).toHaveBeenCalledTimes(3);
    expect(mockMarkRunDead).not.toHaveBeenCalled();
    expect(mockAppendOutbox).not.toHaveBeenCalled();
  });
});
