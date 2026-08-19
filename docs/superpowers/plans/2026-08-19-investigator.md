# Investigator（调研者）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 Investigator 子项目 MVP：调研主题管理（飞书 Bitable 源配置 + 字段映射）、同步链路（拉取记录 → LLM 结构化 → 幂等入库）、结果查看与主题总结、按记录推送 outbox 事件（打通需求主线第一环），CI 全绿后合并 main。

**Architecture:** 沿用 Applicant 模式（NestJS + pg 直连 + React/AntD）。FeishuClient 封装 token 缓存与分页拉取，带 FEISHU_STUB 桩模式；LLM 复用 @mt/model-client + MT_LLM_STUB；推送复用 @mt/db outbox（本应用迁移含 outbox DDL）。Nest 构造注入一律显式 @Inject（tsx 无装饰器元数据）。

**Tech Stack:** NestJS 10 / PostgreSQL 16（investigator 库）/ React 18 + AntD 5 + react-router-dom / zod / Playwright。

**设计依据：** docs/superpowers/specs/2026-08-19-investigator-design.md（✅ I1~I4 已确认）；飞书契约 docs/integrations/feishu-setup.md + 逆向核实记录。
**执行分支：** dev（已建并含 spec 定稿提交 40ab2d9），PR dev→main。

## Global Constraints

- Node.js >= 20；pnpm.cmd 9；TS strict；TDD；禁止 TODO/TBD
- **Nest 构造注入必须显式 @Inject**；**本地 dev 前先 `pnpm.cmd exec turbo run build --filter=@mt/investigator-server`（fresh checkout 无依赖 dist）**
- 端口：investigator web 4002 / server 5002（ports.yaml 已登记）；独立库 investigator
- 飞书：Bearer tenant_access_token（缓存 7200s 提前 5 分钟刷新）；列表接口 20 次/秒限流 → 客户端 100ms 最小间隔 + 退避；FEISHU_STUB=1 桩模式（CI/E2E）
- LLM：MT_LLM_STUB=1 桩模式；结构化 schema 固定（需求点/痛点/期望/情绪/优先级/摘要）
- 同步幂等：UNIQUE(survey_id, record_id) upsert；推送事件 event 名 researcher.response.push
- Conventional Commits 中文 subject；每任务独立提交；任务完成后更新 docs/memory 与 changeset

## 文件地图（新增/修改）

~~~
infra/postgres-init.sql（增补 CREATE DATABASE investigator）
apps/investigator/server/
├─ package.json（加 @mt/db、@mt/model-client、zod）
├─ migrations/001_investigator_core.sql、002_outbox.sql
├─ src/db.ts、src/llm.ts、src/schemas.ts
├─ src/feishu/{client.ts,client.test.ts}
├─ src/survey.{repo,service,controller}.ts + survey.e2e.test.ts
└─ src/main.ts、src/app.module.ts（改造）
apps/investigator/web/
├─ package.json（react-router-dom）
├─ src/App.tsx（路由）、src/api.ts、src/test-setup.ts（matchMedia polyfill）
├─ src/pages/{SurveyList,SurveyDetail}.tsx
└─ src/components/{SurveyForm,ResponsesTable}.tsx
e2e/tests/investigator.spec.ts
.github/workflows/ci.yml（investigator 服务 env + smoke/e2e 检查）
.changeset/investigator-mvp.md
~~~

---

### Task 1: FeishuClient（token 缓存 + 分页拉取 + 字段归一化 + 桩模式）

**Files:**
- Create: `apps/investigator/server/src/feishu/client.ts`
- Test: `apps/investigator/server/src/feishu/client.test.ts`

**Interfaces:**
- Consumes: 无（Node fetch）
- Produces: `FeishuClient`：`isConfigured()`、`listTables(appToken)`、`listFields(appToken, tableId)`、`listRecords(appToken, tableId): Promise<Array<{ recordId: string; fields: Record<string, string[]> }>>`（内部 token 缓存 + 分页循环 + normalizeFields）；FEISHU_STUB=1 时返回两条固定记录

- [ ] **Step 1: 写失败测试 client.test.ts**

