# Applicant（求职者）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 Applicant 子项目 MVP：岗位管理（CRUD+看板+JD 文本解析+截图识别）、面试复盘（记录+LLM 分析+导出）、简历管理（ClawCV analyze/rewrite/match + 无 Key 自动降级），CI 全绿后合并 main。

**Architecture:** 沿用 Phase 0 骨架（NestJS + pg 直连 + React/AntD）。数据访问用 @mt/db 连接池 + 手写 SQL repository + zod 校验（不引入 ORM，YAGNI）；LLM 统一走 @mt/model-client（本计划 T1 为其增加视觉能力）；ClawCV 走应用内 adapter（Bearer + 30s 超时 + 退避重试 + 降级）；LLM 提供 MT_LLM_STUB 桩模式保证 CI/E2E 无需真实密钥。

**Tech Stack:** NestJS 10 / PostgreSQL 16（applicant 库）/ React 18 + AntD 5 + react-router-dom 6 / zod / multer / Playwright。

**设计依据：** docs/superpowers/specs/2026-08-18-applicant-design.md（草案，假设 A1~A4 为默认值；任一假设被否决时先修订 spec 与本计划再执行对应任务）。
**执行分支：** 从 origin/main 重建 dev 分支并推送，全部任务在 dev 上提交，最终 PR dev→main（与 Phase 0 同流程）。

## Global Constraints

- Node.js >= 20；pnpm.cmd 9（本机执行策略）；TS strict；TDD（先失败测试再实现）；禁止 TODO/TBD
- 端口：applicant web 4008 / server 5008（infra/ports.yaml 已登记，不改动）
- applicant 使用独立数据库 applicant（PG 单实例多库）；迁移用 @mt/db runMigrations
- LLM 供应商：DeepSeek（无视觉）+ 智谱（含视觉 visionModel）；所有 LLM 调用必须支持 MT_LLM_STUB=1 桩模式（CI/E2E 用）
- ClawCV：无 Key 时所有简历功能自动降级为本地 LLM/提示，绝不抛 500
- 前端必须用 @mt/ui（MtThemeProvider + tokens），颜色禁止硬编码
- API 前缀 /api/applicant（server 全局前缀已配）；前端路由 /applicant/ 下（vite base 已配）
- Conventional Commits 中文 subject；每任务独立提交；任务完成后更新 docs/memory 与 changeset

## 文件地图（新增/修改）

~~~
packages/model-client/src/{types.ts,providers.ts,client.ts,client.test.ts}   # T1 视觉扩展
apps/applicant/server/
├─ package.json（加 zod、multer、@mt/db、@mt/model-client）
├─ migrations/001_applicant_core.sql                                      # T2
├─ src/db.ts、src/llm.ts、src/schemas.ts                                  # T2
├─ src/position.{controller,service,repo}.ts + *.test.ts                  # T3-T5
├─ src/interview.{controller,service,repo}.ts + *.test.ts                 # T6
├─ src/resume.{controller,service,repo}.ts + *.test.ts                    # T7
└─ src/clawcv/{client.ts,tools.ts,fallback.ts,client.test.ts}             # T7
apps/applicant/web/
├─ package.json（加 react-router-dom）
├─ src/App.tsx（路由壳）、src/api.ts（fetch 封装）
├─ src/pages/{PositionList,PositionDetail,InterviewPage,ResumeCenter}.tsx
└─ src/components/{StatusTag,PositionForm,JdParsePanel,ImageUploadPanel,InterviewForm,AnalysisView,ResumeList}.tsx
infra/postgres-init.sql（创建 applicant 库，供 compose.prod 初始化）       # T2
e2e/tests/applicant.spec.ts                                               # T9
.github/workflows/ci.yml（smoke/e2e 的 applicant 服务加 MT_LLM_STUB 与 applicant 库） # T9
docs/superpowers/specs/2026-08-18-applicant-design.md（A1~A4 确认后定稿）  # 执行前
~~~

---

### Task 1: @mt/model-client 视觉（多模态）扩展

**Files:**
- Modify: `packages/model-client/src/types.ts`、`src/providers.ts`、`src/client.ts`
- Test: `packages/model-client/src/client.test.ts`（新增 2 用例）

**Interfaces:**
- Consumes: Task 0 已有 model-client（chat/chatStream/buildRequest）
- Produces: `ChatMessage.content: string | ContentPart[]`；`ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }`；`ChatOptions.vision?: boolean`；`ModelProviderConfig.visionModel?: string`；路由规则：options.vision 为 true 时 model = options.model ?? provider.visionModel ?? provider.defaultModel（后续 Applicant 图片识别依赖）

- [ ] **Step 1: 写失败测试（client.test.ts 追加）**

~~~ts
it("vision 消息以数组形式透传并路由到视觉模型", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(okResponse), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const client = createModelClient(ZHIPU, () => {});
  await client.chat(
    [
      {
        role: "user",
        content: [
          { type: "text", text: "提取这个 JD 的岗位信息" },
          { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
        ],
      },
    ],
    { vision: true }
  );
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(String(init.body));
  expect(body.model).toBe("glm-4v-flash");
  expect(body.messages[0].content).toHaveLength(2);
  expect(body.messages[0].content[1].type).toBe("image_url");
});

