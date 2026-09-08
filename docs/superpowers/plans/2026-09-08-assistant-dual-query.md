# Assistant 双路数据查询与质量兜底 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 阶段一落地——data_query 双路并发（直连 cybercloud 数据 API 先行返回 + 智能体后台核验比对），可观测三件套（chat 元数据 / 探活 status / cybercloud_calls 表），前端核验标签与监控卡片。

**Architecture:** assistant-server 内新增 DirectQueryService（五步流水线：指标列表→LLM 匹配→报表结构→单值聚合→应答）、CompareEngine（数值提取比对纯函数）、VerifyTaskRegistry（内存任务表）；CybercloudService 暴露 postApi 复用双 token 认证并返回结构化元数据；ChatService data_query 分支改双路编排；前端 ChatPage 轮询 verify 终态渲染标签。

**Tech Stack:** NestJS 10 + vitest + supertest + zod；@mt/model-client（LLM+parseJson）；@mt/ui（MtStatusTag/MtKpiRow）；PostgreSQL（migration 004）。

**Spec:** docs/superpowers/specs/2026-09-08-assistant-dual-query-design.md

**执行前置：** 从 main 创建 worktree：`pnpm.cmd ws:create assistant dual-query`（分支 feat-assistant-dual-query）。Windows 下 pnpm 一律 pnpm.cmd；服务端测试 cwd = apps/assistant/server。

---

### Task 1: CompareEngine 纯函数

**Files:**
- Create: `apps/assistant/server/src/compare.service.ts`
- Test: `apps/assistant/server/src/compare.service.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { compareValues, extractNumbers } from "./compare.service";

describe("extractNumbers", () => {
  it("提取千分位与小数", () => {
    expect(extractNumbers("本月销售额 12,345.67 元")).toEqual([12345.67]);
  });
  it("万/亿/k 单位归一", () => {
    expect(extractNumbers("约 1.2万，累计 3亿，延迟 5k ms")).toEqual([12000, 300000000, 5000]);
  });
  it("百分比归一为比例", () => {
    expect(extractNumbers("增长 12.5%")).toEqual([0.125]);
  });
  it("多数值全提取", () => {
    expect(extractNumbers("销售额 12345 元，环比 9,876 元")).toEqual([12345, 9876]);
  });
  it("无数值返回空数组", () => {
    expect(extractNumbers("暂无数据")).toEqual([]);
  });
});

describe("compareValues", () => {
  it("1% 内一致", () => {
    expect(compareValues(12345, [12400]).status).toBe("consistent");
  });
  it("超差分歧并记录 diffPct", () => {
    const r = compareValues(12345, [99999]);
    expect(r.status).toBe("divergent");
    expect(r.diffPct).toBeGreaterThan(700);
  });
  it("智能体无数值为 unverifiable", () => {
    expect(compareValues(12345, []).status).toBe("unverifiable");
  });
  it("多数值任一命中即一致", () => {
    expect(compareValues(12345, [100, 12345]).status).toBe("consistent");
  });
  it("容差可调", () => {
    expect(compareValues(100, [102], 0.03).status).toBe("consistent");
    expect(compareValues(100, [102], 0.01).status).toBe("divergent");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd exec vitest run src/compare.service.test.ts`（cwd apps/assistant/server）
Expected: FAIL（模块不存在）

- [ ] **Step 3: 最小实现**

```ts
/** 数值提取与双路比对（spec §5）：纯函数，无 IO */
const NUM_RE = /(-?\d[\d,]*(?:\.\d+)?)\s*(万|亿|k|K|%|元|人|次|单|个)?/g;
const UNIT_FACTOR: Record<string, number> = { 万: 1e4, 亿: 1e8, k: 1e3, K: 1e3, "%": 0.01 };

export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const n = Number(m[1].replace(/,/g, ""));
    const factor = m[2] ? UNIT_FACTOR[m[2]] ?? 1 : 1;
    if (Number.isFinite(n)) out.push(n * factor);
  }
  return out;
}

export type CompareStatus = "consistent" | "divergent" | "unverifiable";

export interface CompareResult {
  status: CompareStatus;
  agentNumbers: number[];
  diffPct?: number;
}

export function compareValues(direct: number, agentNumbers: number[], tolerance = 0.01): CompareResult {
  if (agentNumbers.length === 0) return { status: "unverifiable", agentNumbers };
  const base = Math.max(Math.abs(direct), 1);
  const diffs = agentNumbers.map((a) => Math.abs(a - direct) / base);
  const minDiff = Math.min(...diffs);
  if (minDiff <= tolerance) return { status: "consistent", agentNumbers };
  return { status: "divergent", agentNumbers, diffPct: Math.round(minDiff * 100) };
}
```

- [ ] **Step 4: 测试通过**

Run: `pnpm.cmd exec vitest run src/compare.service.test.ts`
Expected: PASS 全绿

- [ ] **Step 5: 提交**

```bash
git add apps/assistant/server/src/compare.service.ts apps/assistant/server/src/compare.service.test.ts
git commit -m "新增双路数值比对引擎 CompareEngine"
```

---

### Task 2: cybercloud_calls 表与 repo

**Files:**
- Create: `apps/assistant/server/migrations/004_assistant_cybercloud_calls.sql`
- Create: `apps/assistant/server/src/cybercloud-calls.repo.ts`
- Test: `apps/assistant/server/src/cybercloud-calls.repo.test.ts`

- [ ] **Step 1: 建表迁移**（004 文件放入即随 ensureDatabase 自动执行，@mt/db runMigrations 扫目录）

```sql
CREATE TABLE IF NOT EXISTS cybercloud_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  endpoint text NOT NULL DEFAULT '',
  ok boolean NOT NULL,
  latency_ms integer NOT NULL DEFAULT 0,
  error text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cybercloud_calls_created ON cybercloud_calls (created_at DESC);
```

- [ ] **Step 2: 写失败测试**（连本地库，模式同既有 e2e：ensureDatabase）

```ts
import { afterAll, describe, expect, it } from "vitest";
import { ensureDatabase, pool } from "./db";
import { insertCybercloudCall, listCybercloudCalls, markVerifyStatus } from "./cybercloud-calls.repo";

afterAll(async () => {
  await pool.end();
});

describe("cybercloud_calls repo", () => {
  it("插入与查询", async () => {
    await ensureDatabase();
    const marker = "tc-" + Date.now();
    await insertCybercloudCall({ route: "direct", endpoint: "queryByStructure", ok: true, latencyMs: 120, detail: { metricName: "本月销售额", value: 12345, marker } });
    const rows = await listCybercloudCalls(200);
    const row = rows.find((r) => (r.detail as Record<string, unknown>).marker === marker);
    expect(row?.route).toBe("direct");
    expect(row?.ok).toBe(true);
  });
  it("verify 终态回写", async () => {
    await ensureDatabase();
    const marker = "tv-" + Date.now();
    const inserted = await insertCybercloudCall({ route: "agent", endpoint: "block", ok: true, latencyMs: 30000, detail: { marker } });
    await markVerifyStatus(inserted.id, "divergent", 710);
    const rows = await listCybercloudCalls(200);
    const row = rows.find((r) => r.id === inserted.id);
    expect((row?.detail as Record<string, unknown>).verify_status).toBe("divergent");
    expect((row?.detail as Record<string, unknown>).diff_pct).toBe(710);
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm.cmd exec vitest run src/cybercloud-calls.repo.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 实现 repo**

```ts
import { pool } from "./db";