~~~ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { FeishuClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

const okEnvelope = (data: unknown) => JSON.stringify({ code: 0, msg: "success", data });

describe("FeishuClient", () => {
  it("token 已缓存时不重复申请", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(okEnvelope({ tenant_access_token: "t-1", expire: 7200 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(okEnvelope({ has_more: false, items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new FeishuClient({ appId: "a", appSecret: "s" });
    await c.listRecords("app1", "tbl1");
    await c.listRecords("app1", "tbl1");
    const tokenCalls = fetchMock.mock.calls.filter(([, init]) => String((init as RequestInit & { body?: string }).body ?? "").includes("tenant_access_token"));
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
      .mockResolvedValueOnce(new Response(okEnvelope({ tenant_access_token: "t-1", expire: 7200 }), { status: 200 }))
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
      .mockResolvedValueOnce(new Response(okEnvelope({ tenant_access_token: "t-1", expire: 7200 }), { status: 200 }))
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
~~~

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd --filter @mt/investigator-server test`
Expected: FAIL（client 不存在）

- [ ] **Step 3: 实现 src/feishu/client.ts**

~~~ts
interface FeishuConfig {
  appId?: string;
  appSecret?: string;
  baseUrl?: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

function normalizeValue(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (typeof v === "string") return [v];
  if (typeof v === "number") return [String(v)];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") return [o.text];
    if (typeof o.name === "string") return [o.name];
    return [JSON.stringify(o)];
  }
  return [String(v)];
}

export class FeishuClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl: string;
  private tokenCache: TokenCache | null = null;
  private stub = false;

  constructor(config: FeishuConfig = {}) {
    this.appId = config.appId ?? process.env.FEISHU_APP_ID ?? "";
    this.appSecret = config.appSecret ?? process.env.FEISHU_APP_SECRET ?? "";
    this.baseUrl = (config.baseUrl ?? "https://open.feishu.cn").replace(/\/+$/, "");
    if (process.env.FEISHU_STUB === "1") this.stub = true;
  }

  setStub(value: boolean) {
    this.stub = value;
  }

  isConfigured(): boolean {
    return this.stub || (this.appId.length > 0 && this.appSecret.length > 0);
  }

  private async getTenantToken(): Promise<string> {
    if (this.stub) return "stub-token";
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 5 * 60 * 1000) {
      return this.tokenCache.token;
    }
    const response = await fetch(this.baseUrl + "/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    });
    const body = (await response.json()) as { code: number; msg?: string; tenant_access_token?: string; expire?: number };
    if (body.code !== 0 || !body.tenant_access_token) {
      throw new Error("获取 tenant_access_token 失败: " + (body.msg || body.code));
    }
    this.tokenCache = { token: body.tenant_access_token, expiresAt: Date.now() + (body.expire ?? 7200) * 1000 };
    return body.tenant_access_token;
  }

  private async request<T>(path: string): Promise<T> {
    const token = await this.getTenantToken();
    const response = await fetch(this.baseUrl + path, {
      headers: { Authorization: "Bearer " + token },
    });
    const body = (await response.json()) as { code: number; msg?: string; data?: T };
    if (!response.ok) throw new Error("HTTP " + response.status);
    if (body.code !== 0) throw new Error("飞书错误 " + body.code + ": " + (body.msg ?? ""));
    return body.data as T;
  }

  async listTables(appToken: string): Promise<Array<{ tableId: string; name: string }>> {
    if (this.stub) return [{ tableId: "tblstub", name: "示例表" }];
    const data = await this.request<{ items?: Array<{ table_id: string; name: string }> }>(
      "/open-apis/bitable/v1/apps/" + appToken + "/tables?page_size=100"
    );
    return (data.items ?? []).map((t) => ({ tableId: t.table_id, name: t.name }));
  }

  async listFields(appToken: string, tableId: string): Promise<string[]> {
    if (this.stub) return ["问题", "回答"];
    const data = await this.request<{ items?: Array<{ field_name: string }> }>(
      "/open-apis/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/fields?page_size=100"
    );
    return (data.items ?? []).map((f) => f.field_name);
  }

  async listRecords(appToken: string, tableId: string): Promise<Array<{ recordId: string; fields: Record<string, string[]> }>> {
    if (this.stub) {
      return [
        { recordId: "recstub1", fields: { 问题: ["你觉得现在最大的痛点是什么"], 回答: ["报表导出太慢，每天要等半小时"] } },
        { recordId: "recstub2", fields: { 问题: ["你最希望改进什么"], 回答: ["希望支持批量操作和模板"] } },
      ];
    }
    const records: Array<{ recordId: string; fields: Record<string, string[]> }> = [];
    let pageToken: string | undefined;
    do {
      const path =
        "/open-apis/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records?page_size=500" + (pageToken ? "&page_token=" + encodeURIComponent(pageToken) : "");
      const data = await this.request<{ has_more?: boolean; page_token?: string; items?: Array<{ record_id: string; fields: Record<string, unknown> }> }>(path);
      for (const item of data.items ?? []) {
        const fields: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(item.fields ?? {})) {
          fields[key] = normalizeValue(value);
        }
        records.push({ recordId: item.record_id, fields });
      }
      pageToken = data.has_more ? data.page_token : undefined;
      await new Promise((resolve) => setTimeout(resolve, 100)); // 限流 20 次/秒
    } while (pageToken);
    return records;
  }
}
~~~

- [ ] **Step 4: 运行确认通过**

Run: `pnpm.cmd --filter @mt/investigator-server test`
Expected: PASS（4 用例）

- [ ] **Step 5: Commit**

~~~bash
git add apps/investigator/server/src/feishu
git commit -m "feat(investigator): FeishuClient 支持令牌缓存、分页拉取与桩模式"
~~~

---

### Task 2: investigator 数据层（库、迁移、LLM/schema 装配）

**Files:**
- Modify: `infra/postgres-init.sql`（增补 investigator 库）
- Create: `apps/investigator/server/migrations/001_investigator_core.sql`、`migrations/002_outbox.sql`
- Create: `apps/investigator/server/src/db.ts`、`src/llm.ts`、`src/schemas.ts`
- Modify: `apps/investigator/server/package.json`、`src/main.ts`（迁移装配）
- Test: `apps/investigator/server/src/llm.test.ts`（桩模式）

**Interfaces:**
- Consumes: @mt/db、@mt/model-client
- Produces: `pool`（investigator 库）、`migrate()`、`llmChat(messages, opts)`（MT_LLM_STUB 桩，含结构化/总结两类桩）、`responseStructuredSchema`、`surveyInputSchema`（zod，后续任务消费）

- [ ] **Step 1: 修改 infra/postgres-init.sql**

~~~sql
CREATE DATABASE applicant;
CREATE DATABASE investigator;
~~~

- [ ] **Step 2: 创建迁移**

001_investigator_core.sql：

~~~sql
CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'feishu_bitable',
  app_token text NOT NULL DEFAULT '',
  table_id text NOT NULL DEFAULT '',
  answer_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT surveys_status_check CHECK (status IN ('active','archived'))
);

CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  record_id text NOT NULL,
  raw_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  structured jsonb NOT NULL DEFAULT '{}'::jsonb,
  sentiment text NOT NULL DEFAULT 'neutral',
  priority text NOT NULL DEFAULT 'P2',
  summary text NOT NULL DEFAULT '',
  pushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT responses_unique_record UNIQUE (survey_id, record_id),
  CONSTRAINT responses_sentiment_check CHECK (sentiment IN ('positive','neutral','negative')),
  CONSTRAINT responses_priority_check CHECK (priority IN ('P0','P1','P2'))
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  error text
);
~~~

002_outbox.sql（与 @mt/db 001 相同 DDL，本应用独立迁移）：

~~~sql
CREATE TABLE IF NOT EXISTS outbox (
  id text PRIMARY KEY,
  event text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (status, attempts, occurred_at);
~~~

- [ ] **Step 3: 写失败测试 llm.test.ts（桩模式）**

~~~ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { llmChat } from "./llm";

const original = process.env.MT_LLM_STUB;

beforeAll(() => { process.env.MT_LLM_STUB = "1"; });
afterAll(() => { delete process.env.MT_LLM_STUB; if (original) process.env.MT_LLM_STUB = original; });

describe("llmChat stub 模式", () => {
  it("结构化提示返回固定 schema 桩", async () => {
    const out = await llmChat([
      { role: "system", content: "输出结构化调研字段（requirements/painPoints/expectations/sentiment/priority/summary）" },
      { role: "user", content: "回答：报表太慢" },
    ]);
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed.requirements)).toBe(true);
    expect(parsed.sentiment).toBeTruthy();
    expect(parsed.priority).toBeTruthy();
  });

  it("总结提示返回 summary 桩", async () => {
    const out = await llmChat([
      { role: "system", content: "输出 JSON：{summary: 字符串}" },
      { role: "user", content: "一批回答" },
    ]);
    const parsed = JSON.parse(out);
    expect(typeof parsed.summary).toBe("string");
    expect(parsed.summary.length).toBeGreaterThan(0);
  });
});
~~~

- [ ] **Step 4: 运行确认失败**

Run: `pnpm.cmd --filter @mt/investigator-server test`
Expected: FAIL（llm 模块不存在）

- [ ] **Step 5: 实现 db.ts / llm.ts / schemas.ts + 装配**

package.json dependencies 增补 `"@mt/db": "workspace:*"`、`"@mt/model-client": "workspace:*"`、`"zod": "^3.23.0"`。

db.ts：

~~~ts
import { join } from "node:path";
import { createPool, runMigrations } from "@mt/db";

export const pool = createPool(
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/investigator"
);

export async function migrate(): Promise<void> {
  await runMigrations(pool, join(__dirname, "..", "migrations"));
}
~~~

llm.ts：

~~~ts
import { createModelClient, type ChatMessage, type ChatOptions } from "@mt/model-client";
import { ZHIPU } from "@mt/model-client";

const client = createModelClient(ZHIPU, (u) => console.log("[llm]", u.model, u.ms + "ms"));

export async function llmChat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  if (process.env.MT_LLM_STUB === "1") {
    return JSON.stringify({ stub: true, ...JSON.parse(stubPayloadFor(messages)) });
  }
  const result = await client.chat(messages, options);
  return result.content;
}

function stubPayloadFor(messages: ChatMessage[]): string {
  const system = messages.find((m) => m.role === "system");
  const sysText = typeof system?.content === "string" ? system.content : "";
  // 顺序敏感：结构化提示中包含 summary 字段名，先判结构化再判总结
  if (sysText.includes("结构化")) {
    return JSON.stringify({
      requirements: ["批量操作能力", "报表性能优化"],
      painPoints: ["导出慢"],
      expectations: ["更快更省事"],
      sentiment: "negative",
      priority: "P1",
      summary: "受访者希望提升效率",
    });
  }
  return "{}";
}
~~~

schemas.ts：

~~~ts
import { z } from "zod";

export const responseStructuredSchema = z.object({
  requirements: z.array(z.string()).default([]),
  painPoints: z.array(z.string()).default([]),
  expectations: z.array(z.string()).default([]),
  sentiment: z.enum(["positive", "neutral", "negative"]).default("neutral"),
  priority: z.enum(["P0", "P1", "P2"]).default("P2"),
  summary: z.string().default(""),
});

export const surveyInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  appToken: z.string().default(""),
  tableId: z.string().default(""),
  answerFields: z.array(z.string()).default([]),
});
~~~

main.ts 改造（同 Applicant 模式）：import migrate → listen 后 try { await migrate(); console.log("migrations applied"); } catch → 断连降级。

- [ ] **Step 6: 运行确认通过 + 本地建库验证**

Run: `pnpm.cmd --filter @mt/investigator-server test` → PASS（2 桩 + 既有 health）
Run: `docker exec magictools-postgres-1 createdb -U postgres investigator`（已存在忽略）→ 启动 server → `docker exec magictools-postgres-1 psql -U postgres -d investigator -c '\\dt'`
Expected: surveys/responses/sync_runs/outbox/schema_migrations 5 张表

- [ ] **Step 7: Commit**

~~~bash
git add infra/postgres-init.sql apps/investigator/server pnpm-lock.yaml
git commit -m "feat(investigator): 建立独立数据库、核心表迁移与 LLM 桩模式"
~~~

---

### Task 3: surveys CRUD 与飞书源配置（server + e2e）

**Files:**
- Create: `apps/investigator/server/src/survey.repo.ts`、`src/survey.service.ts`、`src/survey.controller.ts`
- Modify: `apps/investigator/server/src/app.module.ts`
- Test: `apps/investigator/server/src/survey.e2e.test.ts`

**Interfaces:**
- Consumes: T2 pool/schemas；T1 FeishuClient（meta/feishu-status 用）
- Produces: `SurveyRow`、`listSurveys/getSurvey/createSurvey/updateSurvey`、REST：`GET/POST /surveys`、`GET/PATCH /surveys/:id`、`GET /meta/feishu-status`（后续 T4~T6 复用）

- [ ] **Step 1: 写失败测试 survey.e2e.test.ts（DB skip 模式，同 Applicant 模式）**

~~~ts
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { migrate, pool } from "./db";

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    await migrate();
    available = true;
    await pool.query("DELETE FROM surveys WHERE name = 'E2E调研'");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/investigator");
    await app.init();
  } catch {
    available = false;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("surveys", () => {
  it("创建并列出调研主题", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer())
      .post("/api/investigator/surveys")
      .send({ name: "E2E调研", appToken: "appX", tableId: "tblX", answerFields: ["回答"] });
    expect(created.status).toBe(201);
    expect(created.body.appToken).toBe("appX");

    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    expect(list.status).toBe(200);
    expect(list.body.some((s: { name: string }) => s.name === "E2E调研")).toBe(true);
  });

  it("更新主题状态到 archived", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const patched = await request(app.getHttpServer())
      .patch("/api/investigator/surveys/" + target.id)
      .send({ status: "archived" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("archived");
  });

  it("feishu-status 未配置凭证返回明确状态", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_STUB;
    const res = await request(app.getHttpServer()).get("/api/investigator/meta/feishu-status");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });
});
~~~

- [ ] **Step 2: 运行确认失败 → Step 3: 实现**

survey.repo.ts（模式同 Applicant position.repo：listSurveys/getSurvey/createSurvey/updateSurvey，列映射 surveys 表）；survey.service.ts（list/get/create/update + feishuStatus()：new FeishuClient() 判断 isConfigured，桩模式提示）；survey.controller.ts（@Inject 显式注入，路由如上）；app.module.ts 注册 SurveyController/SurveyService。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm.cmd --filter @mt/investigator-server test`
Expected: PASS（3 e2e + 既有）

- [ ] **Step 5: Commit**

~~~bash
git add apps/investigator/server
git commit -m "feat(investigator): 调研主题 CRUD 与飞书源配置"
~~~

---

### Task 4: 同步链路（拉取 + 结构化 + 幂等入库）

**Files:**
- Modify: `apps/investigator/server/src/survey.service.ts`（sync 方法）、`src/survey.controller.ts`（sync 端点）
- Create: `apps/investigator/server/src/response.repo.ts`
- Test: `apps/investigator/server/src/survey.e2e.test.ts`（加 sync 用例，FEISHU_STUB + MT_LLM_STUB）

**Interfaces:**
- Consumes: T1 listRecords；T2 llmChat/responseStructuredSchema
- Produces: `POST /surveys/:id/sync → { fetchedCount, processedCount }`；`upsertResponse`（UNIQUE(survey_id, record_id) 冲突更新）

- [ ] **Step 1: 写失败测试（e2e 追加）**

~~~ts
  it("同步拉取并结构化（双桩模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.FEISHU_STUB = "1";
    process.env.MT_LLM_STUB = "1";
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const res = await request(app.getHttpServer()).post("/api/investigator/surveys/" + target.id + "/sync");
    delete process.env.FEISHU_STUB;
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(res.body.fetchedCount).toBeGreaterThan(0);
    expect(res.body.processedCount).toBe(res.body.fetchedCount);

    const responses = await request(app.getHttpServer()).get("/api/investigator/surveys/" + target.id + "/responses");
    expect(responses.status).toBe(200);
    expect(responses.body.length).toBeGreaterThan(0);
    expect(responses.body[0].structured).toHaveProperty("requirements");
  });
~~~

- [ ] **Step 2: 运行确认失败 → Step 3: 实现**

response.repo.ts：

~~~ts
import { pool } from "./db";

export interface ResponseRow {
  id: string;
  surveyId: string;
  recordId: string;
  rawFields: Record<string, string[]>;
  structured: Record<string, unknown>;
  sentiment: string;
  priority: string;
  summary: string;
  pushedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): ResponseRow {
  return {
    id: r.id as string,
    surveyId: r.survey_id as string,
    recordId: r.record_id as string,
    rawFields: (r.raw_fields as Record<string, string[]>) ?? {},
    structured: (r.structured as Record<string, unknown>) ?? {},
    sentiment: r.sentiment as string,
    priority: r.priority as string,
    summary: r.summary as string,
    pushedAt: r.pushed_at ? new Date(r.pushed_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listResponses(surveyId: string, filters: { sentiment?: string; priority?: string } = {}): Promise<ResponseRow[]> {
  const where: string[] = ["survey_id = $1"];
  const params: unknown[] = [surveyId];
  if (filters.sentiment) { params.push(filters.sentiment); where.push("sentiment = $" + params.length); }
  if (filters.priority) { params.push(filters.priority); where.push("priority = $" + params.length); }
  const rows = await pool.query("SELECT * FROM responses WHERE " + where.join(" AND ") + " ORDER BY created_at ASC", params);
  return rows.rows.map(mapRow);
}

export async function upsertResponse(input: {
  surveyId: string;
  recordId: string;
  rawFields: Record<string, string[]>;
  structured: Record<string, unknown>;
  sentiment: string;
  priority: string;
  summary: string;
}): Promise<void> {
  await pool.query(
    "INSERT INTO responses (survey_id, record_id, raw_fields, structured, sentiment, priority, summary) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (survey_id, record_id) DO UPDATE SET raw_fields = EXCLUDED.raw_fields, structured = EXCLUDED.structured, sentiment = EXCLUDED.sentiment, priority = EXCLUDED.priority, summary = EXCLUDED.summary, updated_at = now()",
    [input.surveyId, input.recordId, JSON.stringify(input.rawFields), JSON.stringify(input.structured), input.sentiment, input.priority, input.summary]
  );
}

export async function startSyncRun(surveyId: string): Promise<string> {
  const rows = await pool.query("INSERT INTO sync_runs (survey_id) VALUES ($1) RETURNING id", [surveyId]);
  return rows.rows[0].id as string;
}

export async function finishSyncRun(runId: string, stats: { fetchedCount: number; processedCount: number; error?: string }): Promise<void> {
  await pool.query(
    "UPDATE sync_runs SET finished_at = now(), fetched_count = $2, processed_count = $3, error = $4 WHERE id = $1",
    [runId, stats.fetchedCount, stats.processedCount, stats.error ?? null]
  );
}

export async function touchSurveySyncedAt(surveyId: string): Promise<void> {
  await pool.query("UPDATE surveys SET last_synced_at = now() WHERE id = $1", [surveyId]);
}
~~~

survey.service.ts 增补 sync：

~~~ts
const STRUCTURE_PROMPT =
  "你是需求调研分析助手。将受访者的回答结构化为 JSON：requirements（需求点数组）、painPoints（痛点数组）、expectations（期望数组）、sentiment（positive/neutral/negative）、priority（P0/P1/P2）、summary（一句话摘要）。只输出 JSON。回答：";

async sync(surveyId: string) {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new NotFoundException("调研主题不存在");
  const runId = await startSyncRun(surveyId);
  const client = new FeishuClient();
  const fetched: Array<{ recordId: string; fields: Record<string, string[]> }> = [];
  let error: string | undefined;
  try {
    const records = await client.listRecords(survey.appToken, survey.tableId);
    fetched.push(...records);
  } catch (err) {
    error = String(err);
    await finishSyncRun(runId, { fetchedCount: 0, processedCount: 0, error });
    throw new BadGatewayException("飞书拉取失败: " + error);
  }
  let processed = 0;
  const answerFields = (survey.answerFields as string[]) ?? [];
  for (const record of fetched) {
    const answerText = answerFields
      .map((f) => (record.fields[f] ?? []).join("；"))
      .filter(Boolean)
      .join("\n");
    if (!answerText) continue;
    try {
      const raw = await llmChat([
        { role: "system", content: "只输出 JSON。" },
        { role: "user", content: STRUCTURE_PROMPT + answerText.slice(0, 3000) },
      ]);
      const structured = responseStructuredSchema.parse(JSON.parse(raw));
      await upsertResponse({
        surveyId,
        recordId: record.recordId,
        rawFields: record.fields,
        structured,
        sentiment: structured.sentiment,
        priority: structured.priority,
        summary: structured.summary,
      });
      processed += 1;
    } catch (err) {
      console.warn("[sync] 单条结构化失败: " + String(err));
    }
  }
  await touchSurveySyncedAt(surveyId);
  await finishSyncRun(runId, { fetchedCount: fetched.length, processedCount: processed, error });
  return { fetchedCount: fetched.length, processedCount: processed };
}
~~~

controller 增补 `@Post(":id/sync")` 与 `@Get(":id/responses")`（listResponses + sentiment/priority query）。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm.cmd --filter @mt/investigator-server test`
Expected: PASS（4 e2e + 既有）

- [ ] **Step 5: Commit**

~~~bash
git add apps/investigator/server
git commit -m "feat(investigator): 飞书拉取与 LLM 结构化同步链路"
~~~

---

### Task 5: 主题总结 + Task 6: 推送 outbox（合并实现）

**Files:**
- Modify: `apps/investigator/server/src/survey.service.ts`、`src/survey.controller.ts`
- Test: `apps/investigator/server/src/survey.e2e.test.ts`（加 summarize/push 用例）

**Interfaces:**
- Consumes: T4 responses；@mt/db appendOutbox；@mt/utils idempotencyKey
- Produces: `POST /surveys/:id/summarize → { summary }`；`POST /surveys/:id/push { recordIds } → { pushedCount, eventIds }`；事件 researcher.response.push

- [ ] **Step 1: 写失败测试（e2e 追加）**

~~~ts
  it("生成主题总结（桩模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.MT_LLM_STUB = "1";
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const res = await request(app.getHttpServer()).post("/api/investigator/surveys/" + target.id + "/summarize");
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(typeof res.body.summary).toBe("string");
  });

  it("推送记录写 outbox 事件并标记", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const responses = await request(app.getHttpServer()).get("/api/investigator/surveys/" + target.id + "/responses");
    const ids = responses.body.map((r: { id: string }) => r.id).slice(0, 2);
    const res = await request(app.getHttpServer())
      .post("/api/investigator/surveys/" + target.id + "/push")
      .send({ recordIds: ids });
    expect(res.status).toBe(201);
    expect(res.body.pushedCount).toBe(ids.length);

    const outboxRows = await pool.query("SELECT * FROM outbox WHERE event = 'researcher.response.push' ORDER BY occurred_at DESC LIMIT 2");
    expect(outboxRows.rowCount).toBeGreaterThanOrEqual(ids.length);
  });
~~~

- [ ] **Step 2: 运行确认失败 → Step 3: 实现**

service 增补：

~~~ts
import { appendOutbox } from "@mt/db";
import { idempotencyKey } from "@mt/utils";

const SUMMARY_PROMPT = "你是调研分析师。根据以下结构化调研结果写一段 150 字内的主题总结（覆盖主要需求、痛点与建议）。只输出 JSON：{summary: 字符串}。结果：";

async summarize(surveyId: string) {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new NotFoundException("调研主题不存在");
  const responses = await listResponses(surveyId);
  const raw = await llmChat([
    { role: "system", content: "只输出 JSON。" },
    { role: "user", content: SUMMARY_PROMPT + JSON.stringify(responses.map((r) => r.structured).slice(0, 50)) },
  ]);
  const parsed = JSON.parse(raw) as { summary?: string };
  const summary = parsed.summary ?? "";
  await setSurveySummary(surveyId, summary);
  return { summary };
}

async push(surveyId: string, recordIds: string[]) {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new NotFoundException("调研主题不存在");
  const responses = await listResponses(surveyId);
  const targets = responses.filter((r) => recordIds.includes(r.id));
  const eventIds: string[] = [];
  for (const r of targets) {
    const eventId = idempotencyKey("researcher-response-push");
    await appendOutbox(pool, {
      id: eventId,
      event: "researcher.response.push",
      source: "investigator",
      payload: {
        surveyId,
        surveyName: survey.name,
        responseId: r.id,
        recordId: r.recordId,
        structured: r.structured,
        sentiment: r.sentiment,
        priority: r.priority,
      },
      occurredAt: new Date().toISOString(),
    });
    await markPushed(r.id);
    eventIds.push(eventId);
  }
  return { pushedCount: targets.length, eventIds };
}
~~~

response.repo.ts 增补 `setSurveySummary`（survey.repo）与 `markPushed(id)`（UPDATE responses SET pushed_at = now()）。controller 增补两个端点。

- [ ] **Step 4: 运行确认通过 + Commit**

Run: `pnpm.cmd --filter @mt/investigator-server test`
Expected: PASS（6 e2e + 既有）

~~~bash
git add apps/investigator/server
git commit -m "feat(investigator): 主题总结与推送 outbox 事件"
~~~

---

### Task 7: web 前端（主题列表/详情/结果）

**Files:**
- Create: `apps/investigator/web/src/{api.ts,test-setup.ts}`、`src/pages/{SurveyList,SurveyDetail}.tsx`、`src/components/{SurveyForm,ResponsesTable}.tsx`
- Modify: `apps/investigator/web/package.json`（react-router-dom）、`src/App.tsx`、`vitest.config.ts`（setupFiles）
- Test: `apps/investigator/web/src/pages/SurveyList.test.tsx`

**Interfaces:**
- Consumes: T3~T6 REST；@mt/ui
- Produces: 前端两页：主题列表（含新建表单：名称/描述/appToken/tableId/answerFields 逗号分隔）、主题详情（同步按钮 + sync 结果、responses 表格（情绪/优先级 Tag 筛选、推送勾选 + 推送按钮）、总结卡片、复制链接 + webhook 发送按钮）

- [ ] **Step 1: 写失败测试 SurveyList.test.tsx（mock fetch 渲染列表）→ Step 2: RED → Step 3: 实现**

api.ts（模式同 Applicant：request 封装 + types + listSurveys/createSurvey/getSurvey/patchSurvey/syncSurvey/listResponses/summarizeSurvey/pushResponses/feishuStatus）；App.tsx 路由（/surveys、/surveys/:id，basename /investigator）；SurveyForm（Modal + Form：name/description/appToken/tableId/answerFields（逗号分隔转数组））；SurveyList（Table + 新建按钮 + 状态 Tag）；SurveyDetail（Descriptions + 同步按钮（loading + 结果 message）+ ResponsesTable（rowSelection + 情绪/优先级筛选 + 推送按钮）+ 总结 Alert + 「复制问卷链接」「webhook 发送」按钮（未配置 webhook 时 disabled + Tooltip 提示））；test-setup.ts（matchMedia polyfill，同 Applicant）。

- [ ] **Step 4: 运行确认通过（web 测试 + turbo 构建）**

Run: `pnpm.cmd --filter @mt/investigator-web test` → PASS
Run: `pnpm.cmd exec turbo run build --filter=@mt/investigator-web` → 成功

- [ ] **Step 5: Commit**

~~~bash
git add apps/investigator/web pnpm-lock.yaml
git commit -m "feat(investigator): 主题列表与详情页（同步/结果/推送）"
~~~

---

### Task 8: 飞书分发辅助（webhook 发送）

**Files:**
- Modify: `apps/investigator/server/src/survey.controller.ts`、`src/survey.service.ts`
- Test: `apps/investigator/server/src/survey.e2e.test.ts`（未配置 webhook 返回明确错误）

**Interfaces:**
- Consumes: T3 surveys
- Produces: `POST /surveys/:id/send-link → { sent: true } | 409 未配置`

- [ ] **Step 1: 写失败测试**

~~~ts
  it("未配置 webhook 时发送链接返回 409", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    delete process.env.FEISHU_BOT_WEBHOOK;
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const res = await request(app.getHttpServer()).post("/api/investigator/surveys/" + target.id + "/send-link");
    expect(res.status).toBe(409);
  });
~~~

- [ ] **Step 2: RED → Step 3: 实现**

service：

~~~ts
async sendLink(surveyId: string) {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new NotFoundException("调研主题不存在");
  const webhook = process.env.FEISHU_BOT_WEBHOOK;
  if (!webhook) throw new ConflictException("未配置 FEISHU_BOT_WEBHOOK，无法发送到群");
  const link = "飞书问卷请通过飞书创建并关联到多维表格 " + survey.appToken + "（表 " + survey.tableId + "）";
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msg_type: "text", content: { text: "调研主题「" + survey.name + "」问卷：请在飞书中填写（多维表格 " + survey.appToken + "）。" + link } }),
  });
  const body = (await response.json().catch(() => ({}))) as { code?: number };
  if (!response.ok || (body.code !== undefined && body.code !== 0)) {
    throw new BadGatewayException("飞书 webhook 发送失败");
  }
  return { sent: true };
}
~~~

controller 增补端点。.env.template 已有 FEISHU_BOT_WEBHOOK 键位（无需改）。

- [ ] **Step 4: GREEN + Commit**

~~~bash
git add apps/investigator/server
git commit -m "feat(investigator): 群机器人 webhook 分发辅助"
~~~

---

### Task 9: E2E + CI 适配 + 收尾

**Files:**
- Create: `e2e/tests/investigator.spec.ts`
- Modify: `.github/workflows/ci.yml`（investigator 服务 env + smoke/e2e 加 investigator 检查）
- Modify: `infra/compose.prod.yml`（investigator-server DATABASE_URL → /investigator）
- Create: `.changeset/investigator-mvp.md`

- [ ] **Step 1: e2e/tests/investigator.spec.ts（双桩模式全流程）**

~~~ts
import { test, expect } from "@playwright/test";

test("investigator 主题全流程（API 链路，双桩模式）", async ({ request }) => {
  const created = await request.post("/api/investigator/surveys", {
    data: { name: "E2E调研主题", appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  expect(created.ok()).toBeTruthy();
  const survey = await created.json();

  const synced = await request.post("/api/investigator/surveys/" + survey.id + "/sync");
  expect(synced.ok()).toBeTruthy();
  expect((await synced.json()).fetchedCount).toBeGreaterThan(0);

  const responses = await request.get("/api/investigator/surveys/" + survey.id + "/responses");
  expect(responses.ok()).toBeTruthy();
  const list = await responses.json();
  expect(list.length).toBeGreaterThan(0);

  const pushed = await request.post("/api/investigator/surveys/" + survey.id + "/push", {
    data: { recordIds: [list[0].id] },
  });
  expect(pushed.ok()).toBeTruthy();
  expect((await pushed.json()).pushedCount).toBe(1);
});

test("investigator 主题列表页面渲染", async ({ page, request }) => {
  await request.post("/api/investigator/surveys", { data: { name: "E2E页面主题" } });
  await page.goto("/investigator/surveys");
  await expect(page.getByText("E2E页面主题").first()).toBeVisible();
});
~~~

- [ ] **Step 2: ci.yml 适配**

- smoke 与 e2e job 的 postgres service env `POSTGRES_DB` 由单一库改为不依赖（用 init 方式不行，CI 服务容器支持多库？不支持）→ 方案：CI 的 postgres 保持 `POSTGRES_DB: applicant`（applicant 冒烟需要），investigator 服务连接的库改为同一服务里的 applicant 库？不行——investigator 服务用 `investigator` 库。**方案：CI postgres service 增加 init 挂载不可用，改为 job 步骤中创建库**：在「启动全部服务」步骤前加：

~~~bash
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE investigator" || true
~~~

需要安装 postgresql-client（quality job 已有先例：apt-get install postgresql-client）→ smoke/e2e 也加同一安装步骤。
- smoke：启动 investigator-server（node apps/investigator/server/dist/main.js &，env PORT 5002、DATABASE_URL .../investigator、FEISHU_STUB=1、MT_LLM_STUB=1）→ `node infra/scripts/smoke.mjs --only investigator`
- e2e：同样启动 investigator-server（双桩 env）→ playwright

- [ ] **Step 3: compose.prod.yml**

- investigator-server 的 DATABASE_URL 改 `postgres://postgres:postgres@postgres:5432/investigator`（其余保持 magictools）

- [ ] **Step 4: changeset + 文档**

.changeset/investigator-mvp.md：

~~~markdown
---
"@mt/investigator-server": minor
"@mt/investigator-web": minor
---

Phase 1 需求主线第一棒：Investigator 调研系统 MVP（飞书 Bitable 同步、LLM 结构化、结果查看、主题总结、outbox 推送）。
~~~

- [ ] **Step 5: DoD 验证 + PR**

Run: `pnpm.cmd qa:gate` → 本地双桩栈 smoke/E2E → 全绿后 `git push origin dev` → PR dev→main → CI 三检查全绿 → API 合并 → 删除 dev → 清理 worktree → 更新 docs/memory 与 docs/CHANGELOG（随实现提交）。

## 验收标准（Investigator DoD）

1. 主题 CRUD + 飞书源与字段映射配置（e2e 覆盖）
2. 同步链路双桩 E2E：拉取→结构化→幂等入库（重复同步不产生重复记录）
3. 结果筛选、主题总结、推送 outbox 事件（事件名 researcher.response.push，契约供 Assessor 消费）
4. CI 全绿（quality/smoke/e2e），changeset 与文档同步，PR 合并 main