it("未指定 visionModel 的供应商回退默认模型", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(okResponse), { status: 200 })));
  const client = createModelClient(DEEPSEEK, () => {});
  await client.chat([{ role: "user", content: "hi" }], { vision: true });
  expect(client).toBeTruthy();
});
~~~

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd --filter @mt/model-client test`
Expected: FAIL（visionModel 字段与内容透传未实现）

- [ ] **Step 3: 实现 types.ts / providers.ts / client.ts 变更**

types.ts 增补：

~~~ts
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  vision?: boolean;
}

export interface ModelProviderConfig {
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  defaultModel: string;
  visionModel?: string;
}
~~~

providers.ts 的 ZHIPU 增补：

~~~ts
export const ZHIPU: ModelProviderConfig = {
  name: "zhipu",
  baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  apiKeyEnv: "ZHIPU_API_KEY",
  defaultModel: "glm-4-flash",
  visionModel: "glm-4v-flash",
};
~~~

client.ts 的 buildRequest 与 chat 模型选择改为：

~~~ts
function resolveModel(provider: ModelProviderConfig, options: ChatOptions): string {
  if (options.model) return options.model;
  if (options.vision && provider.visionModel) return provider.visionModel;
  return provider.defaultModel;
}
~~~

（buildRequest 内 `const model = resolveModel(provider, options)`；chat 内 `const model = resolveModel(provider, options)`；stream 路径同样替换；其余逻辑不变）

- [ ] **Step 4: 运行确认通过**

Run: `pnpm.cmd --filter @mt/model-client test`
Expected: PASS（原有 4 + 新增 2 = 6 用例）

- [ ] **Step 5: Commit**

~~~bash
git add packages/model-client
git commit -m "feat(model-client): 新增多模态消息与视觉模型路由"
~~~

---

### Task 2: applicant 数据层（独立库、核心表迁移、DB/LLM 装配）

**Files:**
- Create: `infra/postgres-init.sql`
- Create: `apps/applicant/server/migrations/001_applicant_core.sql`
- Create: `apps/applicant/server/src/db.ts`、`src/llm.ts`、`src/schemas.ts`
- Modify: `apps/applicant/server/package.json`（依赖）、`src/main.ts`（启动迁移）、`src/app.module.ts`
- Test: `apps/applicant/server/src/llm.test.ts`、`src/schemas.test.ts`

**Interfaces:**
- Consumes: @mt/db（createPool/runMigrations）、@mt/model-client（T1 视觉扩展）
- Produces: `pool`（applicant 库连接池）、`migrate(pool)`、`llmChat(messages, opts)`（含 MT_LLM_STUB 桩）、`parseJdSchema`、`parsePositionImageSchema`、`interviewAnalysisSchema`（zod，后续任务消费）

- [ ] **Step 1: 创建 infra/postgres-init.sql**

~~~sql
CREATE DATABASE applicant;
~~~

> 说明：compose.prod 挂载此文件到 /docker-entrypoint-initdb.d/（Task 9 处理）；本地开发执行 docker exec magictools-postgres-1 createdb -U postgres applicant 一次即可。

- [ ] **Step 2: 创建迁移 001_applicant_core.sql**

~~~sql
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  title text NOT NULL,
  city text NOT NULL DEFAULT '',
  salary text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  jd_raw text NOT NULL DEFAULT '',
  jd_structured jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'waiting',
  applied_url text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT positions_status_check CHECK (status IN ('waiting','applied','written','interview','offer','rejected'))
);

CREATE TABLE IF NOT EXISTS interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1,
  happened_at timestamptz NOT NULL DEFAULT now(),
  qa_notes text NOT NULL DEFAULT '',
  reflection text NOT NULL DEFAULT '',
  analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'clawcv',
  content_text text NOT NULL DEFAULT '',
  clawcv_session_id text,
  last_analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resume_rewrites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  section_type text NOT NULL,
  original_text text NOT NULL,
  rewritten_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  match_score integer NOT NULL DEFAULT 0,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
~~~

- [ ] **Step 3: 写失败测试 llm.test.ts（桩模式）**

~~~ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { llmChat } from "./llm";

const original = process.env.MT_LLM_STUB;

beforeAll(() => { process.env.MT_LLM_STUB = "1"; });
afterAll(() => { delete process.env.MT_LLM_STUB; if (original) process.env.MT_LLM_STUB = original; });

describe("llmChat stub 模式", () => {
  it("返回可解析的 JSON 字符串", async () => {
    const out = await llmChat([{ role: "user", content: "任意输入" }]);
    const parsed = JSON.parse(out);
    expect(typeof parsed).toBe("object");
    expect(parsed.stub).toBe(true);
  });
});
~~~

- [ ] **Step 4: 运行确认失败**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: FAIL（llm 模块不存在）

- [ ] **Step 5: 实现 db.ts / llm.ts / schemas.ts 并更新 main.ts、package.json**

package.json dependencies 增补：`"@mt/db": "workspace:*"`、`"@mt/model-client": "workspace:*"`、`"zod": "^3.23.0"`、`"multer": "^1.4.5-lts.1"`；devDependencies 增补 `"@types/multer": "^1.4.11"`。

db.ts：

~~~ts
import { createPool, runMigrations } from "@mt/db";

export const pool = createPool(
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/applicant"
);

export async function migrate(): Promise<void> {
  await runMigrations(pool, process.cwd() + "/migrations");
}
~~~

llm.ts：

~~~ts
import { createModelClient, type ChatMessage, type ChatOptions } from "@mt/model-client";
import { ZHIPU } from "@mt/model-client";

const client = createModelClient(ZHIPU, (u) => console.log("[llm]", u.model, u.ms + "ms"));

export async function llmChat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  if (process.env.MT_LLM_STUB === "1") {
    return JSON.stringify({ stub: true, note: "MT_LLM_STUB 模式：CI/E2E 用桩响应", ...JSON.parse(stubPayloadFor(messages)) });
  }
  const result = await client.chat(messages, options);
  return result.content;
}

function stubPayloadFor(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1];
  const text = typeof last?.content === "string" ? last.content : "";
  const system = messages.find((m) => m.role === "system");
  const sysText = typeof system?.content === "string" ? system.content : "";
  if (sysText.includes("match_score")) {
    return JSON.stringify({ match_score: 66, strengths: ["匹配点一"], gaps: [{ area: "经验", description: "差距一" }], missing_keywords: ["关键词一"], recommended_changes: [{ type: "tailoring", description: "建议一" }] });
  }
  if (sysText.includes("score")) {
    return JSON.stringify({ score: 88, strengths: ["优势一"], weaknesses: ["短板一"], suggestions: ["建议一"] });
  }
  if (text.includes("JD")) return JSON.stringify({ company: "示例公司", title: "示例岗位", requirements: ["要求一"], duties: ["职责一"], keywords: ["关键词一"], salary: "", city: "" });
  if (text.includes("面试") || sysText.includes("面试")) return JSON.stringify({ questions: [{ category: "技术", question: "示例问题", comment: "示例点评" }], quality: "示例点评", suggestions: ["建议一"], actionItems: ["行动项一"] });
  return "{}";
}
~~~

schemas.ts（zod，供后续任务）：

~~~ts
import { z } from "zod";

export const parseJdSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  city: z.string().default(""),
  salary: z.string().default(""),
  requirements: z.array(z.string()).default([]),
  duties: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});

export const parsePositionImageSchema = parseJdSchema;

export const interviewAnalysisSchema = z.object({
  questions: z.array(z.object({ category: z.string(), question: z.string(), comment: z.string() })).default([]),
  quality: z.string().default(""),
  suggestions: z.array(z.string()).default([]),
  actionItems: z.array(z.string()).default([]),
});
~~~

main.ts 在 listen 后追加（沿用断连降级模式）：

~~~ts
  import { migrate } from "./db";
  try {
    await migrate();
    console.log("migrations applied");
  } catch (err) {
    console.warn("migrations unavailable, continuing: " + String(err));
  }
~~~

（migrate 引用放文件顶部 import 区）

- [ ] **Step 6: 运行确认通过**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: PASS（llm 桩 1 用例 + 既有 health 1 用例）

- [ ] **Step 7: 本地建库并验证迁移**

Run: `docker exec magictools-postgres-1 createdb -U postgres applicant`（若已存在忽略报错）→ 启动 server（`pnpm.cmd --filter @mt/applicant-server dev`）→ 查看日志 "migrations applied" → `docker exec magictools-postgres-1 psql -U postgres -d applicant -c '\\dt'`
Expected: 5 张表 + schema_migrations

- [ ] **Step 8: Commit**

~~~bash
git add infra/postgres-init.sql apps/applicant/server pnpm-lock.yaml
git commit -m "feat(applicant): 建立独立数据库与核心表迁移，接入 LLM 桩模式"
~~~

---

### Task 3: positions CRUD 与状态看板（server + web）

**Files:**
- Create: `apps/applicant/server/src/position.repo.ts`、`src/position.service.ts`、`src/position.controller.ts`
- Create: `apps/applicant/web/src/api.ts`、`src/pages/PositionList.tsx`、`src/pages/PositionDetail.tsx`、`src/components/StatusTag.tsx`、`src/components/PositionForm.tsx`
- Modify: `apps/applicant/server/src/app.module.ts`、`apps/applicant/web/package.json`（react-router-dom）、`web/src/App.tsx`
- Test: `server/src/position.e2e.test.ts`；`web/src/pages/PositionList.test.tsx`

**Interfaces:**
- Consumes: T2 的 pool/migrate、schemas；@mt/ui
- Produces: `PositionRow`、`PositionInput`、`listPositions/ getPosition/ createPosition/ updatePosition`、`PositionStatus = 'waiting'|'applied'|'written'|'interview'|'offer'|'rejected'`、REST 端点（后续 T4~T6 复用）；前端路由壳与 api.ts（后续页面复用）

- [ ] **Step 1: 写失败测试 server/src/position.e2e.test.ts（DB 不可达自动跳过）**

~~~ts
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { migrate, pool } from "./db";

let app: INestApplication;
let available = false;

beforeAll(async () => {
  const probe = new Pool({ connectionString: "postgres://postgres:postgres@127.0.0.1:5432/applicant", connectionTimeoutMillis: 2000 });
  try {
    await probe.query("SELECT 1");
    available = true;
    await probe.end();
    await migrate();
    await pool.query("DELETE FROM positions WHERE company = 'E2E测试公司'");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/applicant");
    await app.init();
  } catch {
    available = false;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("positions", () => {
  it("创建并列出岗位", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer())
      .post("/api/applicant/positions")
      .send({ company: "E2E测试公司", title: "后端工程师" });
    expect(created.status).toBe(201);
    expect(created.body.company).toBe("E2E测试公司");

    const list = await request(app.getHttpServer()).get("/api/applicant/positions");
    expect(list.status).toBe(200);
    expect(list.body.some((p: { company: string }) => p.company === "E2E测试公司")).toBe(true);
  });

  it("状态流转到 applied", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/applicant/positions?status=waiting");
    const target = list.body.find((p: { company: string }) => p.company === "E2E测试公司");
    const patched = await request(app.getHttpServer())
      .patch("/api/applicant/positions/" + target.id)
      .send({ status: "applied" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("applied");
  });

  it("非法状态返回 400", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/applicant/positions");
    const target = list.body.find((p: { company: string }) => p.company === "E2E测试公司");
    const res = await request(app.getHttpServer())
      .patch("/api/applicant/positions/" + target.id)
      .send({ status: "not-a-status" });
    expect(res.status).toBe(400);
  });
});
~~~

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: FAIL（controller 未注册）

- [ ] **Step 3: 实现 position.repo.ts / position.service.ts / position.controller.ts**

position.repo.ts：

~~~ts
import { pool } from "../db";

export const POSITION_STATUSES = ["waiting", "applied", "written", "interview", "offer", "rejected"] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export interface PositionInput {
  company: string;
  title: string;
  city?: string;
  salary?: string;
  source?: string;
  jdRaw?: string;
  jdStructured?: Record<string, unknown>;
  status?: PositionStatus;
  appliedUrl?: string;
  notes?: string;
}

export interface PositionRow extends Required<Omit<PositionInput, "jdRaw" | "jdStructured">> {
  id: string;
  jdRaw: string;
  jdStructured: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): PositionRow {
  return {
    id: r.id as string,
    company: r.company as string,
    title: r.title as string,
    city: r.city as string,
    salary: r.salary as string,
    source: r.source as string,
    jdRaw: r.jd_raw as string,
    jdStructured: (r.jd_structured as Record<string, unknown>) ?? {},
    status: r.status as PositionStatus,
    appliedUrl: r.applied_url as string,
    notes: r.notes as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listPositions(status?: string): Promise<PositionRow[]> {
  const rows = status
    ? await pool.query("SELECT * FROM positions WHERE status = $1 ORDER BY updated_at DESC", [status])
    : await pool.query("SELECT * FROM positions ORDER BY updated_at DESC");
  return rows.rows.map(mapRow);
}

export async function getPosition(id: string): Promise<PositionRow | null> {
  const rows = await pool.query("SELECT * FROM positions WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function createPosition(input: PositionInput): Promise<PositionRow> {
  const rows = await pool.query(
    "INSERT INTO positions (company, title, city, salary, source, jd_raw, jd_structured, status, applied_url, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    [input.company, input.title, input.city ?? "", input.salary ?? "", input.source ?? "manual", input.jdRaw ?? "", JSON.stringify(input.jdStructured ?? {}), input.status ?? "waiting", input.appliedUrl ?? "", input.notes ?? ""]
  );
  return mapRow(rows.rows[0]);
}

export async function updatePosition(id: string, patch: Partial<PositionInput>): Promise<PositionRow | null> {
  const current = await getPosition(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  const rows = await pool.query(
    "UPDATE positions SET company=$1,title=$2,city=$3,salary=$4,source=$5,jd_raw=$6,jd_structured=$7,status=$8,applied_url=$9,notes=$10,updated_at=now() WHERE id=$11 RETURNING *",
    [next.company, next.title, next.city, next.salary, next.source, next.jdRaw, JSON.stringify(next.jdStructured), next.status, next.appliedUrl, next.notes, id]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}
~~~

position.service.ts（含 T4/T5 的解析方法，本任务先实现 create/update/list）：

~~~ts
import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { POSITION_STATUSES, PositionStatus, createPosition, getPosition, listPositions, updatePosition, type PositionInput } from "./position.repo";

@Injectable()
export class PositionService {
  async list(status?: string) {
    return listPositions(status);
  }

  async get(id: string) {
    const row = await getPosition(id);
    if (!row) throw new NotFoundException("岗位不存在");
    return row;
  }

  async create(input: PositionInput) {
    if (input.status && !(POSITION_STATUSES as readonly string[]).includes(input.status)) {
      throw new BadRequestException("非法状态: " + input.status);
    }
    return createPosition(input);
  }

  async update(id: string, patch: Partial<PositionInput>) {
    if (patch.status && !(POSITION_STATUSES as readonly string[]).includes(patch.status)) {
      throw new BadRequestException("非法状态: " + patch.status);
    }
    const row = await updatePosition(id, patch);
    if (!row) throw new NotFoundException("岗位不存在");
    return row;
  }
}
~~~

position.controller.ts：

~~~ts
import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PositionService } from "./position.service";
import type { PositionInput } from "./position.repo";

@Controller("positions")
export class PositionController {
  constructor(private readonly service: PositionService) {}

  @Get()
  list(@Query("status") status?: string) {
    return this.service.list(status);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() input: PositionInput) {
    return this.service.create(input);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() patch: Partial<PositionInput>) {
    return this.service.update(id, patch);
  }
}
~~~

app.module.ts 注册：

~~~ts
import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PositionController } from "./position.controller";
import { PositionService } from "./position.service";

@Module({
  controllers: [HealthController, PositionController],
  providers: [PositionService],
})
export class AppModule {}
~~~

- [ ] **Step 4: 运行确认通过（需本地 applicant 库已建）**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: PASS（3 e2e 用例）

- [ ] **Step 5: web 依赖与路由壳**

web/package.json dependencies 增补 `"react-router-dom": "^6.26.0"`。

web/src/api.ts：

~~~ts
const BASE = "/api/applicant";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "请求失败 " + res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listPositions: (status?: string) => request<Position[]>(status ? "/positions?status=" + encodeURIComponent(status) : "/positions"),
  getPosition: (id: string) => request<Position>("/positions/" + id),
  createPosition: (input: unknown) => request<Position>("/positions", { method: "POST", body: JSON.stringify(input) }),
  updatePosition: (id: string, patch: unknown) => request<Position>("/positions/" + id, { method: "PATCH", body: JSON.stringify(patch) }),
};

export type PositionStatus = "waiting" | "applied" | "written" | "interview" | "offer" | "rejected";
export interface Position {
  id: string;
  company: string;
  title: string;
  city: string;
  salary: string;
  source: string;
  status: PositionStatus;
  jdRaw: string;
  notes: string;
}
~~~

App.tsx 替换为路由壳：

~~~tsx
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import PositionList from "./pages/PositionList";
import PositionDetail from "./pages/PositionDetail";

export default function App() {
  return (
    <BrowserRouter basename="/applicant">
      <Routes>
        <Route path="/" element={<Navigate to="/positions" replace />} />
        <Route path="/positions" element={<PositionList />} />
        <Route path="/positions/:id" element={<PositionDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
~~~

StatusTag.tsx：

~~~tsx
import { Tag } from "antd";
import { tokens } from "@mt/ui";

const MAP: Record<string, { label: string; color: string }> = {
  waiting: { label: "待投递", color: tokens.color.warning },
  applied: { label: "已投递", color: tokens.color.primary },
  written: { label: "笔试", color: "#722ed1" },
  interview: { label: "面试", color: tokens.color.success },
  offer: { label: "offer", color: "#13c2c2" },
  rejected: { label: "拒绝", color: tokens.color.error },
};

export function StatusTag(props: { status: string }) {
  const item = MAP[props.status] ?? { label: props.status, color: tokens.color.textSecondary };
  return <Tag color={item.color}>{item.label}</Tag>;
}
~~~

PositionForm.tsx（手动录入，Modal 内表单）：

~~~tsx
import { Form, Input, Modal, Select, message } from "antd";
import { useState } from "react";

export interface PositionFormValues {
  company: string;
  title: string;
  city?: string;
  salary?: string;
  source?: string;
  jdRaw?: string;
  notes?: string;
}

export function PositionForm(props: {
  open: boolean;
  initialValues?: PositionFormValues;
  onCancel: () => void;
  onSubmit: (values: PositionFormValues) => Promise<void>;
}) {
  const [form] = Form.useForm<PositionFormValues>();
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      title="新建岗位"
      open={props.open}
      confirmLoading={saving}
      onCancel={props.onCancel}
      onOk={async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
          await props.onSubmit(values);
          form.resetFields();
        } catch (err) {
          message.error(String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <Form form={form} layout="vertical" initialValues={props.initialValues}>
        <Form.Item name="company" label="公司" rules={[{ required: true }]}>
          <Input placeholder="公司名" />
        </Form.Item>
        <Form.Item name="title" label="职位" rules={[{ required: true }]}>
          <Input placeholder="职位名" />
        </Form.Item>
        <Form.Item name="city" label="城市">
          <Input placeholder="工作城市" />
        </Form.Item>
        <Form.Item name="salary" label="薪资">
          <Input placeholder="如 20-30K·14薪" />
        </Form.Item>
        <Form.Item name="source" label="来源" initialValue="manual">
          <Select
            options={[
              { value: "manual", label: "手动录入" },
              { value: "jd_text", label: "JD 文本解析" },
              { value: "screenshot", label: "截图识别" },
            ]}
          />
        </Form.Item>
        <Form.Item name="jdRaw" label="JD 原文">
          <Input.TextArea rows={5} placeholder="粘贴 JD 原文（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
~~~

PositionList.tsx：

~~~tsx
import { Button, Card, Select, Space, Table } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Position } from "../api";
import { StatusTag } from "../components/StatusTag";
import { PositionForm, type PositionFormValues } from "../components/PositionForm";

export default function PositionList() {
  const [items, setItems] = useState<Position[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.listPositions(status).then(setItems).catch((err) => console.error(err));
  }, [status]);

  return (
    <Card
      title="岗位列表"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="状态筛选"
            style={{ width: 140 }}
            value={status}
            onChange={(v) => setStatus(v)}
            options={[
              { value: "waiting", label: "待投递" },
              { value: "applied", label: "已投递" },
              { value: "written", label: "笔试" },
              { value: "interview", label: "面试" },
              { value: "offer", label: "offer" },
              { value: "rejected", label: "拒绝" },
            ]}
          />
          <Button type="primary" onClick={() => setCreating(true)}>
            新建岗位
          </Button>
        </Space>
      }
    >
      <Table<Position>
        rowKey="id"
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "公司", dataIndex: "company", render: (v: string, row) => <Link to={"/positions/" + row.id}>{v}</Link> },
          { title: "职位", dataIndex: "title" },
          { title: "城市", dataIndex: "city", width: 100 },
          { title: "状态", dataIndex: "status", width: 100, render: (v: string) => <StatusTag status={v} /> },
          { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (v: string) => new Date(v).toLocaleString() },
        ]}
      />
      <PositionForm
        open={creating}
        onCancel={() => setCreating(false)}
        onSubmit={async (values: PositionFormValues) => {
          await api.createPosition(values);
          setCreating(false);
          api.listPositions(status).then(setItems);
        }}
      />
    </Card>
  );
}
~~~

PositionDetail.tsx（详情 + 状态流转 + 去投递链接）：

~~~tsx
import { Button, Card, Descriptions, Input, Select, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Position } from "../api";
import { StatusTag } from "../components/StatusTag";

const STATUS_OPTIONS = [
  { value: "waiting", label: "待投递" },
  { value: "applied", label: "已投递" },
  { value: "written", label: "笔试" },
  { value: "interview", label: "面试" },
  { value: "offer", label: "offer" },
  { value: "rejected", label: "拒绝" },
];

export default function PositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Position | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (id) {
      api.getPosition(id).then((p) => {
        setItem(p);
        setNotes(p.notes);
      });
    }
  }, [id]);

  if (!item) return <Card loading />;

  const changeStatus = async (status: string) => {
    const updated = await api.updatePosition(item.id, { status });
    setItem(updated);
    message.success("状态已更新");
  };

  const saveNotes = async () => {
    const updated = await api.updatePosition(item.id, { notes });
    setItem(updated);
    message.success("备注已保存");
  };

  return (
    <Card
      title={item.company + " · " + item.title}
      extra={<Button onClick={() => navigate(-1)}>返回</Button>}
    >
      <Descriptions column={2}>
        <Descriptions.Item label="状态">
          <Space>
            <StatusTag status={item.status} />
            <Select value={item.status} style={{ width: 120 }} options={STATUS_OPTIONS} onChange={changeStatus} />
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="城市">{item.city || "-"}</Descriptions.Item>
        <Descriptions.Item label="薪资">{item.salary || "-"}</Descriptions.Item>
        <Descriptions.Item label="来源">{item.source}</Descriptions.Item>
      </Descriptions>
      {item.appliedUrl ? (
        <Button type="primary" href={item.appliedUrl} target="_blank" style={{ marginBottom: 16 }}>
          去投递
        </Button>
      ) : null}
      <Input.TextArea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="备注" />
    </Card>
  );
}
~~~

- [ ] **Step 6: 写失败测试 web/src/pages/PositionList.test.tsx**

~~~tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PositionList from "./PositionList";

const items = [
  { id: "p1", company: "测试公司A", title: "后端", city: "杭州", salary: "", source: "manual", status: "waiting", jdRaw: "", notes: "", updatedAt: "2026-08-19T00:00:00Z" },
];

describe("PositionList", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("渲染岗位表格与状态标签", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(items), { status: 200 })));
    render(
      <MemoryRouter>
        <PositionList />
      </MemoryRouter>
    );
    expect(await screen.findByText("测试公司A")).toBeTruthy();
    expect(screen.getByText("待投递")).toBeTruthy();
  });
});
~~~

- [ ] **Step 7: 运行确认失败后实现并复跑**

Run: `pnpm.cmd --filter @mt/applicant-web test` → FAIL →（Step 5 已含实现）→ 复跑
Expected: PASS（App 1 + PositionList 1 用例）

- [ ] **Step 8: 手工冒烟**

Run: 启动 server/web/gateway 后 `curl http://127.0.0.1:3000/api/applicant/positions`
Expected: 200 空数组（或已有数据）

