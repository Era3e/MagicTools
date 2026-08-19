import { describe, it, expect, vi, afterEach } from "vitest";
import { FeishuClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

const okEnvelope = (data: unknown) => JSON.stringify({ code: 0, msg: "success", data });
const okToken = JSON.stringify({ code: 0, msg: "success", tenant_access_token: "t-1", expire: 7200 });

describe("FeishuClient", () => {
  it("token 已缓存时不重复申请", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("tenant_access_token")) return new Response(okToken, { status: 200 });
      return new Response(okEnvelope({ has_more: false, items: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const c = new FeishuClient({ appId: "a", appSecret: "s" });
    await c.listRecords("app1", "tbl1");
    await c.listRecords("app1", "tbl1");
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("tenant_access_token"));
    expect(tokenCalls.length).toBe(1);
  });

  it("分页循环拉取全部记录并归一化字段", async () => {
    const page1 = okEnvelope({
      has_more: true,
      page_token: "pt2",
      items: [{ record_id: "r1", fields: { 问题: "怎么评价", 多选: ["A", "B"], 单选: "C" } }],
    });
    const page2 = okEnvelope({
      has_more: false,
      items: [{ record_id: "r2", fields: { 问题: "第二题" } }],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(okToken, { status: 200 }))
      .mockResolvedValueOnce(new Response(page1, { status: 200 }))
      .mockResolvedValueOnce(new Response(page2, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new FeishuClient({ appId: "a", appSecret: "s" });
    const records = await c.listRecords("app1", "tbl1");
    expect(records).toHaveLength(2);
    expect(records[0].fields["多选"]).toEqual(["A", "B"]);
    expect(records[0].fields["单选"]).toEqual(["C"]);
  });

  it("业务错误码抛错", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(okToken, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 1254043, msg: "无访问权限" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new FeishuClient({ appId: "a", appSecret: "s" });
    await expect(c.listRecords("app1", "tbl1")).rejects.toThrow(/1254043/);
  });

  it("桩模式返回固定记录且无需凭证", async () => {
    const c = new FeishuClient({});
    c.setStub(true);
    expect(c.isConfigured()).toBe(true);
    const records = await c.listRecords("any", "any");
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].fields["回答"]).toBeTruthy();
  });
});