export interface CybercloudCallRow {
  id: string;
  route: string;
  endpoint: string;
  ok: boolean;
  latencyMs: number;
  error: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface InsertCallInput {
  route: "agent" | "direct";
  endpoint: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  detail?: Record<string, unknown>;
}

function mapRow(r: Record<string, unknown>): CybercloudCallRow {
  return {
    id: r.id as string,
    route: r.route as string,
    endpoint: r.endpoint as string,
    ok: Boolean(r.ok),
    latencyMs: Number(r.latency_ms),
    error: (r.error as string | null) ?? null,
    detail: (r.detail as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function insertCybercloudCall(input: InsertCallInput): Promise<CybercloudCallRow> {
  const rows = await pool.query(
    "INSERT INTO cybercloud_calls (route, endpoint, ok, latency_ms, error, detail) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, route, endpoint, ok, latency_ms, error, detail, created_at",
    [input.route, input.endpoint, input.ok, input.latencyMs, input.error ?? null, JSON.stringify(input.detail ?? {})]
  );
  return mapRow(rows.rows[0]);
}

export async function markVerifyStatus(id: string, verifyStatus: string, diffPct?: number): Promise<void> {
  await pool.query(
    "UPDATE cybercloud_calls SET detail = detail || $2::jsonb WHERE id = $1",
    [id, JSON.stringify({ verify_status: verifyStatus, ...(diffPct !== undefined ? { diff_pct: diffPct } : {}) })]
  );
}

export async function listCybercloudCalls(limit = 200): Promise<CybercloudCallRow[]> {
  const rows = await pool.query(
    "SELECT id, route, endpoint, ok, latency_ms, error, detail, created_at FROM cybercloud_calls ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows.rows.map(mapRow);
}
```

- [ ] **Step 5: 测试通过并提交**

Run: `pnpm.cmd exec vitest run src/cybercloud-calls.repo.test.ts` → PASS

```bash
git add apps/assistant/server/migrations/004_assistant_cybercloud_calls.sql apps/assistant/server/src/cybercloud-calls.repo.ts apps/assistant/server/src/cybercloud-calls.repo.test.ts
git commit -m "新增 cybercloud 调用监控表与 repo"
```

---

### Task 3: CybercloudService 改造（元数据/ERROR 不降维/postApi/探活/桩答控制）

**Files:**
- Modify: `apps/assistant/server/src/cybercloud.service.ts`
- Modify: `apps/assistant/server/src/cybercloud.service.test.ts`（追加用例）

- [ ] **Step 1: 追加失败测试**（加到既有 describe 内）

```ts
  it("query 返回结构化元数据（sseType/latencyMs/agentId）", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    const { fetchMock } = mockCybercloudFlow();
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.query("本月销售额多少");
    expect(res.meta.sseType).toBe("MARKDOWN");
    expect(res.meta.agentId).toBe("agent-1");
    expect(res.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("SSE ERROR 保留错误标记不降维（meta.sseType=ERROR）", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/userByApiKey")) {
        return new Response(JSON.stringify({ code: "0", data: { payload: PAYLOAD_JSON } }), { status: 200 });
      }
      if (String(url).includes("/agents")) {
        return new Response(JSON.stringify({ code: "0", data: [{ id: "agent-1", name: "A", status: "PUBLISHED", enabled: true }] }), { status: 200 });
      }
      if (String(url).includes("/session/create")) {
        return new Response(JSON.stringify({ code: "0", data: { code: "sess-1" } }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: "0", data: { type: "ERROR", data: "工具执行失败" } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.query("查询");
    expect(res.meta.sseType).toBe("ERROR");
    expect(res.reply).toContain("工具执行失败");
  });

  it("桩模式智能体答由 CYBERCLOUD_STUB_AGENT_ANSWER 控制", async () => {
    vi.stubEnv("CYBERCLOUD_STUB", "1");
    const svc = new CybercloudService();
    const ok = await svc.query("问");
    expect(ok.meta.sseType).toBe("MARKDOWN");
    vi.stubEnv("CYBERCLOUD_STUB_AGENT_ANSWER", "99999");
    const diff = await svc.query("问");
    expect(diff.reply).toContain("99999");
    vi.stubEnv("CYBERCLOUD_STUB_AGENT_ANSWER", "__FAIL__");
    await expect(svc.query("问")).rejects.toThrow();
  });

  it("postApi 供直连复用（带 jwt+payload 头）", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    const { fetchMock, urls, headers } = mockCybercloudFlow();
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.postApi<Array<unknown>>("/api/setup/report/indicators/list", {});
    expect(res).toEqual([{ id: "agent-1" }]);
    const i = urls.findIndex((u) => u.includes("indicators/list"));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(headers[i].jwt).toBe("jwt-1");
    expect(headers[i].payload).toBe(encodeURIComponent(PAYLOAD_JSON));
  });
```

（mockCybercloudFlow 的兜底分支返回 `data:[{id:"agent-1"}]`——把既有兜底 `"未知接口"` 分支的 Response 改为 `{ code: "0", data: [{ id: "agent-1" }] }`，不影响既有用例断言。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd exec vitest run src/cybercloud.service.test.ts`
Expected: FAIL（meta/postApi 不存在）

- [ ] **Step 3: 改造 cybercloud.service.ts**

3a. 顶部新增导出类型与桩答常量：

```ts
export interface AgentMeta {
  sseType: string;
  latencyMs: number;
  agentId: string;
  error?: string;
}
```

3b. `query()` 改造（替换现有方法体）：

```ts
  async query(message: string): Promise<{ reply: string; meta: AgentMeta }> {
    const started = Date.now();
    if (process.env.CYBERCLOUD_STUB === "1") {
      const stubAnswer = process.env.CYBERCLOUD_STUB_AGENT_ANSWER ?? "本月销售额 12345 元";
      if (stubAnswer === "__FAIL__") throw new BadGatewayException("cybercloud 智能体桩故障");
      return { reply: stubAnswer, meta: { sseType: "MARKDOWN", latencyMs: 0, agentId: "stub-agent" } };
    }
    const agentId = process.env.CYBERCLOUD_AGENT_ID || (await this.resolveAgentId());
    const sessionCode = await this.resolveSession(agentId);
    const res = await this.post<SseResult>("/api/setup/agent/chat/block", {
      message,
      sessionCode,
      temperature: 0.3,
    });
    return { reply: this.formatSse(res.data), meta: { sseType: res.data?.type ?? "UNKNOWN", latencyMs: Date.now() - started, agentId, error: res.data?.type === "ERROR" ? String(res.data.data ?? "") : undefined } };
  }
```

3c. postRaw 改 public 别名（供直连复用，认证/重试全继承）：

```ts
  /** 直连数据 API 复用入口：带 jwt+payload 头与 401 重登（spec §3.8） */
  async postApi<T>(path: string, body: unknown): Promise<T | undefined> {
    const res = await this.postRaw<T>(path, body);
    return res.data;
  }
```

（postRaw 保持 private 不动。既有 `formatAnswer` 保留。）

- [ ] **Step 4: 全部用例通过**

Run: `pnpm.cmd exec vitest run src/cybercloud.service.test.ts`
Expected: PASS（新 4 例 + 既有全绿；chat.service 等依赖处 `(await query()).reply` 兼容不变）

- [ ] **Step 5: 提交**

```bash
git add apps/assistant/server/src/cybercloud.service.ts apps/assistant/server/src/cybercloud.service.test.ts
git commit -m "改造 cybercloud 服务返回元数据并暴露直连接口"
```

---

### Task 4: DirectQueryService 直连流水线（含 llm stub 分支与 schema）

**Files:**
- Modify: `apps/assistant/server/src/llm.ts`（stubPayloadFor 加分支）
- Modify: `apps/assistant/server/src/schemas.ts`（追加 directMatchSchema）
- Create: `apps/assistant/server/src/direct-query.service.ts`
- Test: `apps/assistant/server/src/direct-query.service.test.ts`

- [ ] **Step 1: llm.ts stub 分支**（stubPayloadFor 的 `{format` 分支前插入）

```ts
  if (sysText.includes("{metricId")) {
    return { metricId: "stub-metric", confidence: 0.95, timeFilter: { mode: "semantic", enumValue: "THIS_MONTH" } };
  }
```

- [ ] **Step 2: schemas.ts 追加**

```ts
export const directMatchSchema = z.object({
  metricId: z.string().nullable(),
  confidence: z.number(),
  timeFilter: z.object({
    mode: z.enum(["semantic", "explicit", "none"]),
    enumValue: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});
export type DirectMatch = z.infer<typeof directMatchSchema>;
```

- [ ] **Step 3: 写失败测试**

```ts
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
    const body = JSON.parse(String((qCall![1] as RequestInit).body));
    expect(body.outline.groups.rows).toEqual([]);
    expect(body.outline.groups.columns).toEqual([]);
    const dateFilter = body.userFilters.find((f: { code: string }) => f.code === "created");
    expect(dateFilter.operator).toBe("between");
    expect(JSON.parse(dateFilter.value)).toEqual({ actualTime: true, timeFilter: "THIS_MONTH" });
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
```

- [ ] **Step 4: 运行确认失败**

Run: `pnpm.cmd exec vitest run src/direct-query.service.test.ts`
Expected: FAIL

- [ ] **Step 5: 实现 direct-query.service.ts**

```ts
import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { parseJson } from "./json";
import { llmChat } from "./llm";
import { CybercloudService } from "./cybercloud.service";
import { directMatchSchema, type DirectMatch } from "./schemas";

const LIST_TTL_MS = 10 * 60 * 1000;

interface IndicatorItem {
  id: string;
  indicatorName: string;
  indicatorDesc: string;
  indicatorUnit: string;
  reportId: string;
  reportName: string;
}

const TIME_PHRASE: Record<string, string> = {
  THIS_MONTH: "本月", PRE_MONTH: "上月", THIS_WEEK: "本周", PRE_WEEK: "上周",
  TODAY: "今日", PAST_7_DAYS: "近7天", PAST_30_DAYS: "近30天", THIS_YEAR: "今年", PRE_YEAR: "去年",
};

export interface DirectResult {
  applicable: boolean;
  reply?: string;
  reasonCode?: "no_match" | "low_confidence" | "no_date_field" | "structure_invalid" | "query_failed" | "timeout" | "unconfigured";
  metricName?: string;
  value?: number;
  unit?: string;
  timeFilter?: string;
  endpoint?: string;
  latencyMs: number;
}

function md5(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

@Injectable()
export class DirectQueryService {
  private listCache: { at: number; items: IndicatorItem[] } | null = null;

  constructor(@Inject(CybercloudService) private readonly cybercloud: CybercloudService) {}

  private configured(): boolean {
    return Boolean(process.env.CYBERCLOUD_BASE_URL && process.env.CYBERCLOUD_API_KEY);
  }

  async run(message: string): Promise<DirectResult> {
    const started = Date.now();
    const finish = (r: Omit<DirectResult, "latencyMs">): DirectResult => ({ ...r, latencyMs: Date.now() - started });
    if (!this.configured()) return finish({ applicable: false, reasonCode: "unconfigured" });
    if (process.env.CYBERCLOUD_STUB === "1") {
      return finish({ applicable: true, reply: "「本月销售额」本月为 12345 元（直连实时查询）", metricName: "本月销售额", value: 12345, unit: "元", timeFilter: "THIS_MONTH", endpoint: "stub" });
    }
    const timeoutMs = Number(process.env.CYBERCLOUD_DIRECT_TIMEOUT_MS ?? "8000");
    const timeout = new Promise<DirectResult>((resolve) =>
      setTimeout(() => resolve(finish({ applicable: false, reasonCode: "timeout" })), timeoutMs)
    );
    return Promise.race([this.pipeline(message, finish), timeout]);
  }

  private async pipeline(message: string, finish: (r: Omit<DirectResult, "latencyMs">) => DirectResult): Promise<DirectResult> {
    try {
      const indicators = await this.listIndicators();
      if (indicators.length === 0) return finish({ applicable: false, reasonCode: "no_match" });
      const match = await this.matchMetric(message, indicators);
      if (!match || !match.metricId || match.confidence < 0.6) {
        return finish({ applicable: false, reasonCode: match && match.metricId ? "low_confidence" : "no_match" });
      }
      const indicator = indicators.find((i) => i.id === match.metricId);
      if (!indicator) return finish({ applicable: false, reasonCode: "no_match" });
      const structure = await this.cybercloud.postApi<Record<string, unknown>>("/api/setup/report/getReportStructure", { reportId: indicator.reportId });
      if (!structure) return finish({ applicable: false, reasonCode: "structure_invalid" });
      const outline = structure.outline as { columns?: Array<Record<string, unknown>>; groups?: { rows?: unknown[]; columns?: unknown[] } } | undefined;
      const column = outline?.columns?.find((c) => md5(String(c.indicatorName ?? "") + String(c.indicatorDesc ?? "")) === match.metricId);
      if (!column) return finish({ applicable: false, reasonCode: "structure_invalid" });
      const userFilters = ((structure.userFilters as Array<Record<string, unknown>>) ?? []).map((f) => ({ ...f }));
      const dateFilter = userFilters.find((f) => /date/i.test(String(f.type ?? ""))) ?? ((structure.filters as Array<Record<string, unknown>>) ?? []).map((f) => ({ ...f })).find((f) => /date/i.test(String(f.type ?? "")));
      if (match.timeFilter.mode !== "none" && !dateFilter) return finish({ applicable: false, reasonCode: "no_date_field" });
      if (dateFilter && match.timeFilter.mode !== "none") {
        dateFilter.operator = "between";
        dateFilter.value =
          match.timeFilter.mode === "semantic"
            ? JSON.stringify({ actualTime: true, timeFilter: match.timeFilter.enumValue ?? "THIS_MONTH" })
            : JSON.stringify({ actualTime: false, value: (match.timeFilter.from ?? "") + "," + (match.timeFilter.to ?? "") });
      }
      const queryStructure = JSON.parse(JSON.stringify(structure)) as Record<string, unknown>;
      const qOutline = queryStructure.outline as { groups: { rows: unknown[]; columns: unknown[] } };
      qOutline.groups.rows = [];
      qOutline.groups.columns = [];
      queryStructure.userFilters = dateFilter && match.timeFilter.mode !== "none" && !userFilters.includes(dateFilter) ? [...userFilters, dateFilter] : userFilters;
      const rows = await this.cybercloud.postApi<unknown>("/api/app/corm/report/queryByStructure", queryStructure);
      const rowList = Array.isArray(rows) ? rows : ((rows as { list?: unknown[] } | null | undefined)?.list ?? []);
      const first = (rowList[0] ?? {}) as Record<string, unknown>;
      const alisa = String(column.alisaName ?? column.name ?? "");
      const raw = first[alisa] ?? Object.entries(first).find(([k, v]) => k.startsWith("sum_") || typeof v === "number")?.[1];
      const value = Number(raw);
      if (!Number.isFinite(value)) return finish({ applicable: false, reasonCode: "query_failed" });
      const timePhrase = match.timeFilter.mode === "semantic" ? (TIME_PHRASE[match.timeFilter.enumValue ?? ""] ?? "") : match.timeFilter.mode === "explicit" ? (match.timeFilter.from ?? "") + " 至 " + (match.timeFilter.to ?? "") : "";
      const unit = indicator.indicatorUnit ?? "";
      return finish({
        applicable: true,
        reply: "「" + indicator.indicatorName + "」" + (timePhrase ? timePhrase : "") + "为 " + value + unit + "（直连实时查询）",
        metricName: indicator.indicatorName, value, unit,
        timeFilter: match.timeFilter.mode === "semantic" ? match.timeFilter.enumValue : match.timeFilter.mode,
        endpoint: "queryByStructure",
      });
    } catch {
      return finish({ applicable: false, reasonCode: "query_failed" });
    }
  }

  private async listIndicators(): Promise<IndicatorItem[]> {
    if (this.listCache && Date.now() - this.listCache.at < LIST_TTL_MS) return this.listCache.items;
    const data = await this.cybercloud.postApi<IndicatorItem[]>("/api/setup/report/indicators/list", {});
    const items = (data ?? []).filter((i) => i.id && i.reportId);
    this.listCache = { at: Date.now(), items };
    return items;
  }

  private async matchMetric(message: string, indicators: IndicatorItem[]): Promise<DirectMatch | null> {
    const catalog = indicators.map((i) => ({ id: i.id, name: i.indicatorName, desc: i.indicatorDesc, unit: i.indicatorUnit, report: i.reportName }));
    const raw = await llmChat([
      { role: "system", content: "从指标目录中匹配用户问题要查的指标并解析时间范围。只输出 JSON：{metricId, confidence, timeFilter:{mode:semantic|explicit|none, enumValue, from, to}}。{metricId} 指标目录：" + JSON.stringify(catalog) },
      { role: "user", content: message },
    ]);
    const parsed = directMatchSchema.safeParse(parseJson(raw));
    return parsed.success ? parsed.data : null;
  }
}
```

- [ ] **Step 6: 测试通过**

Run: `pnpm.cmd exec vitest run src/direct-query.service.test.ts`
Expected: PASS（5 例）

- [ ] **Step 7: 提交**

```bash
git add apps/assistant/server/src/llm.ts apps/assistant/server/src/schemas.ts apps/assistant/server/src/direct-query.service.ts apps/assistant/server/src/direct-query.service.test.ts
git commit -m "新增直连取数流水线 DirectQueryService"
```

---

### Task 5: VerifyTaskRegistry 核验任务注册表

**Files:**
- Create: `apps/assistant/server/src/verify-task.registry.ts`
- Test: `apps/assistant/server/src/verify-task.registry.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it, vi } from "vitest";
import { VerifyTaskRegistry } from "./verify-task.registry";

const DIRECT_OK = { applicable: true, reply: "r", metricName: "m", value: 12345, unit: "元", latencyMs: 10, endpoint: "queryByStructure", timeFilter: "THIS_MONTH" };

describe("VerifyTaskRegistry", () => {
  it("智能体一致 → consistent", async () => {
    const reg = new VerifyTaskRegistry();
    const task = reg.create({ directResult: DIRECT_OK as never, agentPromise: Promise.resolve({ reply: "本月销售额 12345 元", meta: { sseType: "MARKDOWN", latencyMs: 100, agentId: "a1" } }) });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("consistent"));
  });
  it("数值分歧 → divergent 且带 verdict/agentReply", async () => {
    const reg = new VerifyTaskRegistry();
    const task = reg.create({ directResult: DIRECT_OK as never, agentPromise: Promise.resolve({ reply: "是 99999 元", meta: { sseType: "MARKDOWN", latencyMs: 100, agentId: "a1" } }) });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("divergent"));
    const t = reg.get(task.taskId)!;
    expect(t.verdict?.directValue).toBe(12345);
    expect(t.agentReply).toContain("99999");
  });
  it("智能体异常 → agent_failed", async () => {
    const reg = new VerifyTaskRegistry();
    const task = reg.create({ directResult: DIRECT_OK as never, agentPromise: Promise.reject(new Error("boom")) });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("agent_failed"));
  });
  it("SSE ERROR → agent_failed", async () => {
    const reg = new VerifyTaskRegistry();
    const task = reg.create({ directResult: DIRECT_OK as never, agentPromise: Promise.resolve({ reply: "查询失败：工具异常", meta: { sseType: "ERROR", latencyMs: 100, agentId: "a1", error: "工具异常" } }) });
    await vi.waitFor(() => expect(reg.get(task.taskId)?.status).toBe("agent_failed"));
  });
  it("未知 taskId → null", () => {
    expect(new VerifyTaskRegistry().get("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd exec vitest run src/verify-task.registry.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
import { randomUUID } from "node:crypto";
import { compareValues, extractNumbers } from "./compare.service";
import type { DirectResult } from "./direct-query.service";
import type { AgentMeta } from "./cybercloud.service";
import { insertCybercloudCall, markVerifyStatus } from "./cybercloud-calls.repo";

const TTL_MS = 10 * 60 * 1000;
const VERIFY_TIMEOUT_MS = Number(process.env.CYBERCLOUD_VERIFY_TIMEOUT_MS ?? "60000");

export type VerifyStatus = "pending" | "consistent" | "divergent" | "unverifiable" | "agent_failed" | "agent_timeout";

export interface VerifyTask {
  taskId: string;
  status: VerifyStatus;
  verdict?: { directValue: number; agentNumbers: number[]; diffPct?: number };
  agentReply?: string;
  dataSource?: { mode: string; agent?: AgentMeta };
  createdAt: number;
}

export class VerifyTaskRegistry {
  private readonly tasks = new Map<string, VerifyTask>();

  create(input: { directResult: DirectResult; agentPromise: Promise<{ reply: string; meta: AgentMeta }> }): { taskId: string } {
    const taskId = randomUUID();
    const task: VerifyTask = { taskId, status: "pending", createdAt: Date.now() };
    this.tasks.set(taskId, task);
    const settle = (update: Partial<VerifyTask>, call: { ok: boolean; verifyStatus: VerifyStatus; diffPct?: number }) => {
      Object.assign(task, update, { dataSource: { mode: "dual", agent: input.directResult as never } });
      this.finalize(task, input.directResult, call);
    };
    const timeout = setTimeout(() => {
      if (task.status === "pending") {
        task.status = "agent_timeout";
        this.finalize(task, input.directResult, { ok: false, verifyStatus: "agent_timeout" });
      }
    }, VERIFY_TIMEOUT_MS);
    input.agentPromise
      .then((res) => {
        clearTimeout(timeout);
        task.dataSource = { mode: "dual", agent: res.meta };
        if (res.meta.sseType === "ERROR") {
          task.status = "agent_failed";
          task.agentReply = res.reply;
          this.finalize(task, input.directResult, { ok: false, verifyStatus: "agent_failed" });
          return;
        }
        const numbers = extractNumbers(res.reply);
        const cmp = compareValues(input.directResult.value ?? 0, numbers, Number(process.env.CYBERCLOUD_COMPARE_TOLERANCE ?? "0.01"));
        task.status = cmp.status;
        task.verdict = { directValue: input.directResult.value ?? 0, agentNumbers: cmp.agentNumbers, ...(cmp.diffPct !== undefined ? { diffPct: cmp.diffPct } : {}) };
        task.agentReply = res.reply;
        this.finalize(task, input.directResult, { ok: true, verifyStatus: cmp.status, ...(cmp.diffPct !== undefined ? { diffPct: cmp.diffPct } : {}) });
      })
      .catch(() => {
        clearTimeout(timeout);
        task.status = "agent_failed";
        this.finalize(task, input.directResult, { ok: false, verifyStatus: "agent_failed" });
      });
    return { taskId };
  }

  private finalize(task: VerifyTask, direct: DirectResult, call: { ok: boolean; verifyStatus: VerifyStatus; diffPct?: number }): void {
    const agentMeta = task.dataSource?.agent;
    insertCybercloudCall({
      route: "agent",
      endpoint: "block",
      ok: call.ok,
      latencyMs: agentMeta?.latencyMs ?? 0,
      error: call.ok ? undefined : call.verifyStatus,
      detail: { sse_type: agentMeta?.sseType, agent_reply: task.agentReply, verify_status: call.verifyStatus },
    })
      .then((row) => markVerifyStatus(row.id, call.verifyStatus, call.diffPct))
      .catch((e) => console.error("[verify] calls 写库失败", e));
    if (direct.applicable) {
      insertCybercloudCall({
        route: "direct",
        endpoint: direct.endpoint ?? "",
        ok: true,
        latencyMs: direct.latencyMs,
        detail: { metric_name: direct.metricName, value: direct.value, time_filter: direct.timeFilter },
      }).catch((e) => console.error("[direct] calls 写库失败", e));
    }
  }

  get(taskId: string): VerifyTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    if (Date.now() - task.createdAt > TTL_MS) {
      this.tasks.delete(taskId);
      return null;
    }
    return task;
  }
}
```

（注意：`settle` 局部函数在实现中被 then/catch 直写取代，删除它——上面保留最终形态时以 then/catch 直写为准。）

- [ ] **Step 4: 测试通过**

Run: `pnpm.cmd exec vitest run src/verify-task.registry.test.ts`
Expected: PASS（5 例；写库 fire-and-forget 在无 DB 时仅打日志不影响断言）

- [ ] **Step 5: 提交**

```bash
git add apps/assistant/server/src/verify-task.registry.ts apps/assistant/server/src/verify-task.registry.test.ts
git commit -m "新增核验任务注册表与终态编排"
```

---

### Task 6: ChatService 双路编排 + verify 端点 + app.module 注册

**Files:**
- Modify: `apps/assistant/server/src/chat.service.ts`（executeBranch 的 data_query 分支与返回类型）
- Modify: `apps/assistant/server/src/chat.controller.ts`
- Modify: `apps/assistant/server/src/app.module.ts`
- Test: `apps/assistant/server/src/chat.dual.e2e.test.ts`（新建）

- [ ] **Step 1: 写失败 e2e**（supertest + 全桩环境，模式抄 data-query.e2e.test.ts 头部）

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { ensureDatabase, pool } from "./db";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function appFor() {
  await ensureDatabase();
  const { AppModule } = await import("./app.module");
  const { Test } = await import("@nestjs/testing");
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe("chat 双路编排 e2e", () => {
  it("dual 模式直连先行 + verify 终态 consistent", async () => {
    vi.stubEnv("CYBERCLOUD_STUB", "1");
    vi.stubEnv("MT_LLM_STUB", "1");
    const app = await appFor();
    const chat = await request(app.getHttpServer()).post("/chat").send({ message: "本月销售额多少" }).expect(201);
    expect(chat.body.intent).toBe("data_query");
    expect(chat.body.reply).toContain("12345");
    expect(chat.body.verify.taskId).toBeTruthy();
    expect(chat.body.dataSource.mode).toBe("dual");
    const verify = await vi.waitFor(async () => {
      const r = await request(app.getHttpServer()).get("/chat/verify/" + chat.body.verify.taskId).expect(200);
      if (r.body.status === "pending") throw new Error("pending");
      return r.body;
    }, { timeout: 5000 });
    expect(verify.status).toBe("consistent");
    await app.close();
  }, 30000);

  it("桩答错值 → divergent", async () => {
    vi.stubEnv("CYBERCLOUD_STUB", "1");
    vi.stubEnv("CYBERCLOUD_STUB_AGENT_ANSWER", "其实是 99999 元");
    vi.stubEnv("MT_LLM_STUB", "1");
    const app = await appFor();
    const chat = await request(app.getHttpServer()).post("/chat").send({ message: "本月销售额多少" }).expect(201);
    const verify = await vi.waitFor(async () => {
      const r = await request(app.getHttpServer()).get("/chat/verify/" + chat.body.verify.taskId).expect(200);
      if (r.body.status === "pending") throw new Error("pending");
      return r.body;
    }, { timeout: 5000 });
    expect(verify.status).toBe("divergent");
    expect(verify.verdict.directValue).toBe(12345);
    expect(verify.agentReply).toContain("99999");
    await app.close();
  }, 30000);

  it("桩答 __FAIL__ → agent_failed 且直连先行应答", async () => {
    vi.stubEnv("CYBERCLOUD_STUB", "1");
    vi.stubEnv("CYBERCLOUD_STUB_AGENT_ANSWER", "__FAIL__");
    vi.stubEnv("MT_LLM_STUB", "1");
    const app = await appFor();
    const chat = await request(app.getHttpServer()).post("/chat").send({ message: "本月销售额多少" }).expect(201);
    expect(chat.body.reply).toContain("12345");
    const verify = await vi.waitFor(async () => {
      const r = await request(app.getHttpServer()).get("/chat/verify/" + chat.body.verify.taskId).expect(200);
      if (r.body.status === "pending") throw new Error("pending");
      return r.body;
    }, { timeout: 5000 });
    expect(verify.status).toBe("agent_failed");
    await app.close();
  }, 30000);
});

```

（文件末尾 `afterAll(() => pool.end())` 视既有 e2e 惯例补齐；若 data-query.e2e.test.ts 有全局 setup 处理请对齐。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd exec vitest run src/chat.dual.e2e.test.ts`
Expected: FAIL（无 verify 字段/端点）

- [ ] **Step 3: chat.service.ts 改造**

3a. 构造器注入与成员（imports 加 DirectQueryService、VerifyTaskRegistry）：

```ts
    @Inject(DirectQueryService) private readonly directQuery: DirectQueryService,
```
```ts
  private readonly verifyRegistry = new VerifyTaskRegistry();
```

3b. executeBranch 返回类型扩展：

```ts
  ): Promise<{ reply: string; citations: Citation[]; actionResult: Record<string, unknown>; verify?: { taskId?: string; status: string }; dataSource?: Record<string, unknown> }>
```

3c. data_query 分支替换为：

```ts
    } else if (intent === "data_query") {
      const ds = this.cybercloud.status();
      if (ds.stub || ds.configured) {
        const mode = process.env.CYBERCLOUD_MODE ?? "dual";
        if (mode === "agent") {
          const res = await this.cybercloud.query(message);
          reply = res.reply;
          dataSource = { mode: "agent", agent: res.meta };
        } else {
          const directPromise = this.directQuery.run(message);
          const agentPromise =
            mode === "dual" ? this.cybercloud.query(message) : null;
          const direct = await directPromise;
          const directMeta = {
            applicable: direct.applicable,
            metricName: direct.metricName,
            value: direct.value,
            unit: direct.unit,
            latencyMs: direct.latencyMs,
            endpoint: direct.endpoint,
            timeFilter: direct.timeFilter,
            ...(direct.reasonCode ? { reasonCode: direct.reasonCode } : {}),
          };
          if (direct.applicable) {
            reply = direct.reply ?? "";
            if (agentPromise) {
              const task = this.verifyRegistry.create({ directResult: direct, agentPromise });
              verify = { taskId: task.taskId, status: "pending" };
              dataSource = { mode: "dual", direct: directMeta };
            } else {
              verify = { status: "not_applicable" };
              dataSource = { mode: "direct", direct: directMeta };
            }
          } else {
            const agentRes = await (agentPromise ?? this.cybercloud.query(message));
            reply = agentRes.reply;
            verify = { status: "not_applicable" };
            dataSource = { mode: mode === "direct" ? "direct-fallback-agent" : "dual", direct: directMeta, agent: agentRes.meta };
          }
        }
      } else {
        reply = DATA_QUERY_DEGRADE;
        dataSource = { mode: "degrade", direct: { applicable: false, reasonCode: "unconfigured" } };
      }
    }
```

（分支开头声明 `let verify: { taskId?: string; status: string } | undefined; let dataSource: Record<string, unknown> | undefined;`，返回值带出；chat() 主流程两个 return 处把 `result.verify`/`result.dataSource` 透传进响应。）

3d. chat() 两个非澄清 return 的响应对象追加：

```ts
        verify: result.verify,
        dataSource: result.dataSource,
```

- [ ] **Step 4: chat.controller.ts 追加端点**（构造器注入 `@Inject(VerifyTaskRegistry) private readonly verifyRegistry: VerifyTaskRegistry`，import 自 ./verify-task.registry）：

```ts
  @Get("chat/verify/:taskId")
  getVerify(@Param("taskId") taskId: string) {
    const task = this.verifyRegistry.get(taskId);
    if (!task) throw new NotFoundException("核验任务不存在或已过期");
    return task;
  }
```

（Param 需从 @nestjs/common import。）

- [ ] **Step 5: app.module.ts**：providers 追加 `DirectQueryService`（VerifyTaskRegistry 由 ChatService 内部 new，不注册）。

- [ ] **Step 6: e2e 通过 + 回归**

Run: `pnpm.cmd exec vitest run src/chat.dual.e2e.test.ts src/chat.service.test.ts src/data-query.e2e.test.ts src/multi-turn.e2e.test.ts`
Expected: 全 PASS

- [ ] **Step 7: 提交**

```bash
git add apps/assistant/server/src/chat.service.ts apps/assistant/server/src/chat.controller.ts apps/assistant/server/src/app.module.ts apps/assistant/server/src/chat.dual.e2e.test.ts
git commit -m "实现 data_query 双路编排与核验端点"
```

---

### Task 7: meta 探活升级 + calls 查询 API

**Files:**
- Modify: `apps/assistant/server/src/cybercloud.service.ts`（probe 方法）
- Modify: `apps/assistant/server/src/meta.controller.ts`
- Test: `apps/assistant/server/src/meta.controller.test.ts`（新建或并入既有 meta 测试）

- [ ] **Step 1: 写失败测试**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { CybercloudService } from "./cybercloud.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function probeFetch(opts: { agentsFail?: boolean; payloadFail?: boolean }) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/api/auth/login/key")) return new Response(JSON.stringify({ code: "0", data: { rsaPublicKey: "pem", loginKey: "k" } }), { status: 200 });
    if (String(url).includes("/api/auth/login")) return new Response("{}", { status: 200, headers: { "Set-Cookie": "jwt=j; Path=/" } });
    if (String(url).includes("/userByApiKey")) {
      if (opts.payloadFail) return new Response(JSON.stringify({ code: "1", message: "无效 ApiKey" }), { status: 200 });
      return new Response(JSON.stringify({ code: "0", data: { payload: "{}" } }), { status: 200 });
    }
    if (String(url).includes("/agents")) {
      if (opts.agentsFail) return new Response(JSON.stringify({}), { status: 500 });
      return new Response(JSON.stringify({ code: "0", data: [{ id: "a1" }, { id: "a2" }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ code: "0", data: [] }), { status: 200 });
  });
}

describe("meta 探活", () => {
  it("全通：gatewayOk/authOk/agentsReachable + agentCount", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key");
    vi.stubEnv("CYBERCLOUD_USERNAME", "u");
    vi.stubEnv("CYBERCLOUD_PASSWORD", "p");
    vi.stubGlobal("fetch", probeFetch({}));
    const svc = new CybercloudService();
    const probe = await svc.probe();
    expect(probe.gatewayOk).toBe(true);
    expect(probe.authOk).toBe(true);
    expect(probe.agentsReachable).toBe(true);
    expect(probe.agentCount).toBe(2);
    expect(probe.errorDomain).toBeNull();
  });
  it("apiKey 无效 → errorDomain=auth", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "bad");
    vi.stubEnv("CYBERCLOUD_JWT", "j");
    vi.stubGlobal("fetch", probeFetch({ payloadFail: true }));
    const svc = new CybercloudService();
    const probe = await svc.probe();
    expect(probe.authOk).toBe(false);
    expect(probe.errorDomain).toBe("auth");
  });
  it("探活结果 60s 缓存", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key");
    vi.stubEnv("CYBERCLOUD_JWT", "j");
    const fetchMock = probeFetch({});
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    await svc.probe();
    await svc.probe();
    const agentsCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/agents")).length;
    expect(agentsCalls).toBe(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd exec vitest run src/meta.controller.test.ts`
Expected: FAIL（probe 不存在）

- [ ] **Step 3: CybercloudService 加 probe**（status() 后）：

```ts
  private probeCache: { at: number; result: ProbeResult } | null = null;

  async probe(): Promise<ProbeResult> {
    if (this.probeCache && Date.now() - this.probeCache.at < 60 * 1000) return this.probeCache.result;
    const started = Date.now();
    const result: ProbeResult = { at: new Date().toISOString(), gatewayOk: false, authOk: false, agentsReachable: false, agentCount: 0, latencyMs: 0, errorDomain: null };
    try {
      await this.ensureJwt();
      result.gatewayOk = true;
    } catch {
      result.latencyMs = Date.now() - started;
      result.errorDomain = "gateway";
      this.probeCache = { at: Date.now(), result };
      return result;
    }
    try {
      await this.ensurePayload();
      result.authOk = true;
    } catch {
      result.latencyMs = Date.now() - started;
      result.errorDomain = "auth";
      this.probeCache = { at: Date.now(), result };
      return result;
    }
    try {
      const agents = await this.post<AgentItem[]>("/api/setup/agent/chat/agents", { from: "Setup" });
      result.agentCount = (agents.data ?? []).length;
      result.agentsReachable = true;
    } catch {
      result.errorDomain = "agent";
    }
    result.latencyMs = Date.now() - started;
    this.probeCache = { at: Date.now(), result };
    return result;
  }
```

（文件顶部导出 `export interface ProbeResult { at: string; gatewayOk: boolean; authOk: boolean; agentsReachable: boolean; agentCount: number; latencyMs: number; errorDomain: "gateway" | "auth" | "agent" | null }`；桩模式 CYBERCLOUD_STUB=1 时 probe 直接返回全绿假结果。）

- [ ] **Step 4: meta.controller.ts 升级**（注入不变，追加 calls 端点，import listCybercloudCalls）：

```ts
  @Get("meta/data-source-status")
  async status() {
    return { ...this.service.status(), probe: await this.service.probe() };
  }

  @Get("meta/cybercloud-calls")
  calls() {
    return listCybercloudCalls(200);
  }
```

- [ ] **Step 5: 测试通过并提交**

Run: `pnpm.cmd exec vitest run src/meta.controller.test.ts` → PASS

```bash
git add apps/assistant/server/src/cybercloud.service.ts apps/assistant/server/src/meta.controller.ts apps/assistant/server/src/meta.controller.test.ts
git commit -m "升级数据源探活与调用查询接口"
```

---

### Task 8: 前端 verify 轮询标签（api.ts + ChatPage）

**Files:**
- Modify: `apps/assistant/web/src/api.ts`
- Modify: `apps/assistant/web/src/pages/ChatPage.tsx`
- Test: `apps/assistant/web/src/pages/ChatPage.verify.test.tsx`（新建）

- [ ] **Step 1: api.ts 扩展**

```ts
export interface VerifyInfo {
  taskId?: string;
  status: "pending" | "consistent" | "divergent" | "unverifiable" | "agent_failed" | "agent_timeout" | "not_applicable";
}
```

ChatResponse 追加字段 `verify?: VerifyInfo; dataSource?: Record<string, unknown>;`；Message 追加 `verify?: VerifyInfo;`；api 对象追加：

```ts
  getVerify: (taskId: string) => request<VerifyInfo & { verdict?: { directValue: number; agentNumbers: number[]; diffPct?: number }; agentReply?: string }>("/chat/verify/" + taskId),
```

- [ ] **Step 2: 写失败测试**（模式对齐 ChatPage.clarify.test.tsx：jsdom + 桩 fetch）

```tsx
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatPage from "./ChatPage";

afterEach(() => {
  cleanup();
  vi.unstubGlobal("fetch");
  localStorage.clear();
});

function chatFetch(verify: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/chat")) {
      return new Response(JSON.stringify({ sessionId: "s1", reply: "「本月销售额」本月为 12345 元", intent: "data_query", citations: [], verify, dataSource: { mode: "dual" } }), { status: 200 });
    }
    if (String(url).includes("/verify/")) {
      return new Response(JSON.stringify({ status: "divergent", verdict: { directValue: 12345, agentNumbers: [99999], diffPct: 710 }, agentReply: "是 99999 元" }), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  });
}

describe("ChatPage 核验标签", () => {
  it("发送后显示核验中，轮询到 divergent 终态并停止", async () => {
    vi.stubGlobal("fetch", chatFetch({ taskId: "t1", status: "pending" }));
    render(<ChatPage />);
    const input = screen.getByPlaceholderText("输入消息");
    await user.type(input, "本月销售额多少{Enter}");
    expect(await screen.findByText(/核验中/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/不一致/)).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText(/99999/)).toBeTruthy();
  });
});
```

（`user` 用 `userEvent.setup()`，与既有 clarify 测试同法。）

- [ ] **Step 3: ChatPage 实现**

3a. sendText 的本地 assistant 消息对象追加 `verify: res.verify`。

3b. 气泡内意图标签后追加核验标签组件（文件底部新增）：

```tsx
function VerifyBadge({ verify }: { verify: NonNullable<Message["verify"]>; }) {
  const [state, setState] = useState<{ status: string; verdict?: { directValue: number; agentNumbers: number[]; diffPct?: number }; agentReply?: string }>({ status: verify.status });
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!verify.taskId || state.status !== "pending") return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await api.getVerify(verify.taskId!);
        if (!stop) setState(r);
      } catch {
        if (!stop) setState({ status: "agent_timeout" });
      }
    };
    const timer = setInterval(() => { if (!stop && (state.status === "pending")) tick(); }, 2000);
    tick();
    return () => { stop = true; clearInterval(timer); };
  }, []);
  const LABEL: Record<string, string> = {
    pending: "直连数据 · 核验中",
    consistent: "已核验 · 智能体一致",
    divergent: "智能体回答不一致 · 已采用直连" + (state.verdict?.diffPct !== undefined ? "（差 " + state.verdict.diffPct + "%）" : ""),
    unverifiable: "智能体未给出可比数值 · 已采用直连",
    agent_failed: "智能体故障 · 已采用直连",
    agent_timeout: "智能体超时 · 已采用直连",
    not_applicable: "来自智能体 · 直连不适用",
  };
  const tone = state.status === "consistent" ? "success" : state.status === "pending" ? "neutral" : state.status === "divergent" ? "warning" : "info";
  return (
    <div style={{ marginTop: 4 }}>
      <MtStatusTag tone={tone as never} style={{ cursor: state.status === "divergent" ? "pointer" : "default" }} onClick={() => state.status === "divergent" && setExpanded((v) => !v)} data-testid="verify-badge">
        {LABEL[state.status] ?? state.status}
      </MtStatusTag>
      {expanded && state.agentReply ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "inherit", opacity: 0.7, whiteSpace: "pre-wrap" }}>智能体原文：{state.agentReply}</div>
      ) : null}
    </div>
  );
}
```

（MtStatusTag 若不支持 onClick/children 透传则外层包 span 绑定事件；MtStatusTag 的 tone prop 以 @mt/ui status-tag 契约为准，测试断言文本不断言颜色。）

3c. 气泡渲染处（意图标签块后）追加：

```tsx
                  {m.role === "assistant" && m.verify ? <VerifyBadge verify={m.verify} /> : null}