- [ ] **Step 9: Commit**

~~~bash
git add apps/applicant pnpm-lock.yaml
git commit -m "feat(applicant): 岗位 CRUD、状态看板与详情页"
~~~

---

### Task 4: JD 文本解析

**Files:**
- Modify: `apps/applicant/server/src/position.service.ts`、`src/position.controller.ts`（加 parse-jd）
- Test: `server/src/position.e2e.test.ts`（加 1 用例）
- Modify: `apps/applicant/web/src/components/JdParsePanel.tsx`（新建）、`web/src/pages/PositionList.tsx`（集成）

**Interfaces:**
- Consumes: T2 llmChat/parseJdSchema；T3 api/PositionForm
- Produces: `POST /positions/parse-jd { text } → { company,title,city,salary,requirements,duties,keywords }`；前端 JdParsePanel（粘贴 → 解析 → 预填 PositionForm）

- [ ] **Step 1: 写失败测试（e2e 追加，stub 模式）**

~~~ts
  it("JD 文本解析返回结构化字段", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.MT_LLM_STUB = "1";
    const res = await request(app.getHttpServer())
      .post("/api/applicant/positions/parse-jd")
      .send({ text: "某公司招聘后端工程师 JD 内容" });
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(res.body.company).toBeTruthy();
    expect(Array.isArray(res.body.requirements)).toBe(true);
  });
