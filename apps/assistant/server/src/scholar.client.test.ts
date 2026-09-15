import { afterEach, describe, expect, it, vi } from "vitest";
import { ScholarClient } from "./scholar.client";

const response = (candidates: unknown[], status = 200) => new Response(JSON.stringify({
  query: "如何回退发布",
  versionId: "00000000-0000-0000-0000-000000000021",
  version: "1.0.0",
  deploymentRef: "registry@sha256:test",
  candidates,
  thresholds: { minimumVectorScore: 0.15, bothChannelsBonus: 0.08 },
}), { status });

const candidate = {
  entryId: "00000000-0000-0000-0000-000000000001",
  source: "manual",
  title: "发布手册",
  category: "product",
  revisionId: "00000000-0000-0000-0000-000000000011",
  revisionNo: 1,
  sourceRevision: "commit-p19",
  sourceUrl: "https://example.com/commit",
  productVersionId: "00000000-0000-0000-0000-000000000021",
  productVersion: "1.0.0",
  deploymentRef: "registry@sha256:test",
  chunkId: "00000000-0000-0000-0000-000000000031",
  chunkNo: 1,
  content: "回退前保存回执",
  charStart: 0,
  charEnd: 7,
  score: 0.9,
  candidateNo: 1,
  channels: ["fts", "vector"],
  requirementLinks: [],
};

describe("ScholarClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GATEWAY_TOKEN;
    delete process.env.INTERNAL_GATEWAY_URL;
  });

  it("经网关调用统一公共检索并校验候选结构", async () => {
    process.env.INTERNAL_GATEWAY_URL = "http://gateway.test";
    process.env.GATEWAY_TOKEN = "service-token";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://gateway.test/api/scholar/public/search");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("x-access-token")).toBe("service-token");
      expect(JSON.parse(String(init?.body))).toEqual({ q: "如何回退发布", limit: 5 });
      return response([candidate]);
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(new ScholarClient().search("如何回退发布")).resolves.toEqual([candidate]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("当前公共版本缺失时按无知识处理，非法响应拒绝通过", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response([], 404)));
    await expect(new ScholarClient().search("如何回退发布")).resolves.toEqual([]);

    vi.stubGlobal("fetch", vi.fn(async () => response([{ ...candidate, candidateNo: 0 }])));
    await expect(new ScholarClient().search("如何回退发布")).rejects.toThrow("Scholar 检索结果格式非法");
  });
});