```

- [ ] **Step 4: 测试通过 + 回归 clarify 测试**

Run: `pnpm.cmd --filter @mt/assistant-web test`（cwd 根）
Expected: PASS（新例 + 既有 ChatPage 测试全绿）

- [ ] **Step 5: 提交**

```bash
git add apps/assistant/web/src/api.ts apps/assistant/web/src/pages/ChatPage.tsx apps/assistant/web/src/pages/ChatPage.verify.test.tsx
git commit -m "前端新增核验标签与轮询终态展示"
```

---

### Task 9: IntentLogPage 数据查询监控卡片

**Files:**
- Modify: `apps/assistant/web/src/api.ts`（listCybercloudCalls）
- Modify: `apps/assistant/web/src/pages/IntentLogPage.tsx`
- Test: `apps/assistant/web/src/pages/IntentLogPage.calls.test.tsx`（新建）

- [ ] **Step 1: api.ts 追加类型与方法**

```ts
export interface CybercloudCall {
  id: string;
  route: string;
  endpoint: string;
  ok: boolean;
  latencyMs: number;
  error: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}
```

```ts
  listCybercloudCalls: () => request<CybercloudCall[]>("/meta/cybercloud-calls"),
```

- [ ] **Step 2: 写失败测试**（fetch 桩返回 calls 数组，断言卡片渲染 route 标签与延迟）

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IntentLogPage from "./IntentLogPage";

afterEach(() => {
  cleanup();
  vi.unstubGlobal("fetch");
});

describe("IntentLogPage 数据查询监控", () => {
  it("渲染双路调用记录与统计", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/meta/cybercloud-calls")) {
        return new Response(JSON.stringify([
          { id: "c1", route: "agent", endpoint: "block", ok: true, latencyMs: 32000, error: null, detail: { verify_status: "divergent" }, createdAt: new Date().toISOString() },
          { id: "c2", route: "direct", endpoint: "queryByStructure", ok: true, latencyMs: 1800, error: null, detail: {}, createdAt: new Date().toISOString() },
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    render(<IntentLogPage />);
    expect(await screen.findByText("数据查询监控")).toBeTruthy();
    expect(screen.getByText(/queryByStructure/)).toBeTruthy();
    expect(screen.getByText(/block/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: IntentLogPage 追加卡片**（页面底部，模式对齐该页既有卡片：Card + MtKpiRow + 表格）

- 卡片标题「数据查询监控」；useEffect 拉取 `api.listCybercloudCalls()`；
- 统计行（MtKpiRow）：双路各自 `ok/总数` 成功率与平均延迟（由列表 reduce 计算）；
- 明细表列：时间（mono）、路由（MtStatusTag mono：agent/direct）、endpoint、ok（成功/失败 tone）、latencyMs（mono）、error；
- 空态用 MtEmptyState（页面既有惯例）。

- [ ] **Step 4: 测试通过**

Run: `pnpm.cmd --filter @mt/assistant-web test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/assistant/web/src/api.ts apps/assistant/web/src/pages/IntentLogPage.tsx apps/assistant/web/src/pages/IntentLogPage.calls.test.tsx
git commit -m "意图日志页新增数据查询监控卡片"
```

---

### Task 10: env 模板、e2e 视觉回归、收尾

**Files:**
- Modify: `.env.template`
- Modify: `infra/scripts/start-services.mjs`（如桩环境需透传新 env——对照既有 CYBERCLOUD_STUB 注入点补 CYBERCLOUD_STUB_AGENT_ANSWER）
- Modify: `docs/memory/state.md`、changeset

- [ ] **Step 1: .env.template 追加**

```dotenv
CYBERCLOUD_MODE=dual                  # agent | direct | dual
CYBERCLOUD_DIRECT_TIMEOUT_MS=8000
CYBERCLOUD_VERIFY_TIMEOUT_MS=60000
CYBERCLOUD_COMPARE_TOLERANCE=0.01
# CYBERCLOUD_STUB_AGENT_ANSWER=（桩模式智能体答，__FAIL__ 模拟故障）
```

- [ ] **Step 2: 全量回归**

Run: `pnpm.cmd test`（根，turbo 全量）
Expected: 全部任务 PASS

- [ ] **Step 3: 视觉基线检查**

ChatPage/IntentLogPage 布局有变（新增标签与卡片）→ 本地按既有流程重生成受影响基线：带桩重启服务后 `pnpm.cmd e2e:visual:update`，然后 `pnpm.cmd e2e:visual` 验证 16/16。

- [ ] **Step 4: qa:gate 门禁**

Run: `pnpm.cmd qa:gate`
Expected: lint 0 err / build / test / coverage / infra / docs 全绿

- [ ] **Step 5: 文档与 changeset**

- docs/memory/state.md 追加条目（双路对比落地、运行期待验证项清单、验收结果）；
- `pnpm.cmd changeset` 添加 minor 变更日志（apps 不入发布，按仓库惯例只作迭代记录）。

- [ ] **Step 6: 提交**

```bash
git add .env.template infra/scripts/start-services.mjs docs/memory/state.md
git commit -m "补双路查询配置模板与记忆更新"
```

- [ ] **Step 7: 真环境验收（testcybercloud-dev，用户配合）**

1. 配 .env 真实 CYBERCLOUD_BASE_URL/API_KEY/USERNAME/PASSWORD；
2. 重启 assistant-server，`curl /api/assistant/meta/data-source-status` 确认 probe 全绿；
3. Chat 页问真实指标问题，确认直连先行 <10s、verify 终态正确；
4. 落定 spec §3.5 运行期验证项（queryByStructure 响应字段名），若不符按降级链调整取值逻辑并补记录。

---

## Self-Review 结论

- **Spec 覆盖**：§3 流水线→Task 4；§4 编排/verify→Task 5/6；§5 比对→Task 1；§6 三件套→Task 3/6/7/9；§7 前端→Task 8/9；§8 配置→Task 10；§12 闭环数据底座→Task 2/9。无遗漏。
- **类型一致性**：DirectResult/AgentMeta/VerifyStatus/VerifyTask 命名在 Task 1-8 间一致；chat.service 使用 direct.query 新签名（reply+meta）已同步。
- **占位符**：Task 9 Step 3 的卡片为模式描述而非全量 JSX（遵循页面既有卡片惯例，测试锚定行为）——实施时对照 IntentLogPage 既有「路由评估」卡片结构，属惯例复用非逻辑缺口。