~~~

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: FAIL（404 无该端点）

- [ ] **Step 3: 实现 service + controller**

position.service.ts 增补：

~~~ts
import { llmChat } from "../llm";
import { parseJdSchema } from "../schemas";

const JD_PROMPT = "你是岗位信息提取助手。从以下 JD 文本提取结构化字段，只输出 JSON，字段：company（公司名）、title（职位名）、city、salary、requirements（要求数组）、duties（职责数组）、keywords（技能关键词数组）。JD 文本：";

export async function parseJd(text: string) {
  const raw = await llmChat([
    { role: "system", content: "只输出 JSON，不要任何解释。" },
    { role: "user", content: JD_PROMPT + text },
  ]);
  const data = parseJdSchema.parse(JSON.parse(raw));
  return data;
}
~~~

controller 增补：

~~~ts
  @Post("parse-jd")
  parseJd(@Body() body: { text: string }) {
    if (!body.text || body.text.trim().length < 10) {
      throw new BadRequestException("JD 文本过短");
    }
    return parseJd(body.text);
  }
~~~

- [ ] **Step 4: 运行确认通过**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: PASS（4 用例）

- [ ] **Step 5: 前端 JdParsePanel + 集成**

JdParsePanel.tsx：

~~~tsx
import { Button, Input, Space, message } from "antd";
import { useState } from "react";
import { api } from "../api";
import type { PositionFormValues } from "./PositionForm";

