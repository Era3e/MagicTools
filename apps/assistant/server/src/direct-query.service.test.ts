import { afterEach, describe, expect, it, vi } from "vitest";
import { CybercloudService } from "./cybercloud.service";
import { DirectQueryService } from "./direct-query.service";

const PAYLOAD_JSON = '{"code":"t1"}';

function stubAuthFetch(indicators: unknown, structure: unknown, queryData: unknown) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/userByApiKey")) {
      return new Response(JSON.stringify({ code: "0", data: { payload: PAYLOAD_JSON } }), { status: 200 });
    }
    if (String(url).includes("indicators/list")) {
      return new Response(JSON.stringify({ code: "0", data: indicators }), { status: 200 });
    }
    if (String(url).includes("getReportStructure")) {
      return new Response(JSON.stringify({ code: "0", data: structure }), { status: 200 });
    }
    if (String(url).includes("queryByStructure")) {
      return new Response(JSON.stringify({ code: "0", data: queryData }), { status: 200 });
    }
    return new Response(JSON.stringify({ code: "0", data: [] }), { status: 200 });
  });
}

const INDICATORS = [
  { id: "stub-metric", indicatorName: "本月销售额", indicatorDesc: "销售口径", indicatorUnit: "元", reportId: "r1", reportName: "销售报表" },
];
const STRUCTURE = {
  outline: {
    columns: [
      { id: "o1.price", code: "price", name: "金额", alisaName: "sum_price", summarize: "sum", indicatorName: "本月销售额", indicatorDesc: "销售口径" },
    ],
    groups: { rows: [{ id: "o1.created", code: "created", name: "创建时间", alisaName: "创建时间" }], columns: [] },
  },
  userFilters: [{ id: "o1.created", code: "created", table: "orders", name: "创建时间", type: "date", operator: "between" }],
  filters: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("DirectQueryService", () => {
  it("桩模式直接返回固定真值", async () => {
    vi.stubEnv("CYBERCLOUD_STUB", "1");
    const svc = new DirectQueryService(new CybercloudService());
    const res = await svc.run("本月销售额多少");
    expect(res.applicable).toBe(true);
    expect(res.value).toBe(12345);
    expect(res.reply).toContain("12345");
  });

  it("全流程：匹配指标→结构→时间过滤→单值", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    vi.stubEnv("MT_LLM_STUB", "1");
    const fetchMock = stubAuthFetch(INDICATORS, STRUCTURE, [{ "sum_price": 12345 }]);
    vi.stubGlobal("fetch", fetchMock);
    const svc = new DirectQueryService(new CybercloudService());
    const res = await svc.run("本月销售额多少");
    expect(res.applicable).toBe(true);
    expect(res.value).toBe(12345);
    expect(res.metricName).toBe("本月销售额");
    expect(res.timeFilter).toBe("THIS_MONTH");
    const qCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("queryByStructure"));
    const body = JSON.parse(String((qCall as unknown as [string, RequestInit])[1].body));
    expect(body.outline.groups.rows).toEqual([]);
    expect(body.outline.groups.columns).toEqual([]);
    const dateFilter = body.userFilters.find((f: { code: string }) => f.code === "created");
    expect(dateFilter.operator).toBe("between");
    expect(JSON.parse(dateFilter.value)).toEqual({ actualTime: true, timeFilter: "THIS_MONTH" });
  });

  it("structure 为 JSON 字符串时防御性解析", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    vi.stubEnv("MT_LLM_STUB", "1");
    vi.stubGlobal("fetch", stubAuthFetch(INDICATORS, JSON.stringify(STRUCTURE), [{ "sum_price": 22222 }]));
    const svc = new DirectQueryService(new CybercloudService());
    const res = await svc.run("本月销售额多少");
    expect(res.applicable).toBe(true);
    expect(res.value).toBe(22222);
  });

  it("指标列表为空 → notApplicable(no_match)", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    vi.stubEnv("MT_LLM_STUB", "1");
    vi.stubGlobal("fetch", stubAuthFetch([], STRUCTURE, []));
    const svc = new DirectQueryService(new CybercloudService());
    const res = await svc.run("随便问");
    expect(res.applicable).toBe(false);
    expect(res.reasonCode).toBe("no_match");
  });

  it("结构缺日期过滤且问题有时间限定 → no_date_field", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    vi.stubEnv("MT_LLM_STUB", "1");
    const noDate = JSON.parse(JSON.stringify(STRUCTURE)) as typeof STRUCTURE;
    noDate.userFilters = [];
    vi.stubGlobal("fetch", stubAuthFetch(INDICATORS, noDate, []));
    const svc = new DirectQueryService(new CybercloudService());
    const res = await svc.run("本月销售额多少");
    expect(res.applicable).toBe(false);
    expect(res.reasonCode).toBe("no_date_field");
  });

  it("未配置 → notApplicable(unconfigured)", async () => {
    const svc = new DirectQueryService(new CybercloudService());
    const res = await svc.run("问");
    expect(res.reasonCode).toBe("unconfigured");
  });
});