export function JdParsePanel(props: { onParsed: (values: PositionFormValues) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const parse = async () => {
    setLoading(true);
    try {
      const data = await api.parseJd(text);
      props.onParsed({ company: data.company, title: data.title, city: data.city, salary: data.salary, source: "jd_text", jdRaw: text });
      message.success("解析完成，请确认后保存");
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space.Compact style={{ width: "100%" }} direction="vertical">
      <Input.TextArea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴 JD 原文" />
      <Button type="primary" loading={loading} onClick={parse} disabled={text.trim().length < 10}>
        解析为结构化岗位信息
      </Button>
    </Space.Compact>
  );
}
~~~

api.ts 增补：

~~~ts
  parseJd: (text: string) => request<{ company: string; title: string; city: string; salary: string; requirements: string[]; duties: string[]; keywords: string[] }>("/positions/parse-jd", { method: "POST", body: JSON.stringify({ text }) }),
~~~

PositionList.tsx 增补：新建弹窗内加 Tab 切换（手动 / JD 解析），onParsed 把值 setForm 到 PositionForm（用 initialValues + open 重建）。实现：PositionForm 增加 `key={JSON.stringify(initialValues)}` 以在预填时重置表单。

- [ ] **Step 6: 冒烟验证（stub 模式）**

Run: 启动栈后 `curl -X POST http://127.0.0.1:3000/api/applicant/positions/parse-jd -H "Content-Type: application/json" -d '{"text":"某互联网公司招聘资深后端工程师，要求熟悉 Java 微服务，负责订单系统"}' -H "MT_LLM_STUB: 1"`（stub 用环境变量，本地用 env 启动）
Expected: 201 + 结构化 JSON

- [ ] **Step 6b: 打招呼话术生成（半自动投递）**

position.service.ts 增补：

~~~ts
export async function generateGreeting(positionId: string) {
  const position = await getPosition(positionId);
  if (!position) throw new NotFoundException("岗位不存在");
  const raw = await llmChat([
    { role: "system", content: "你是求职助手，为以下岗位写一段 60 字内的打招呼话术（用于招聘平台开场），突出匹配点，只输出话术本身。" },
    { role: "user", content: JSON.stringify({ company: position.company, title: position.title, jdRaw: position.jdRaw.slice(0, 1500) }) },
  ]);
  return { greeting: raw };
}
~~~

controller 增补 `@Post("positions/:id/greeting")` 路由返回 `{ greeting }`；PositionDetail 增加「生成打招呼话术」按钮（点击后 message 展示话术，appliedUrl 有值时可复制后跳转）。api.ts 增补 `generateGreeting`。

- [ ] **Step 7: Commit**

~~~bash
git add apps/applicant
git commit -m "feat(applicant): JD 文本 LLM 结构化解析、表单预填与投递话术生成"
~~~

---

### Task 5: 截图识别（视觉模型）

**Files:**
- Modify: `apps/applicant/server/src/position.service.ts`、`src/position.controller.ts`（parse-image，multer）、`server/package.json`
- Test: `server/src/position.e2e.test.ts`（加 1 用例，stub 模式）
- Modify: `apps/applicant/web/src/components/ImageUploadPanel.tsx`（新建）、`web/src/pages/PositionList.tsx`（集成）

**Interfaces:**
- Consumes: T1 视觉路由（options.vision）、T2 llmChat、T4 解析流程
- Produces: `POST /positions/parse-image (multipart file) → 同 parse-jd 结构`；前端 ImageUploadPanel（上传 → 识别 → 预填）

- [ ] **Step 1: 写失败测试**

~~~ts
  it("截图识别返回结构化字段（stub 模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.MT_LLM_STUB = "1";
    const res = await request(app.getHttpServer())
      .post("/api/applicant/positions/parse-image")
      .attach("file", Buffer.from("fake-image-bytes"), "jd.png");
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(res.body.title).toBeTruthy();
  });
~~~

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: FAIL（端点不存在）

- [ ] **Step 3: 实现（multer 内存模式 → base64 dataURL → vision）**

position.service.ts 增补：

~~~ts
export async function parsePositionImage(dataUrl: string) {
  const raw = await llmChat(
    [
      { role: "system", content: "你是岗位信息提取助手，从截图提取结构化字段，只输出 JSON（字段同 JD 解析：company/title/city/salary/requirements/duties/keywords）。" },
      {
        role: "user",
        content: [
          { type: "text", text: "提取这张截图中的岗位信息" },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    { vision: true }
  );
  return parseJdSchema.parse(JSON.parse(raw));
}
~~~

controller 增补（FileInterceptor）：

~~~ts
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadedFile, UseInterceptors } from "@nestjs/common";
import { memoryStorage } from "multer";

  @Post("parse-image")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  parseImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("缺少图片文件");
    const ext = (file.originalname.split(".").pop() || "png").toLowerCase();
    const dataUrl = "data:image/" + (ext === "jpg" ? "jpeg" : ext) + ";base64," + file.buffer.toString("base64");
    return parsePositionImage(dataUrl);
  }
~~~

> 图片走内存（不落盘），规避 Phase 0 计划的本地磁盘方案——单次识别即用即弃，更简单。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: PASS（5 用例）

- [ ] **Step 5: 前端 ImageUploadPanel + 集成**

ImageUploadPanel.tsx（antd Upload，base64 预览）：

~~~tsx
import { Button, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useState } from "react";
import { api } from "../api";
import type { PositionFormValues } from "./PositionForm";

export function ImageUploadPanel(props: { onParsed: (values: PositionFormValues) => void }) {
  const [loading, setLoading] = useState(false);

  return (
    <Upload
      accept="image/*"
      showUploadList={false}
      customRequest={async (options) => {
        const file = options.file as File;
        const form = new FormData();
        form.append("file", file);
        setLoading(true);
        try {
          const data = await api.parseImage(form);
          props.onParsed({ company: data.company, title: data.title, city: data.city, salary: data.salary, source: "screenshot", jdRaw: data.keywords.join("、") });
          message.success("识别完成，请确认后保存");
        } catch (err) {
          message.error(String(err));
        } finally {
          setLoading(false);
        }
      }}
    >
      <Button icon={<UploadOutlined />} loading={loading}>
        上传截图识别
      </Button>
    </Upload>
  );
}
~~~

api.ts 增补：

~~~ts
  parseImage: (form: FormData) =>
    request<{ company: string; title: string; city: string; salary: string; requirements: string[]; duties: string[]; keywords: string[] }>("/positions/parse-image", { method: "POST", body: form }),
~~~

> 注意：api.ts 的 request 固定了 Content-Type: application/json，multipart 需要分支处理（request 内检测 body 是否为 FormData，是则删除该 header，交给浏览器自动设置 boundary）。

web 依赖增补：`"@ant-design/icons": "^5.4.0"`。

- [ ] **Step 6: 冒烟验证 + Commit**

Run: 启动栈后 POST multipart 到 /positions/parse-image（stub 模式）
Expected: 201 结构化 JSON

~~~bash
git add apps/applicant pnpm-lock.yaml
git commit -m "feat(applicant): 截图视觉识别与图片上传面板"
~~~

---

### Task 6: 面试复盘（记录 + LLM 分析 + 导出）

**Files:**
- Create: `apps/applicant/server/src/interview.repo.ts`、`src/interview.service.ts`、`src/interview.controller.ts`
- Modify: `apps/applicant/server/src/app.module.ts`
- Test: `server/src/interview.e2e.test.ts`
- Create: `apps/applicant/web/src/pages/InterviewPage.tsx`、`web/src/components/InterviewForm.tsx`、`web/src/components/AnalysisView.tsx`
- Modify: `web/src/App.tsx`、`web/src/api.ts`

**Interfaces:**
- Consumes: T2 llmChat/interviewAnalysisSchema；T3 路由壳
- Produces: `POST /positions/:positionId/interviews`、`GET /positions/:positionId/interviews`、`POST /interviews/:id/analyze`、`GET /interviews/:id/export.md`；前端复盘页（列表 + 表单 + 分析展示 + 导出按钮）

- [ ] **Step 1: 写失败测试 interview.e2e.test.ts（同 DB skip 模式）**

~~~ts
// 结构同 position.e2e.test.ts（beforeAll 建 app + migrate）
  it("创建复盘并生成分析（stub 模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const pos = await request(app.getHttpServer()).post("/api/applicant/positions").send({ company: "复盘测试公司", title: "测试岗" });
    const created = await request(app.getHttpServer())
      .post("/api/applicant/positions/" + pos.body.id + "/interviews")
      .send({ round: 1, qaNotes: "问了一致性哈希。答得一般。", reflection: "需要复习分布式基础" });
    expect(created.status).toBe(201);

    process.env.MT_LLM_STUB = "1";
    const analyzed = await request(app.getHttpServer()).post("/api/applicant/interviews/" + created.body.id + "/analyze");
    delete process.env.MT_LLM_STUB;
    expect(analyzed.status).toBe(201);
    expect(analyzed.body.analysis).toBeTruthy();

    const exported = await request(app.getHttpServer()).get("/api/applicant/interviews/" + created.body.id + "/export.md");
    expect(exported.status).toBe(200);
    expect(exported.text).toContain("# 面试复盘");
  });
~~~

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: FAIL

- [ ] **Step 3: 实现 interview.repo.ts / service / controller**

interview.repo.ts：

~~~ts
import { pool } from "../db";

export interface InterviewRow {
  id: string;
  positionId: string;
  round: number;
  happenedAt: string;
  qaNotes: string;
  reflection: string;
  analysis: Record<string, unknown> | null;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): InterviewRow {
  return {
    id: r.id as string,
    positionId: r.position_id as string,
    round: r.round as number,
    happenedAt: new Date(r.happened_at as string).toISOString(),
    qaNotes: r.qa_notes as string,
    reflection: r.reflection as string,
    analysis: (r.analysis as Record<string, unknown>) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listInterviews(positionId: string): Promise<InterviewRow[]> {
  const rows = await pool.query("SELECT * FROM interviews WHERE position_id = $1 ORDER BY round ASC", [positionId]);
  return rows.rows.map(mapRow);
}

export async function createInterview(positionId: string, input: { round: number; qaNotes: string; reflection: string }): Promise<InterviewRow> {
  const rows = await pool.query(
    "INSERT INTO interviews (position_id, round, qa_notes, reflection) VALUES ($1,$2,$3,$4) RETURNING *",
    [positionId, input.round, input.qaNotes, input.reflection]
  );
  return mapRow(rows.rows[0]);
}

export async function setAnalysis(id: string, analysis: Record<string, unknown>): Promise<InterviewRow | null> {
  const rows = await pool.query("UPDATE interviews SET analysis = $2 WHERE id = $1 RETURNING *", [id, JSON.stringify(analysis)]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function getInterview(id: string): Promise<InterviewRow | null> {
  const rows = await pool.query("SELECT * FROM interviews WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}
~~~

interview.service.ts：

~~~ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { llmChat } from "../llm";
import { interviewAnalysisSchema } from "../schemas";
import { createInterview, getInterview, listInterviews, setAnalysis, type InterviewRow } from "./interview.repo";

const ANALYSIS_PROMPT = "你是面试复盘教练。根据面试问答记录与自我反思，输出 JSON：questions（数组：{category, question, comment}）、quality（整体回答质量点评）、suggestions（改进建议数组）、actionItems（下次面试前行动项数组）。只输出 JSON。记录：";

@Injectable()
export class InterviewService {
  list(positionId: string) {
    return listInterviews(positionId);
  }

  create(positionId: string, input: { round: number; qaNotes: string; reflection: string }) {
    return createInterview(positionId, input);
  }

  async analyze(id: string) {
    const row = await getInterview(id);
    if (!row) throw new NotFoundException("面试记录不存在");
    const raw = await llmChat([
      { role: "system", content: "只输出 JSON。" },
      { role: "user", content: ANALYSIS_PROMPT + JSON.stringify({ round: row.round, qaNotes: row.qaNotes, reflection: row.reflection }) },
    ]);
    const analysis = interviewAnalysisSchema.parse(JSON.parse(raw));
    return setAnalysis(id, analysis);
  }

  async exportMarkdown(id: string): Promise<string> {
    const row = await getInterview(id);
    if (!row) throw new NotFoundException("面试记录不存在");
    const lines: string[] = [];
    lines.push("# 面试复盘");
    lines.push("");
    lines.push("- 轮次: 第 " + row.round + " 面");
    lines.push("- 时间: " + row.happenedAt);
    lines.push("");
    lines.push("## 问答记录");
    lines.push("");
    lines.push(row.qaNotes || "（无）");
    lines.push("");
    lines.push("## 自我反思");
    lines.push("");
    lines.push(row.reflection || "（无）");
    if (row.analysis) {
      const a = row.analysis as { quality?: string; suggestions?: string[]; actionItems?: string[]; questions?: Array<{ category: string; question: string; comment: string }> };
      lines.push("");
      lines.push("## 分析结论");
      lines.push("");
      if (a.quality) lines.push(a.quality);
      if (a.questions?.length) {
        lines.push("");
        lines.push("### 问题清单");
        for (const q of a.questions) lines.push("- [" + q.category + "] " + q.question + " — " + q.comment);
      }
      if (a.suggestions?.length) {
        lines.push("");
        lines.push("### 改进建议");
        for (const s of a.suggestions) lines.push("- " + s);
      }
      if (a.actionItems?.length) {
        lines.push("");
        lines.push("### 行动项");
        for (const t of a.actionItems) lines.push("- [ ] " + t);
      }
    }
    return lines.join("\n");
  }
}
~~~

interview.controller.ts：

~~~ts
import { Body, Controller, Get, Header, Param, Post } from "@nestjs/common";
import { InterviewService } from "./interview.service";

@Controller()
export class InterviewController {
  constructor(private readonly service: InterviewService) {}

  @Get("positions/:positionId/interviews")
  list(@Param("positionId") positionId: string) {
    return this.service.list(positionId);
  }

  @Post("positions/:positionId/interviews")
  create(@Param("positionId") positionId: string, @Body() body: { round: number; qaNotes: string; reflection: string }) {
    return this.service.create(positionId, body);
  }

  @Post("interviews/:id/analyze")
  analyze(@Param("id") id: string) {
    return this.service.analyze(id);
  }

  @Get("interviews/:id/export.md")
  @Header("Content-Type", "text/markdown; charset=utf-8")
  async exportMarkdown(@Param("id") id: string) {
    return this.service.exportMarkdown(id);
  }
}
~~~

app.module.ts 注册 InterviewController/InterviewService。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: PASS（position 5 + interview 1 = 6 e2e + 既有）

- [ ] **Step 5: 前端 InterviewPage / InterviewForm / AnalysisView + 路由**

App.tsx 路由增补：`<Route path="/positions/:id/interviews" element={<InterviewPage />} />`。

InterviewForm.tsx：

~~~tsx
import { Button, Form, Input, InputNumber, Space } from "antd";
import { useState } from "react";

export function InterviewForm(props: { onSubmit: (values: { round: number; qaNotes: string; reflection: string }) => Promise<void> }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={async (values) => {
        setSaving(true);
        try {
          await props.onSubmit(values);
          form.resetFields();
        } finally {
          setSaving(false);
        }
      }}
    >
      <Form.Item name="round" label="轮次" initialValue={1}>
        <InputNumber min={1} max={10} />
      </Form.Item>
      <Form.Item name="qaNotes" label="问答记录" rules={[{ required: true }]}>
        <Input.TextArea rows={6} placeholder="问了什么，我怎么答的" />
      </Form.Item>
      <Form.Item name="reflection" label="自我反思">
        <Input.TextArea rows={3} placeholder="哪里答得不好，为什么" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving}>
        保存复盘
      </Button>
    </Form>
  );
}
~~~

AnalysisView.tsx：

~~~tsx
import { Button, Card, List, Space, Tag, Typography } from "antd";

export interface InterviewAnalysis {
  questions?: Array<{ category: string; question: string; comment: string }>;
  quality?: string;
  suggestions?: string[];
  actionItems?: string[];
}

export function AnalysisView(props: { analysis: InterviewAnalysis | null; onAnalyze: () => Promise<void>; onExport: () => void }) {
  if (!props.analysis) {
    return (
      <Space direction="vertical">
        <Typography.Text type="secondary">尚未分析</Typography.Text>
        <Button type="primary" onClick={props.onAnalyze}>
          生成复盘分析
        </Button>
      </Space>
    );
  }
  const a = props.analysis;
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      {a.quality ? <Card size="small">{a.quality}</Card> : null}
      {a.questions?.length ? (
        <List
          size="small"
          header="问题清单"
          dataSource={a.questions}
          renderItem={(q) => (
            <List.Item>
              <Space direction="vertical" size={0}>
                <Space>
                  <Tag>{q.category}</Tag>
                  <Typography.Text strong>{q.question}</Typography.Text>
                </Space>
                <Typography.Text type="secondary">{q.comment}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      ) : null}
      {a.suggestions?.length ? (
        <Card size="small" title="改进建议">
          {a.suggestions.map((s, i) => (
            <div key={i}>- {s}</div>
          ))}
        </Card>
      ) : null}
      {a.actionItems?.length ? (
        <Card size="small" title="行动项">
          {a.actionItems.map((s, i) => (
            <div key={i}>- [ ] {s}</div>
          ))}
        </Card>
      ) : null}
      <Space>
        <Button onClick={props.onAnalyze}>重新分析</Button>
        <Button onClick={props.onExport}>导出 markdown</Button>
      </Space>
    </Space>
  );
}
~~~

InterviewPage.tsx（列表 + 表单 + 分析，位置详情入口跳转）：结构 = 岗位名标题 + Interviews 列表（每项 AnalysisView）+ InterviewForm。
闭环入口：AnalysisView 的「行动项」卡片下方加 `<Link to="/resumes">去简历中心改写相关经历</Link>`（复盘 → 简历优化的闭环跳转）。

api.ts 增补 listInterviews/createInterview/analyzeInterview。

- [ ] **Step 6: 冒烟 + Commit**

Run: 启动栈后走一遍「建岗位 → 建复盘 → analyze（stub）→ export.md」
Expected: 全 201/200

~~~bash
git add apps/applicant pnpm-lock.yaml
git commit -m "feat(applicant): 面试复盘记录、LLM 分析与导出"
~~~

---

### Task 7: ClawCV adapter 与简历管理（含降级）

**Files:**
- Create: `apps/applicant/server/src/clawcv/client.ts`、`src/clawcv/fallback.ts`、`src/resume.repo.ts`、`src/resume.service.ts`、`src/resume.controller.ts`
- Modify: `apps/applicant/server/src/app.module.ts`
- Test: `server/src/clawcv/client.test.ts`、`server/src/resume.e2e.test.ts`

**Interfaces:**
- Consumes: T2 llmChat；docs/integrations/clawcv-setup.md 端点契约
- Produces: `ClawcvClient`（isConfigured/createSession/getQuota/analyze/rewrite/match）、降级函数、REST：`GET/POST /resumes`、`POST /resumes/:id/analyze`、`POST /resumes/:id/rewrite`、`POST /resumes/:id/match/:positionId`、`GET /meta/quota`

- [ ] **Step 1: 写失败测试 clawcv/client.test.ts（mock fetch 单测）**

~~~ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { ClawcvClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("ClawcvClient", () => {
  it("未配置 Key 时 isConfigured 为 false", () => {
    const c = new ClawcvClient({ baseUrl: "https://api.wondercv.com", apiKey: "" });
    expect(c.isConfigured()).toBe(false);
  });

  it("业务错误 code>=2000 抛错", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: 2100, message: "额度不足" }), { status: 200 })));
    const c = new ClawcvClient({ baseUrl: "https://api.wondercv.com", apiKey: "k" });
    await expect(c.analyze({ resume_text: "x" })).rejects.toThrow(/额度不足/);
  });

  it("429 退避重试后成功", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 1000, data: { score: 88 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new ClawcvClient({ baseUrl: "https://api.wondercv.com", apiKey: "k" });
    const out = await c.analyze({ resume_text: "x" });
    expect(out).toEqual({ score: 88 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);

  it("携带 Bearer 与 X-API-Version 头", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 1000, data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new ClawcvClient({ baseUrl: "https://api.wondercv.com", apiKey: "k" });
    await c.analyze({ resume_text: "x" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer k");
    expect(headers["X-API-Version"]).toBe("v1");
  });
});
~~~

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: FAIL

- [ ] **Step 3: 实现 clawcv/client.ts**

~~~ts
import { randomUUID } from "node:crypto";

export interface ClawcvConfig {
  baseUrl?: string;
  apiKey?: string;
}

export class ClawcvClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ClawcvConfig = {}) {
    this.baseUrl = (config.baseUrl ?? process.env.CLAWCV_BACKEND_URL ?? "https://api.wondercv.com").replace(/\/+$/, "");
    this.apiKey = config.apiKey ?? process.env.CLAWCV_API_KEY ?? "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async request<T>(path: string, init: RequestInit = {}, attempts = 3): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: "Bearer " + this.apiKey } : {}),
        "X-API-Version": "v1",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(30000),
    });
    if ((response.status === 429 || response.status >= 500) && attempts > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - attempts)));
      return this.request<T>(path, init, attempts - 1);
    }
    const body = (await response.json().catch(() => ({}))) as { code?: number; message?: string; data?: T };
    if (!response.ok) {
      throw new Error(body.message || "HTTP " + response.status);
    }
    if (typeof body.code === "number" && body.code >= 2000) {
      throw new Error(body.message || "业务错误 " + body.code);
    }
    return (body.data ?? body) as T;
  }

  async createSession(): Promise<string> {
    const id = randomUUID();
    await this.request("/cv/v1/mcp/session/create", { method: "POST", body: JSON.stringify({ session_id: id }) });
    return id;
  }

  getQuota(): Promise<unknown> {
    return this.request("/cv/v1/skill/auth/quota");
  }

  analyze(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("/cv/v1/mcp/analyze", { method: "POST", body: JSON.stringify(payload) });
  }

  rewrite(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("/cv/v1/mcp/rewrite", { method: "POST", body: JSON.stringify(payload) });
  }

  match(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("/cv/v1/mcp/match", { method: "POST", body: JSON.stringify(payload) });
  }
}
~~~

- [ ] **Step 4: 实现 clawcv/fallback.ts（本地 LLM 降级）**

~~~ts
import { llmChat } from "../llm";

export async function analyzeResumeFallback(resumeText: string): Promise<Record<string, unknown>> {
  const raw = await llmChat([
    { role: "system", content: "你是简历教练。输出 JSON：{score: 数字, strengths: 字符串数组, weaknesses: 字符串数组, suggestions: 字符串数组}，只输出 JSON。" },
    { role: "user", content: "分析这份简历：" + resumeText.slice(0, 4000) },
  ]);
  return JSON.parse(raw);
}

export async function rewriteSectionFallback(sectionType: string, originalText: string): Promise<Record<string, unknown>> {
  const raw = await llmChat([
    { role: "system", content: "你是简历优化助手，用 STAR 法则改写。输出 JSON：{rewrites: 字符串数组, editing_notes: 字符串数组}，只输出 JSON。" },
    { role: "user", content: "段落类型：" + sectionType + "；原文：" + originalText.slice(0, 3000) },
  ]);
  return JSON.parse(raw);
}

export async function matchResumeFallback(resumeText: string, jdText: string): Promise<Record<string, unknown>> {
  const raw = await llmChat([
    { role: "system", content: "你是简历匹配助手。输出 JSON：{match_score: 0-100 数字, strengths: 数组, gaps: 数组, missing_keywords: 数组, recommended_changes: 数组}，只输出 JSON。" },
    { role: "user", content: "简历：" + resumeText.slice(0, 3000) + "\n\nJD：" + jdText.slice(0, 3000) },
  ]);
  return JSON.parse(raw);
}
~~~

- [ ] **Step 5: 实现 resume.repo.ts / resume.service.ts / resume.controller.ts**

resume.repo.ts（模式同 position.repo）：

~~~ts
import { pool } from "../db";

export interface ResumeRow {
  id: string;
  name: string;
  version: number;
  source: string;
  contentText: string;
  clawcvSessionId: string | null;
  lastAnalysis: Record<string, unknown> | null;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): ResumeRow {
  return {
    id: r.id as string,
    name: r.name as string,
    version: r.version as number,
    source: r.source as string,
    contentText: r.content_text as string,
    clawcvSessionId: (r.clawcv_session_id as string) ?? null,
    lastAnalysis: (r.last_analysis as Record<string, unknown>) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listResumes(): Promise<ResumeRow[]> {
  const rows = await pool.query("SELECT * FROM resumes ORDER BY created_at DESC");
  return rows.rows.map(mapRow);
}

export async function getResume(id: string): Promise<ResumeRow | null> {
  const rows = await pool.query("SELECT * FROM resumes WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function createResume(input: { name: string; contentText: string; source?: string }): Promise<ResumeRow> {
  const rows = await pool.query(
    "INSERT INTO resumes (name, content_text, source) VALUES ($1,$2,$3) RETURNING *",
    [input.name, input.contentText, input.source ?? "clawcv"]
  );
  return mapRow(rows.rows[0]);
}

export async function setResumeAnalysis(id: string, analysis: Record<string, unknown>): Promise<void> {
  await pool.query("UPDATE resumes SET last_analysis = $2 WHERE id = $1", [id, JSON.stringify(analysis)]);
}

export async function setResumeSession(id: string, sessionId: string): Promise<void> {
  await pool.query("UPDATE resumes SET clawcv_session_id = $2 WHERE id = $1", [id, sessionId]);
}

export async function appendRewrite(input: { resumeId: string; positionId?: string; sectionType: string; originalText: string; rewrittenText: string }): Promise<void> {
  await pool.query(
    "INSERT INTO resume_rewrites (resume_id, position_id, section_type, original_text, rewritten_text) VALUES ($1,$2,$3,$4,$5)",
    [input.resumeId, input.positionId ?? null, input.sectionType, input.originalText, input.rewrittenText]
  );
}

export async function saveMatch(input: { resumeId: string; positionId: string; matchScore: number; gaps: unknown[]; missingKeywords: string[] }): Promise<void> {
  await pool.query(
    "INSERT INTO job_matches (resume_id, position_id, match_score, gaps, missing_keywords) VALUES ($1,$2,$3,$4,$5)",
    [input.resumeId, input.positionId, input.matchScore, JSON.stringify(input.gaps), JSON.stringify(input.missingKeywords)]
  );
}
~~~

resume.service.ts（核心：先 ClawCV 后降级，绝不 500）：

~~~ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { getPosition } from "./position.repo";
import { ClawcvClient } from "./clawcv/client";
import { analyzeResumeFallback, matchResumeFallback, rewriteSectionFallback } from "./clawcv/fallback";
import { appendRewrite, createResume, getResume, listResumes, saveMatch, setResumeAnalysis, setResumeSession, type ResumeRow } from "./resume.repo";

const clawcv = new ClawcvClient();

@Injectable()
export class ResumeService {
  list() {
    return listResumes();
  }

  create(input: { name: string; contentText: string }) {
    return createResume(input);
  }

  async analyze(id: string) {
    const resume = await this.requireResume(id);
    let analysis: Record<string, unknown>;
    let via = "clawcv";
    if (clawcv.isConfigured()) {
      try {
        const sessionId = resume.clawcvSessionId ?? (await clawcv.createSession());
        if (!resume.clawcvSessionId) await setResumeSession(id, sessionId);
        analysis = await clawcv.analyze({ resume_text: resume.contentText, language: "zh", session_id: sessionId });
      } catch (err) {
        console.warn("[resume] ClawCV analyze 失败，降级本地: " + String(err));
        analysis = await analyzeResumeFallback(resume.contentText);
        via = "local";
      }
    } else {
      analysis = await analyzeResumeFallback(resume.contentText);
      via = "local";
    }
    await setResumeAnalysis(id, { ...analysis, via });
    return { ...analysis, via };
  }

  async rewrite(id: string, input: { sectionType: string; originalText: string; positionId?: string }) {
    const resume = await this.requireResume(id);
    let result: Record<string, unknown>;
    let via = "clawcv";
    if (clawcv.isConfigured()) {
      try {
        const sessionId = resume.clawcvSessionId ?? (await clawcv.createSession());
        result = await clawcv.rewrite({ section_type: input.sectionType, original_text: input.originalText, language: "zh", session_id: sessionId });
      } catch (err) {
        console.warn("[resume] ClawCV rewrite 失败，降级本地: " + String(err));
        result = await rewriteSectionFallback(input.sectionType, input.originalText);
        via = "local";
      }
    } else {
      result = await rewriteSectionFallback(input.sectionType, input.originalText);
      via = "local";
    }
    const rewrites: unknown[] = (result.rewrites as unknown[]) ?? [];
    const rewrittenText = typeof rewrites[0] === "string" ? (rewrites[0] as string) : JSON.stringify(rewrites[0] ?? {});
    await appendRewrite({ resumeId: id, positionId: input.positionId, sectionType: input.sectionType, originalText: input.originalText, rewrittenText });
    return { ...result, rewrittenText, via };
  }

  async match(id: string, positionId: string) {
    const resume = await this.requireResume(id);
    const position = await getPosition(positionId);
    if (!position) throw new NotFoundException("岗位不存在");
    let result: Record<string, unknown>;
    let via = "clawcv";
    if (clawcv.isConfigured()) {
      try {
        const sessionId = resume.clawcvSessionId ?? (await clawcv.createSession());
        result = await clawcv.match({ resume_text: resume.contentText, job_description: position.jdRaw || position.title, target_job_title: position.title, language: "zh", session_id: sessionId });
      } catch (err) {
        console.warn("[resume] ClawCV match 失败，降级本地: " + String(err));
        result = await matchResumeFallback(resume.contentText, position.jdRaw || position.title);
        via = "local";
      }
    } else {
      result = await matchResumeFallback(resume.contentText, position.jdRaw || position.title);
      via = "local";
    }
    const score = typeof result.match_score === "number" ? result.match_score : 0;
    await saveMatch({
      resumeId: id,
      positionId,
      matchScore: score,
      gaps: (result.gaps as unknown[]) ?? [],
      missingKeywords: (result.missing_keywords as string[]) ?? [],
    });
    return { ...result, via };
  }

  async quota() {
    if (!clawcv.isConfigured()) return { configured: false, quota: null };
    try {
      return { configured: true, quota: await clawcv.getQuota() };
    } catch (err) {
      return { configured: true, quota: null, error: String(err) };
    }
  }

  private async requireResume(id: string): Promise<ResumeRow> {
    const resume = await getResume(id);
    if (!resume) throw new NotFoundException("简历不存在");
    return resume;
  }
}
~~~

resume.controller.ts（路由 + /meta/quota）：

~~~ts
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ResumeService } from "./resume.service";

@Controller()
export class ResumeController {
  constructor(private readonly service: ResumeService) {}

  @Get("resumes")
  list() {
    return this.service.list();
  }

  @Post("resumes")
  create(@Body() body: { name: string; contentText: string }) {
    return this.service.create(body);
  }

  @Post("resumes/:id/analyze")
  analyze(@Param("id") id: string) {
    return this.service.analyze(id);
  }

  @Post("resumes/:id/rewrite")
  rewrite(@Param("id") id: string, @Body() body: { sectionType: string; originalText: string; positionId?: string }) {
    return this.service.rewrite(id, body);
  }

  @Post("resumes/:id/match/:positionId")
  match(@Param("id") id: string, @Param("positionId") positionId: string) {
    return this.service.match(id, positionId);
  }

  @Get("meta/quota")
  quota() {
    return this.service.quota();
  }
}
~~~

- [ ] **Step 6: 写 resume.e2e.test.ts（无 Key 走降级路径）**

~~~ts
// beforeAll 同 position e2e（migrate + app init），且确保 process.env.CLAWCV_API_KEY 为空
  it("无 ClawCV Key 时 analyze 走本地降级并保存", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    delete process.env.CLAWCV_API_KEY;
    process.env.MT_LLM_STUB = "1";
    const created = await request(app.getHttpServer()).post("/api/applicant/resumes").send({ name: "我的简历", contentText: "三年后端经验，熟悉 Java 微服务。" });
    const res = await request(app.getHttpServer()).post("/api/applicant/resumes/" + created.body.id + "/analyze");
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(res.body.via).toBe("local");
    expect(res.body).toHaveProperty("score");
  });

  it("quota 未配置时返回 configured:false", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    delete process.env.CLAWCV_API_KEY;
    const res = await request(app.getHttpServer()).get("/api/applicant/meta/quota");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });
~~~

- [ ] **Step 7: 运行确认通过**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: PASS（clawcv 单测 4 + resume e2e 2 + 既有）

- [ ] **Step 8: Commit**

~~~bash
git add apps/applicant/server pnpm-lock.yaml
git commit -m "feat(applicant): ClawCV adapter、简历管理与本地降级链路"
~~~

---

### Task 8: 简历中心前端

**Files:**
- Create: `apps/applicant/web/src/pages/ResumeCenter.tsx`、`web/src/components/ResumeList.tsx`
- Modify: `web/src/App.tsx`（路由）、`web/src/api.ts`
- Test: `web/src/pages/ResumeCenter.test.tsx`

**Interfaces:**
- Consumes: T7 REST
- Produces: 前端简历中心（列表 + 新建 + 分析结果展示 + 改写面板 + 岗位匹配 + 额度展示）

- [ ] **Step 1: 写失败测试 ResumeCenter.test.tsx（mock fetch 渲染列表 + 额度徽标）**

~~~tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResumeCenter from "./ResumeCenter";

afterEach(() => vi.unstubAllGlobals());

describe("ResumeCenter", () => {
  it("渲染简历列表与未配置额度提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes("/meta/quota")) return new Response(JSON.stringify({ configured: false, quota: null }), { status: 200 });
        return new Response(JSON.stringify([{ id: "r1", name: "我的简历", version: 1, source: "clawcv", contentText: "x", lastAnalysis: null }]), { status: 200 });
      })
    );
    render(
      <MemoryRouter>
        <ResumeCenter />
      </MemoryRouter>
    );
    expect(await screen.findByText("我的简历")).toBeTruthy();
    expect(await screen.findByText(/ClawCV 未配置/)).toBeTruthy();
  });
});
~~~

- [ ] **Step 2: 运行确认失败**

Run: `pnpm.cmd --filter @mt/applicant-web test`
Expected: FAIL

- [ ] **Step 3: 实现 ResumeCenter.tsx（核心交互）**

~~~tsx
import { Button, Card, Form, Input, List, Select, Space, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { api, type Position, type Resume } from "../api";

interface QuotaInfo { configured: boolean; quota: unknown; error?: string }

export default function ResumeCenter() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [selected, setSelected] = useState<Resume | null>(null);
  const [matchPositionId, setMatchPositionId] = useState<string | undefined>();
  const [rewriteInput, setRewriteInput] = useState({ sectionType: "work_experience", originalText: "" });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const refresh = () => {
    api.listResumes().then(setResumes);
    api.listPositions().then(setPositions);
    api.getQuota().then(setQuota).catch(() => setQuota(null));
  };

  useEffect(refresh, []);

  const analyze = async (id: string) => {
    try {
      const out = await api.analyzeResume(id);
      setSelected((s) => (s && s.id === id ? { ...s, lastAnalysis: out } : s));
      setResult(out);
      message.success("分析完成（" + (out.via === "clawcv" ? "ClawCV" : "本地降级") + "）");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  const rewrite = async (id: string) => {
    try {
      const out = await api.rewriteResume(id, rewriteInput);
      setResult(out);
      message.success("改写完成（" + (out.via === "clawcv" ? "ClawCV" : "本地降级") + "）");
    } catch (err) {
      message.error(String(err));
    }
  };

  const match = async (id: string) => {
    if (!matchPositionId) {
      message.warning("先选择目标岗位");
      return;
    }
    try {
      const out = await api.matchResume(id, matchPositionId);
      setResult(out);
      message.success("匹配完成（" + (out.via === "clawcv" ? "ClawCV" : "本地降级") + "）");
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card
      title="简历中心"
      extra={
        <Space>
          <Typography.Text type={quota?.configured ? "secondary" : "warning"}>
            {quota?.configured ? "ClawCV 已配置" : "ClawCV 未配置（本地降级模式）"}
          </Typography.Text>
          <Form
            layout="inline"
            onFinish={async (values: { name: string; contentText: string }) => {
              await api.createResume(values);
              message.success("已创建");
              refresh();
            }}
          >
            <Form.Item name="name" rules={[{ required: true }]}>
              <Input placeholder="简历名称" />
            </Form.Item>
            <Form.Item name="contentText" rules={[{ required: true }]}>
              <Input.TextArea placeholder="简历内容（ClawCV 读取或手动粘贴）" rows={3} style={{ width: 360 }} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              新建简历
            </Button>
          </Form>
        </Space>
      }
    >
      <List
        dataSource={resumes}
        rowKey="id"
        renderItem={(r) => (
          <List.Item
            actions={[
              <Button key="a" size="small" onClick={() => analyze(r.id)}>
                分析
              </Button>,
              <Button key="m" size="small" onClick={() => match(r.id)}>
                岗位匹配
              </Button>,
            ]}
          >
            <List.Item.Meta title={r.name} description={"版本 " + r.version + " · 来源 " + r.source} />
            {r.lastAnalysis ? <Tag>上次分析 via {(r.lastAnalysis as { via?: string }).via ?? "?"}</Tag> : null}
          </List.Item>
        )}
      />
      <Space direction="vertical" style={{ width: "100%", marginTop: 16 }}>
        <Select
          style={{ width: 320 }}
          placeholder="选择目标岗位做匹配"
          value={matchPositionId}
          onChange={setMatchPositionId}
          options={positions.map((p) => ({ value: p.id, label: p.company + " · " + p.title }))}
        />
        <Space.Compact style={{ width: "100%" }}>
          <Select
            style={{ width: 200 }}
            value={rewriteInput.sectionType}
            onChange={(v) => setRewriteInput((s) => ({ ...s, sectionType: v }))}
            options={[
              { value: "work_experience", label: "工作经历" },
              { value: "project", label: "项目经历" },
              { value: "summary", label: "个人总结" },
              { value: "skills", label: "技能" },
            ]}
          />
          <Input
            placeholder="要改写的原文"
            value={rewriteInput.originalText}
            onChange={(e) => setRewriteInput((s) => ({ ...s, originalText: e.target.value }))}
          />
          <Button onClick={() => selected?.id && rewrite(selected.id)} disabled={!rewriteInput.originalText}>
            改写
          </Button>
        </Space.Compact>
        {result ? (
          <Card size="small" title="结果">
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
          </Card>
        ) : null}
      </Space>
    </Card>
  );
}
~~~

api.ts 增补（Resume 类型 + listResumes/createResume/analyzeResume/rewriteResume/matchResume/getQuota）；App.tsx 增补 `<Route path="/resumes" element={<ResumeCenter />} />`。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm.cmd --filter @mt/applicant-web test`
Expected: PASS（3 用例）

- [ ] **Step 5: Commit**

~~~bash
git add apps/applicant/web
git commit -m "feat(applicant): 简历中心页面（分析/改写/匹配/额度）"
~~~

---

### Task 9: E2E 全流程 + CI 适配 + 文档收尾

**Files:**
- Create: `e2e/tests/applicant.spec.ts`
- Modify: `.github/workflows/ci.yml`（smoke/e2e：applicant 库 + MT_LLM_STUB）
- Modify: `infra/compose.prod.yml`（applicant-server DATABASE_URL → /applicant；postgres 挂载 init 脚本）
- Create: `.changeset/applicant-mvp.md`
- Modify: `docs/superpowers/specs/2026-08-18-applicant-design.md`（A1~A4 定稿——**执行前须用户确认**）

**Interfaces:**
- Consumes: T3~T8 全部
- Produces: 端到端验收 + CI 覆盖 + 发布日志

- [ ] **Step 1: 写失败测试 e2e/tests/applicant.spec.ts**

~~~ts
import { test, expect } from "@playwright/test";

test("applicant 岗位全流程（API 链路）", async ({ request }) => {
  const created = await request.post("/api/applicant/positions", {
    data: { company: "E2E全流程公司", title: "测试工程师" },
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json();
  expect(body.company).toBe("E2E全流程公司");

  const patched = await request.patch("/api/applicant/positions/" + body.id, { data: { status: "interview" } });
  expect((await patched.json()).status).toBe("interview");

  const interview = await request.post("/api/applicant/positions/" + body.id + "/interviews", {
    data: { round: 1, qaNotes: "问：接口幂等怎么设计？", reflection: "需要再复习" },
  });
  expect(interview.ok()).toBeTruthy();
  const iv = await interview.json();

  const analyzed = await request.post("/api/applicant/interviews/" + iv.id + "/analyze");
  expect(analyzed.ok()).toBeTruthy();

  const exported = await request.get("/api/applicant/interviews/" + iv.id + "/export.md");
  expect(exported.ok()).toBeTruthy();
  expect(await exported.text()).toContain("# 面试复盘");

  const quota = await request.get("/api/applicant/meta/quota");
  expect(quota.ok()).toBeTruthy();
});

test("applicant 岗位列表页面渲染与状态流转", async ({ page }) => {
  await page.goto("/applicant/positions");
  await expect(page.getByText("E2E全流程公司")).toBeVisible();
  await page.getByText("E2E全流程公司").click();
  await expect(page.getByText("测试工程师")).toBeVisible();
});
~~~

- [ ] **Step 2: 运行确认失败（本地需栈运行 + stub）**

Run: 启动栈（MT_LLM_STUB=1）+ `pnpm.cmd --filter @mt/e2e e2e`
Expected: FAIL（岗位流程代码已存在则部分通过，但此时以完整绿为目标；首次运行记录失败点即视为 RED）

- [ ] **Step 3: ci.yml 适配（smoke 与 e2e 两处）**

- postgres service env 改 `POSTGRES_DB: applicant`
- job env 的 DATABASE_URL 改 `postgres://postgres:postgres@127.0.0.1:5432/applicant`
- job env 增补 `MT_LLM_STUB: "1"`

- [ ] **Step 4: compose.prod.yml 适配**

- applicant-server 的 DATABASE_URL 改 `postgres://postgres:postgres@postgres:5432/applicant`
- postgres 服务 volumes 增补 `- ./infra/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql:ro`

- [ ] **Step 5: changeset 与 spec 定稿**

.changeset/applicant-mvp.md：

~~~markdown
---
"@mt/model-client": minor
"@mt/applicant-server": minor
"@mt/applicant-web": minor
---

Phase 1 试点：Applicant 求职管理 MVP（岗位/JD 解析/截图识别/面试复盘/简历管理/ClawCV 集成与降级）；@mt/model-client 新增多模态视觉路由。
~~~

spec 定稿：A1~A4 依据用户确认结果更新状态为 ✅。

- [ ] **Step 6: 全量验证（DoD）**

Run: `pnpm.cmd qa:gate` → 全栈 smoke（17 项）→ `pnpm.cmd --filter @mt/e2e e2e`（4 用例：gateway 2 + applicant 2）
Expected: 全绿

- [ ] **Step 7: Commit + PR**

~~~bash
git add e2e .github/workflows/ci.yml infra/compose.prod.yml .changeset docs
git commit -m "test(applicant): E2E 全流程与 CI 适配，补充迭代日志"
# 推送 dev → 创建 PR → CI 全绿 → 合并 → 清理 dev
~~~

## 验收标准（Applicant DoD）

1. 岗位 CRUD + 看板 + 状态流转（E2E 覆盖）
2. JD 解析与截图识别（stub 模式 E2E/冒烟覆盖；真实密钥联调 1 次）
3. 面试复盘分析 + 导出 markdown（E2E 覆盖）
4. 简历 analyze/rewrite/match 三链路，无 Key 全降级不报错（e2e 覆盖降级；真实 Key 联调 1 次）
5. CI 全绿 + 文档/迭代日志同步 + PR 合并 main
