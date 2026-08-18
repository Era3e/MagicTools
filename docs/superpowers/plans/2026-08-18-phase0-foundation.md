# Phase 0 工程化基座 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 MagicTools Monorepo 工程化基座：可并行开发的 8 子项目骨架 + 统一网关 + 5 个公共包 + 文档/配置/测试/CI/CD/镜像/分支机制全链路，验收标准为试点项目 Applicant 跑通「开发 → 测试 → 构建 → 镜像 → 部署」全流程。

**Architecture:** pnpm workspace Monorepo + Turborepo 增量构建；apps 下每子项目独立 web/server 双端 + 独立数据库；gateway 按 infra/ports.yaml 路由；公共能力下沉 packages（@mt/config、@mt/utils、@mt/types、@mt/model-client、@mt/ui、@mt/db）；CI 为 GitHub Actions 四层测试流水线。

**Tech Stack:** Node.js 20、pnpm 9、TypeScript 5(strict)、React 18 + Vite 5 + Ant Design 5、NestJS 10、PostgreSQL 16 + pgvector、Vitest、Playwright、Turborepo、Docker Compose、GitHub Actions。

**设计偏差说明（对设计文档的细化，实现时需同步修订 spec）：** 设计文档 4.4 的公共包清单增加 **@mt/db**（PG 连接池 + outbox 事件表 + 迁移执行器），原因：outbox 机制是 8 个子项目 server 的共用基础设施，放入 utils 会引入不必要的 pg 依赖，独立成包边界更清晰。本计划 Task 12 同步修订设计文档。

## Global Constraints

- Node.js >= 20；pnpm 9（packageManager 字段锁定）；TypeScript 5 且 strict: true
- React 18 + Vite 5 + Ant Design 5；NestJS 10；PostgreSQL 16 + pgvector（镜像 pgvector/pgvector:pg16）
- 端口唯一来源 infra/ports.yaml：gateway=3000，web 段 4001-4008，server 段 5001-5008；CI 校验无重复
- Monorepo 包名前缀 @mt/*；apps 结构固定为 apps/<项目>/{web,server}
- 数据交互：同步 REST + outbox 事件表 + 幂等键（DataEnvelope 契约，@mt/types）
- LLM 供应商：DeepSeek（DEEPSEEK_API_KEY，baseUrl https://api.deepseek.com/v1，默认模型 deepseek-chat）；智谱（ZHIPU_API_KEY，baseUrl https://open.bigmodel.cn/api/paas/v4，默认模型 glm-4-flash）
- 敏感配置不入库：.env.template 入库，真实值 git 忽略；CI 用 GitHub Actions secrets
- Conventional Commits：subject 中文、动词开头、<=50 字符；每个任务独立提交
- TDD：所有代码任务先写失败测试再实现；禁止 TODO/TBD/占位符
- 每个任务完成后更新 docs/memory/（即时记忆机制）；迭代日志走 changesets
- 分支模型：main / dev / feat-<项目>-<任务ID>-<描述>；PR + review + CI 全绿才能合并

## 文件地图

~~~
MagicTools/
├─ package.json / pnpm-workspace.yaml / turbo.json / tsconfig.base.json
├─ .gitignore / .editorconfig
├─ infra/
│  ├─ ports.yaml
│  ├─ docker-compose.dev.yml
│  ├─ compose.prod.yml
│  ├─ deploy.sh / backup.sh
│  └─ scripts/
│     ├─ lib/ports.mjs（端口分配纯函数）+ ports.test.mjs
│     ├─ new-app.mjs（app 生成器）
│     ├─ smoke.mjs（冒烟检查）+ lib/smoke.test.mjs
│     ├─ qa-gate.mjs（本地质量门禁）
│     └─ workspace.mjs（worktree 创建/清理）
├─ infra/templates/{web,server}/（app 骨架模板，含 Dockerfile）
├─ packages/
│  ├─ config/（@mt/config：YAML 加载 + env 覆盖 + zod 校验）
│  ├─ utils/（@mt/utils：幂等键/内容指纹/日期）
│  ├─ types/（@mt/types：ProjectId、DataEnvelope、ApiResponse）
│  ├─ model-client/（@mt/model-client：供应商注册表 + 重试 + 用量日志）
│  ├─ ui/（@mt/ui：设计令牌 + ThemeProvider + 组件）
│  └─ db/（@mt/db：连接池 + outbox + 迁移）
├─ apps/gateway/（Express + http-proxy-middleware）
├─ apps/<8个子项目>/{web,server}/（由生成器产出）
├─ e2e/（Playwright 配置 + 网关路由用例）
├─ .github/workflows/{ci.yml,branch-gc.yml,release.yml} + PULL_REQUEST_TEMPLATE.md
└─ docs/（AGENTS.md、ui-spec.md、git-workflow.md、memory/、CHANGELOG 机制）
~~~

---

### Task 1: 仓库根骨架（workspace + turbo + 基础配置）

**Files:**
- Create: `package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`.gitignore`、`.editorconfig`

**Interfaces:**
- Consumes: 无
- Produces: 根脚本 build/test/lint/smoke/new:app/docs:lint；workspace 匹配规则（后续所有任务依赖）

- [ ] **Step 1: 创建根 package.json**

~~~json
{
  "name": "magictools",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "test:infra": "node --test infra/scripts/lib/*.test.mjs",
    "smoke": "node infra/scripts/smoke.mjs",
    "new:app": "node infra/scripts/new-app.mjs",
    "docs:lint": "markdownlint-cli2 "docs/**/*.md""
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.5.0",
    "markdownlint-cli2": "^0.14.0"
  }
}
~~~

- [ ] **Step 2: 创建 pnpm-workspace.yaml**

~~~yaml
packages:
  - "apps/*"
  - "apps/*/*"
  - "packages/*"
~~~

- [ ] **Step 3: 创建 turbo.json**

~~~json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["build"] },
    "lint": {},
    "dev": { "cache": false, "persistent": true }
  }
}
~~~

- [ ] **Step 4: 创建 tsconfig.base.json**

~~~json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
~~~

- [ ] **Step 5: 创建 .gitignore 与 .editorconfig**

.gitignore：

~~~
node_modules/
dist/
.turbo/
coverage/
playwright-report/
test-results/
.env
.env.*
!.env.template
*.log
.DS_Store
~~~

.editorconfig：

~~~ini
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
~~~

- [ ] **Step 6: 验证**

Run: `pnpm install` 与 `pnpm exec turbo --version`
Expected: install 成功（无 workspace 包时报 0 包属正常）；turbo 版本 2.x 输出

- [ ] **Step 7: Commit**

~~~bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore .editorconfig pnpm-lock.yaml
git commit -m "chore(workspace): 初始化 pnpm monorepo 与 turbo 基础配置"
~~~

---

### Task 2: 端口注册表 + @mt/config 配置加载包

**Files:**
- Create: `infra/ports.yaml`
- Create: `packages/config/package.json`、`packages/config/tsconfig.json`、`packages/config/src/index.ts`
- Test: `packages/config/src/index.test.ts`、`packages/config/vitest.config.ts`

**Interfaces:**
- Consumes: Task 1 的 workspace 规则
- Produces: `loadYamlFile(path): unknown`、`resolveEnvOverrides(base, prefix): Record<string, unknown>`、`validateConfig(schema, value): z.infer<T>`（后续 gateway、server、CI 脚本均使用）；ports.yaml 结构 `{ <服务名>: { web: number, server?: number } }`

- [ ] **Step 1: 创建 infra/ports.yaml**

~~~yaml
gateway: { web: 3000 }
gatherer: { web: 4001, server: 5001 }
investigator: { web: 4002, server: 5002 }
assessor: { web: 4003, server: 5003 }
manager: { web: 4004, server: 5004 }
designer: { web: 4005, server: 5005 }
scholar: { web: 4006, server: 5006 }
assistant: { web: 4007, server: 5007 }
applicant: { web: 4008, server: 5008 }
~~~

- [ ] **Step 2: 创建 packages/config/package.json**

~~~json
{
  "name": "@mt/config",
  "version": "0.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": { "yaml": "^2.5.0", "zod": "^3.23.0" },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0" }
}
~~~

- [ ] **Step 3: 创建 packages/config/tsconfig.json 与 vitest.config.ts**

tsconfig.json：

~~~json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
~~~

vitest.config.ts：

~~~ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
});
~~~

- [ ] **Step 4: 写失败测试 packages/config/src/index.test.ts**

~~~ts
import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { loadYamlFile, resolveEnvOverrides, validateConfig } from "./index";

const schema = z.object({ web: z.number(), server: z.number().optional() });

describe("@mt/config", () => {
  it("loadYamlFile 解析 YAML 文件", () => {
    const dir = mkdtempSync(join(tmpdir(), "mtcfg-"));
    const p = join(dir, "ports.yaml");
    writeFileSync(p, "gateway: { web: 3000 }
", "utf8");
    const data = loadYamlFile(p) as Record<string, unknown>;
    expect(data.gateway).toEqual({ web: 3000 });
    rmSync(dir, { recursive: true, force: true });
  });

  it("resolveEnvOverrides 用环境变量覆盖同名前缀键", () => {
    process.env.MT_TEST_WEB = "4001";
    const out = resolveEnvOverrides({ web: 3999 }, "MT_TEST_");
    expect(out.web).toBe("4001");
    delete process.env.MT_TEST_WEB;
  });

  it("validateConfig 校验失败时抛出带信息错误", () => {
    expect(() => validateConfig(schema, { web: "not-a-number" })).toThrow(/配置校验失败/);
  });
});
~~~

- [ ] **Step 5: 运行测试确认失败**

Run: `pnpm --filter @mt/config test`
Expected: FAIL（模块 ./index 不存在）

- [ ] **Step 6: 实现 packages/config/src/index.ts**

~~~ts
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

export function loadYamlFile(path: string): unknown {
  return parse(readFileSync(path, "utf8"));
}

export function resolveEnvOverrides(
  base: Record<string, unknown>,
  prefix: string
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value !== undefined) {
      out[key.slice(prefix.length).toLowerCase()] = value;
    }
  }
  return out;
}

export function validateConfig<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error("配置校验失败: " + result.error.message);
  }
  return result.data;
}
~~~

- [ ] **Step 7: 运行测试确认通过**

Run: `pnpm --filter @mt/config test`
Expected: PASS（3 用例）

- [ ] **Step 8: Commit**

~~~bash
git add infra/ports.yaml packages/config
git commit -m "feat(config): 新增端口注册表与 @mt/config 配置加载包"
~~~

---

### Task 3: @mt/utils 与 @mt/types 公共包

**Files:**
- Create: `packages/utils/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/index.test.ts}`
- Create: `packages/types/{package.json,tsconfig.json,src/index.ts,src/index.test.ts}`

**Interfaces:**
- Consumes: Task 1 的 workspace 规则
- Produces: `idempotencyKey(prefix): string`、`contentFingerprint(text): string`、`formatDate(d: Date): string`；类型 `PROJECT_IDS`、`ProjectId`、`DataEnvelope<T>`（outbox 与子项目间数据契约）、`ApiResponse<T>`

- [ ] **Step 1: 创建 packages/utils/package.json 与 tsconfig.json**

package.json（依赖仅 typescript/vitest）：

~~~json
{
  "name": "@mt/utils",
  "version": "0.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0" }
}
~~~

tsconfig.json 与 vitest.config.ts 内容同 Task 2（extends 路径相同）。

- [ ] **Step 2: 写失败测试 packages/utils/src/index.test.ts**

~~~ts
import { describe, it, expect } from "vitest";
import { idempotencyKey, contentFingerprint, formatDate } from "./index";

describe("@mt/utils", () => {
  it("idempotencyKey 带前缀且唯一", () => {
    const a = idempotencyKey("evt");
    const b = idempotencyKey("evt");
    expect(a.startsWith("evt-")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("contentFingerprint 相同内容指纹一致且长度 32", () => {
    const f = contentFingerprint("hello world");
    expect(f).toBe(contentFingerprint("hello world"));
    expect(f.length).toBe(32);
    expect(f).not.toBe(contentFingerprint("hello world!"));
  });

  it("formatDate 输出 ISO 日期", () => {
    expect(formatDate(new Date("2026-08-18T12:00:00Z"))).toBe("2026-08-18");
  });
});
~~~

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @mt/utils test`
Expected: FAIL

- [ ] **Step 4: 实现 packages/utils/src/index.ts**

~~~ts
import { createHash, randomUUID } from "node:crypto";

export function idempotencyKey(prefix: string): string {
  return prefix + "-" + randomUUID();
}

export function contentFingerprint(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 32);
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
~~~

- [ ] **Step 5: 运行测试确认通过并 Commit**

Run: `pnpm --filter @mt/utils test`
Expected: PASS（3 用例）

~~~bash
git add packages/utils
git commit -m "feat(utils): 新增幂等键、内容指纹与日期工具"
~~~

- [ ] **Step 6: 创建 packages/types/package.json 与 src/index.ts**

package.json：

~~~json
{
  "name": "@mt/types",
  "version": "0.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0" }
}
~~~

src/index.ts：

~~~ts
export const PROJECT_IDS = [
  "gatherer",
  "investigator",
  "assessor",
  "manager",
  "designer",
  "scholar",
  "assistant",
  "applicant",
] as const;

export type ProjectId = (typeof PROJECT_IDS)[number];

export interface DataEnvelope<T> {
  id: string;
  event: string;
  source: ProjectId;
  payload: T;
  occurredAt: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
~~~

- [ ] **Step 7: 写测试 packages/types/src/index.test.ts（验证常量与契约结构）**

~~~ts
import { describe, it, expect } from "vitest";
import { PROJECT_IDS, type DataEnvelope } from "./index";

describe("@mt/types", () => {
  it("PROJECT_IDS 包含 8 个子项目且无 gateway", () => {
    expect(PROJECT_IDS).toHaveLength(8);
    expect(PROJECT_IDS).not.toContain("gateway");
    expect(PROJECT_IDS).toContain("applicant");
  });

  it("DataEnvelope 携带 outbox 所需字段", () => {
    const env: DataEnvelope<{ ok: boolean }> = {
      id: "e-1",
      event: "test.happened",
      source: "applicant",
      payload: { ok: true },
      occurredAt: new Date().toISOString(),
    };
    expect(env.source).toBe("applicant");
    expect(env.payload.ok).toBe(true);
  });
});
~~~

- [ ] **Step 8: 运行测试确认通过并 Commit**

Run: `pnpm --filter @mt/types test`
Expected: PASS（2 用例）

~~~bash
git add packages/types
git commit -m "feat(types): 新增子项目枚举与 outbox 数据契约"
~~~

---

### Task 4: @mt/model-client LLM 统一抽象层

**Files:**
- Create: `packages/model-client/{package.json,tsconfig.json,vitest.config.ts,src/types.ts,src/providers.ts,src/client.ts,src/index.ts}`
- Test: `packages/model-client/src/client.test.ts`

**Interfaces:**
- Consumes: Task 1 workspace 规则
- Produces: `ChatMessage`、`ChatOptions`、`UsageLog`、`ModelProviderConfig`、`DEEPSEEK`、`ZHIPU`、`createModelClient(provider, logUsage?): ModelClient`、`chatStream(provider, messages, options, logUsage?): AsyncGenerator<string>`；`ModelClient.chat(messages, options?): Promise<{ content: string; usage: UsageLog }>`（后续所有子项目调用 LLM 的唯一入口）

- [ ] **Step 1: 创建 package.json、tsconfig.json、vitest.config.ts**

package.json（运行时零依赖，使用内置 fetch）：

~~~json
{
  "name": "@mt/model-client",
  "version": "0.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0" }
}
~~~

tsconfig.json、vitest.config.ts 同 Task 2。

- [ ] **Step 2: 创建 src/types.ts 与 src/providers.ts**

types.ts：

~~~ts
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface UsageLog {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  ms: number;
}

export interface ModelProviderConfig {
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  defaultModel: string;
}
~~~

providers.ts：

~~~ts
import type { ModelProviderConfig } from "./types";

export const DEEPSEEK: ModelProviderConfig = {
  name: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  apiKeyEnv: "DEEPSEEK_API_KEY",
  defaultModel: "deepseek-chat",
};

export const ZHIPU: ModelProviderConfig = {
  name: "zhipu",
  baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  apiKeyEnv: "ZHIPU_API_KEY",
  defaultModel: "glm-4-flash",
};

export const BUILTIN_PROVIDERS: ModelProviderConfig[] = [DEEPSEEK, ZHIPU];
~~~

- [ ] **Step 3: 写失败测试 src/client.test.ts**

~~~ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { createModelClient, chatStream } from "./client";
import { DEEPSEEK } from "./providers";
import type { ChatMessage } from "./types";

const okResponse = {
  choices: [{ message: { content: "你好" } }],
  usage: { prompt_tokens: 10, completion_tokens: 2 },
};

afterEach(() => vi.unstubAllGlobals());

describe("model-client", () => {
  it("chat 使用 OpenAI 兼容协议调用并返回内容", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createModelClient(DEEPSEEK, () => {});
    const result = await client.chat([{ role: "user", content: "hi" }]);
    expect(result.content).toBe("你好");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("deepseek-chat");
    expect(body.messages[0].content).toBe("hi");
  });

  it("chat 遇到 429 自动重试后成功", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createModelClient(DEEPSEEK, () => {});
    const result = await client.chat([{ role: "user", content: "hi" }]);
    expect(result.content).toBe("你好");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("chat 调用结束后上报用量日志", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(okResponse), { status: 200 })));
    const logs: unknown[] = [];
    const client = createModelClient(DEEPSEEK, (u) => logs.push(u));
    await client.chat([{ role: "user", content: "hi" }]);
    expect(logs).toHaveLength(1);
  });

  it("chatStream 逐段输出 SSE 增量", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"你"}}]}',
      "",
      'data: {"choices":[{"delta":{"content":"好"}}]}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200 })));
    const parts: string[] = [];
    for await (const part of chatStream(DEEPSEEK, [{ role: "user", content: "hi" }], {}, () => {})) {
      parts.push(part);
    }
    expect(parts.join("")).toBe("你好");
  });
});
~~~

- [ ] **Step 4: 运行测试确认失败**

Run: `pnpm --filter @mt/model-client test`
Expected: FAIL（client 模块不存在）

- [ ] **Step 5: 实现 src/client.ts 与 src/index.ts**

client.ts：

~~~ts
import type { ChatMessage, ChatOptions, ModelProviderConfig, UsageLog } from "./types";

export interface ModelClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<{ content: string; usage: UsageLog }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequest(provider: ModelProviderConfig, messages: ChatMessage[], options: ChatOptions, stream: boolean): RequestInit {
  const model = options.model ?? provider.defaultModel;
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env[provider.apiKeyEnv],
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
      stream,
    }),
  };
}

export async function* chatStream(
  provider: ModelProviderConfig,
  messages: ChatMessage[],
  options: ChatOptions = {},
  logUsage: (usage: UsageLog) => void = () => {}
): AsyncGenerator<string, void, undefined> {
  const started = Date.now();
  const res = await fetch(provider.baseUrl + "/chat/completions", buildRequest(provider, messages, options, true));
  if (!res.ok || !res.body) {
    throw new Error("模型调用失败: " + res.status + " " + (await res.text()).slice(0, 200));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outputTokens = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") {
        logUsage({
          provider: provider.name,
          model: options.model ?? provider.defaultModel,
          inputTokens: 0,
          outputTokens,
          ms: Date.now() - started,
        });
        return;
      }
      const json = JSON.parse(data);
      const delta: string | undefined = json.choices?.[0]?.delta?.content;
      if (delta) {
        outputTokens += 1;
        yield delta;
      }
    }
  }
}

export function createModelClient(
  provider: ModelProviderConfig,
  logUsage: (usage: UsageLog) => void = () => {}
): ModelClient {
  return {
    async chat(messages, options = {}) {
      if (options.stream) {
        let content = "";
        let usage: UsageLog = { provider: provider.name, model: options.model ?? provider.defaultModel, inputTokens: 0, outputTokens: 0, ms: 0 };
        for await (const part of chatStream(provider, messages, options, (u) => { usage = u; logUsage(u); })) {
          content += part;
        }
        return { content, usage };
      }
      const started = Date.now();
      const model = options.model ?? provider.defaultModel;
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(provider.baseUrl + "/chat/completions", buildRequest(provider, messages, options, false));
          if (res.status === 429 || res.status >= 500) {
            lastError = new Error("上游服务错误 " + res.status);
            await sleep(attempt * 500);
            continue;
          }
          if (!res.ok) {
            throw new Error("模型调用失败: " + res.status + " " + (await res.text()).slice(0, 200));
          }
          const data = await res.json();
          const usage: UsageLog = {
            provider: provider.name,
            model,
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
            ms: Date.now() - started,
          };
          logUsage(usage);
          return { content: data.choices[0].message.content ?? "", usage };
        } catch (err) {
          lastError = err;
          if (attempt < 3) await sleep(attempt * 500);
        }
      }
      throw lastError instanceof Error ? lastError : new Error("模型调用失败");
    },
  };
}
~~~

index.ts：

~~~ts
export * from "./types";
export * from "./providers";
export { createModelClient, chatStream } from "./client";
export type { ModelClient } from "./client";
~~~

- [ ] **Step 6: 运行测试确认通过并 Commit**

Run: `pnpm --filter @mt/model-client test`
Expected: PASS（4 用例）

~~~bash
git add packages/model-client
git commit -m "feat(model-client): 新增 LLM 统一抽象层支持 DeepSeek 与智谱"
~~~

---

### Task 5: @mt/ui 设计令牌与公共组件库基础

**Files:**
- Create: `packages/ui/{package.json,tsconfig.json,vitest.config.ts,src/tokens.ts,src/theme.tsx,src/MtEmptyState.tsx,src/index.ts}`
- Test: `packages/ui/src/MtEmptyState.test.tsx`

**Interfaces:**
- Consumes: Task 1 workspace 规则
- Produces: `tokens`（设计令牌常量）、`MtThemeProvider`、`MtEmptyState(props: { title: string; actionText?: string; onAction?: () => void })`（后续所有 web 应用统一入口组件与令牌来源）

- [ ] **Step 1: 创建 package.json 与 tsconfig.json**

package.json：

~~~json
{
  "name": "@mt/ui",
  "version": "0.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "peerDependencies": { "react": "^18.3.0", "antd": "^5.21.0" },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "antd": "^5.21.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^24.1.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
~~~

tsconfig.json（启用 JSX）：

~~~json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
~~~

vitest.config.ts：

~~~ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "jsdom" },
});
~~~

- [ ] **Step 2: 创建 src/tokens.ts 与 src/theme.tsx**

tokens.ts：

~~~ts
export const tokens = {
  color: {
    primary: "#2f54eb",
    success: "#52c41a",
    warning: "#faad14",
    error: "#ff4d4f",
    text: "#1f1f1f",
    textSecondary: "#666666",
    bgLayout: "#f5f6f8",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  fontSize: { sm: 12, md: 14, lg: 16, xl: 20 },
  radius: 6,
} as const;
~~~

theme.tsx：

~~~tsx
import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { tokens } from "./tokens";

export function MtThemeProvider(props: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: tokens.color.primary,
          colorSuccess: tokens.color.success,
          colorWarning: tokens.color.warning,
          colorError: tokens.color.error,
          borderRadius: tokens.radius,
          fontSize: tokens.fontSize.md,
        },
      }}
    >
      {props.children}
    </ConfigProvider>
  );
}
~~~

- [ ] **Step 3: 写失败测试 src/MtEmptyState.test.tsx**

~~~tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MtEmptyState } from "./MtEmptyState";

describe("MtEmptyState", () => {
  it("渲染标题与操作按钮，点击触发回调", () => {
    const onAction = vi.fn();
    render(<MtEmptyState title="暂无数据" actionText="去创建" onAction={onAction} />);
    expect(screen.getByText("暂无数据")).toBeTruthy();
    fireEvent.click(screen.getByText("去创建"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
~~~

- [ ] **Step 4: 运行测试确认失败**

Run: `pnpm --filter @mt/ui test`
Expected: FAIL（MtEmptyState 不存在）

- [ ] **Step 5: 实现 src/MtEmptyState.tsx 与 src/index.ts**

MtEmptyState.tsx：

~~~tsx
import { Button, Empty } from "antd";

export function MtEmptyState(props: { title: string; actionText?: string; onAction?: () => void }) {
  return (
    <Empty description={props.title}>
      {props.actionText && props.onAction ? (
        <Button type="primary" onClick={props.onAction}>
          {props.actionText}
        </Button>
      ) : null}
    </Empty>
  );
}
~~~

index.ts：

~~~ts
export { tokens } from "./tokens";
export { MtThemeProvider } from "./theme";
export { MtEmptyState } from "./MtEmptyState";
~~~

- [ ] **Step 6: 运行测试确认通过并 Commit**

Run: `pnpm --filter @mt/ui test`
Expected: PASS（1 用例）

~~~bash
git add packages/ui
git commit -m "feat(ui): 新增设计令牌、主题提供器与 MtEmptyState 组件"
~~~

---

### Task 6: gateway 统一网关

**Files:**
- Create: `apps/gateway/{package.json,tsconfig.json,vitest.config.ts,src/routes.ts,src/app.ts,src/index.ts}`
- Test: `apps/gateway/src/routes.test.ts`、`apps/gateway/src/app.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `loadYamlFile`、infra/ports.yaml；Task 3 的 `@mt/types`
- Produces: `PortsConfig`、`buildRoutes(ports, host): ProxyRoute[]`、`serviceHost(env): (name: string) => string`、`createGateway(ports, env?): Express`；路由约定：web 应用挂 /<项目名>，server API 挂 /api/<项目名>（后续所有子项目遵循此约定）

- [ ] **Step 1: 创建 package.json、tsconfig.json、vitest.config.ts**

package.json：

~~~json
{
  "name": "@mt/gateway",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "express": "^4.19.0",
    "http-proxy-middleware": "^3.0.0",
    "@mt/config": "workspace:*",
    "@mt/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "tsx": "^4.19.0",
    "@types/express": "^4.17.21",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  }
}
~~~

tsconfig.json、vitest.config.ts 同 Task 2（extends 路径 ../../tsconfig.base.json）。

- [ ] **Step 2: 写失败测试 src/routes.test.ts**

~~~ts
import { describe, it, expect } from "vitest";
import { buildRoutes, serviceHost } from "./routes";

describe("gateway routes", () => {
  it("按 ports 配置生成 web 与 api 两条路由", () => {
    const routes = buildRoutes({ applicant: { web: 4008, server: 5008 } }, () => "127.0.0.1");
    expect(routes).toEqual([
      { name: "applicant-web", path: "/applicant", target: "http://127.0.0.1:4008" },
      { name: "applicant-server", path: "/api/applicant", target: "http://127.0.0.1:5008" },
    ]);
  });

  it("生产环境目标主机使用容器服务名", () => {
    const host = serviceHost({ MT_PROD: "1" });
    expect(host("applicant-server")).toBe("applicant-server");
  });

  it("本地环境目标主机使用 127.0.0.1", () => {
    const host = serviceHost({});
    expect(host("applicant-server")).toBe("127.0.0.1");
  });
});
~~~

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @mt/gateway test`
Expected: FAIL

- [ ] **Step 4: 实现 src/routes.ts**

~~~ts
export interface PortMap {
  web: number;
  server?: number;
}

export type PortsConfig = Record<string, PortMap>;

export interface ProxyRoute {
  name: string;
  path: string;
  target: string;
}

export function buildRoutes(ports: PortsConfig, host: (serviceName: string) => string): ProxyRoute[] {
  const routes: ProxyRoute[] = [];
  for (const [name, port] of Object.entries(ports)) {
    if (port.web) {
      routes.push({ name: name + "-web", path: "/" + name, target: "http://" + host(name + "-web") + ":" + port.web });
    }
    if (port.server) {
      routes.push({ name: name + "-server", path: "/api/" + name, target: "http://" + host(name + "-server") + ":" + port.server });
    }
  }
  return routes;
}

export function serviceHost(env: NodeJS.ProcessEnv): (name: string) => string {
  return (name: string) => (env.MT_PROD === "1" ? name : "127.0.0.1");
}
~~~

- [ ] **Step 5: 写失败测试 src/app.test.ts**

~~~ts
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import type { AddressInfo } from "node:net";
import { createGateway } from "./app";

describe("gateway app", () => {
  it("未配置 token 时放行 /health", async () => {
    const app = createGateway({}, {});
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("up");
  });

  it("配置 token 后无凭证返回 401", async () => {
    const app = createGateway({}, { GATEWAY_TOKEN: "secret" });
    const res = await request(app).get("/health");
    expect(res.status).toBe(401);
  });

  it("携带正确 token 放行", async () => {
    const app = createGateway({}, { GATEWAY_TOKEN: "secret" });
    const res = await request(app).get("/health").set("X-Access-Token", "secret");
    expect(res.status).toBe(200);
  });

  it("将请求代理到目标服务", async () => {
    const dummy = express();
    dummy.get("/dummy", (_req, res) => res.json({ ok: true }));
    const server = dummy.listen(0);
    const port = (server.address() as AddressInfo).port;
    try {
      const app = createGateway({ dummy: { web: port } }, {});
      const res = await request(app).get("/dummy");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    } finally {
      server.close();
    }
  });
});
~~~

- [ ] **Step 6: 运行测试确认失败**

Run: `pnpm --filter @mt/gateway test`
Expected: FAIL（app 模块不存在）

- [ ] **Step 7: 实现 src/app.ts 与 src/index.ts**

app.ts：

~~~ts
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { buildRoutes, serviceHost, type PortsConfig } from "./routes";

export function createGateway(ports: PortsConfig, env: NodeJS.ProcessEnv = process.env) {
  const app = express();
  app.use((req, res, next) => {
    const token = env.GATEWAY_TOKEN;
    if (!token || req.headers["x-access-token"] === token) {
      next();
      return;
    }
    res.status(401).json({ code: 401, message: "未授权" });
  });
  const host = serviceHost(env);
  for (const route of buildRoutes(ports, host)) {
    app.use(
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        pathFilter: (path: string) => path.startsWith(route.path),
      })
    );
  }
  app.get("/health", (_req, res) => res.json({ status: "up", service: "gateway" }));
  return app;
}
~~~

index.ts：

~~~ts
import { join } from "node:path";
import { loadYamlFile } from "@mt/config";
import { createGateway } from "./app";
import type { PortsConfig } from "./routes";

const ports = loadYamlFile(join(process.cwd(), "infra", "ports.yaml")) as PortsConfig;
const app = createGateway(ports);
app.listen(3000, () => {
  console.log("gateway listening on http://127.0.0.1:3000");
});
~~~

- [ ] **Step 8: 运行测试确认通过并 Commit**

Run: `pnpm --filter @mt/gateway test`
Expected: PASS（7 用例）

~~~bash
git add apps/gateway
git commit -m "feat(gateway): 新增统一网关支持端口路由、鉴权与健康检查"
~~~

---

### Task 7: app 生成器与 8 个子项目骨架

**Files:**
- Create: `infra/scripts/lib/ports.mjs`、`infra/scripts/lib/ports.test.mjs`、`infra/scripts/new-app.mjs`
- Create: `infra/templates/web/{package.json,tsconfig.json,vite.config.ts,vitest.config.ts,index.html,src/main.tsx,src/App.tsx,src/App.test.tsx,Dockerfile,nginx.conf}`
- Create: `infra/templates/server/{package.json,tsconfig.json,src/main.ts,src/app.module.ts,src/health.controller.ts,src/health.e2e.test.ts,Dockerfile}`
- 生成: `apps/{applicant,gatherer,investigator,assessor,manager,designer,scholar,assistant}/{web,server}`（生成器产出）

**Interfaces:**
- Consumes: Task 2 的 ports.yaml 结构；Task 1 的 workspace 规则
- Produces: `allocPorts(existing, name): { web: number; server: number }`；命令 `pnpm new:app <name>`；模板约定（所有子项目遵循）：server 全局前缀 `/api/<项目名>`、web 挂 `/<项目名>`、占位符 `__NAME__`/`__WEB_PORT__`/`__SERVER_PORT__`

- [ ] **Step 1: 写失败测试 infra/scripts/lib/ports.test.mjs**

~~~js
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocPorts, nextFree } from "./ports.mjs";

test("nextFree 跳过已占用端口", () => {
  assert.equal(nextFree([4001, 4002], 4001), 4003);
});

test("allocPorts 从 4001/5001 起顺序分配且不冲突", () => {
  const a = allocPorts({}, "applicant");
  assert.deepEqual(a, { web: 4001, server: 5001 });
  const b = allocPorts({ applicant: a }, "gatherer");
  assert.deepEqual(b, { web: 4002, server: 5002 });
});

test("allocPorts 拒绝重复创建", () => {
  assert.throws(
    () => allocPorts({ applicant: { web: 4001, server: 5001 } }, "applicant"),
    /已存在/
  );
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test infra/scripts/lib/ports.test.mjs`
Expected: FAIL（ports.mjs 不存在）

- [ ] **Step 3: 实现 infra/scripts/lib/ports.mjs 与 infra/scripts/new-app.mjs**

ports.mjs：

~~~js
export function nextFree(taken, base) {
  let port = base;
  while (taken.includes(port)) port += 1;
  return port;
}

export function allocPorts(existing, name) {
  if (existing[name]) throw new Error("应用已存在: " + name);
  const entries = Object.entries(existing);
  const web = nextFree(entries.map(([, p]) => p.web).filter(Boolean), 4001);
  const server = nextFree(entries.map(([, p]) => p.server).filter(Boolean), 5001);
  return { web, server };
}
~~~

new-app.mjs：

~~~js
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { allocPorts } from "./lib/ports.mjs";

const name = process.argv[2];
if (!name) {
  console.error("用法: pnpm new:app <name>");
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("名称仅允许小写字母、数字与连字符，且以字母开头");
  process.exit(1);
}

const cwd = process.cwd();
const portsPath = join(cwd, "infra", "ports.yaml");
const ports = parse(readFileSync(portsPath, "utf8"));
const { web, server } = allocPorts(ports, name);
ports[name] = { web, server };
writeFileSync(portsPath, stringify(ports));

function renderDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const dst = join(to, entry);
    if (statSync(src).isDirectory()) {
      renderDir(src, dst);
      continue;
    }
    const content = readFileSync(src, "utf8")
      .split("__NAME__").join(name)
      .split("__WEB_PORT__").join(String(web))
      .split("__SERVER_PORT__").join(String(server));
    writeFileSync(dst, content);
  }
}

renderDir(join(cwd, "infra", "templates", "web"), join(cwd, "apps", name, "web"));
renderDir(join(cwd, "infra", "templates", "server"), join(cwd, "apps", name, "server"));
console.log("已创建 apps/" + name + "（web:" + web + " server:" + server + "）");
~~~

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test infra/scripts/lib/ports.test.mjs`
Expected: PASS（3 用例）

- [ ] **Step 5: 创建 web 模板（9 个文件）**

infra/templates/web/package.json：

~~~json
{
  "name": "@mt/__NAME__-web",
  "private": true,
  "scripts": {
    "dev": "vite --port __WEB_PORT__ --strictPort",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port __WEB_PORT__ --strictPort",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "antd": "^5.21.0",
    "@mt/ui": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "jsdom": "^24.1.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
~~~

infra/templates/web/tsconfig.json：

~~~json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src"]
}
~~~

infra/templates/web/vite.config.ts：

~~~ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/__NAME__/",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:__SERVER_PORT__",
    },
  },
});
~~~

infra/templates/web/vitest.config.ts：

~~~ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "jsdom" },
});
~~~

infra/templates/web/index.html：

~~~html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>__NAME__</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
~~~

infra/templates/web/src/main.tsx：

~~~tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { MtThemeProvider } from "@mt/ui";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MtThemeProvider>
      <App />
    </MtThemeProvider>
  </React.StrictMode>
);
~~~

infra/templates/web/src/App.tsx：

~~~tsx
import { useEffect, useState } from "react";
import { Card, Typography } from "antd";

export default function App() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    fetch("/api/__NAME__/health")
      .then((res) => (res.ok ? setStatus("up") : setStatus("down")))
      .catch(() => setStatus("down"));
  }, []);
  return (
    <Card title="__NAME__">
      <Typography.Text>服务状态: {status}</Typography.Text>
    </Card>
  );
}
~~~

infra/templates/web/src/App.test.tsx：

~~~tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("渲染标题并显示服务状态 up", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    render(<App />);
    expect(screen.getByText("__NAME__")).toBeTruthy();
    expect(await screen.findByText(/服务状态: up/)).toBeTruthy();
  });
});
~~~

infra/templates/web/Dockerfile：

~~~dockerfile
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @mt/__NAME__-web build

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/__NAME__/web/dist /usr/share/nginx/html
COPY --from=build /repo/apps/__NAME__/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE __WEB_PORT__
~~~

infra/templates/web/nginx.conf：

~~~nginx
server {
    listen __WEB_PORT__;
    root /usr/share/nginx/html;

    location /__NAME__/ {
        alias /usr/share/nginx/html/;
        try_files $uri $uri/ /index.html;
    }
}
~~~

- [ ] **Step 6: 创建 server 模板（7 个文件）**

infra/templates/server/package.json：

~~~json
{
  "name": "@mt/__NAME__-server",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "test": "vitest run",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "@mt/config": "workspace:*",
    "@mt/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "tsx": "^4.19.0",
    "@types/node": "^20.14.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  }
}
~~~

infra/templates/server/tsconfig.json：

~~~json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
~~~

infra/templates/server/src/main.ts：

~~~ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? __SERVER_PORT__);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/__NAME__");
  app.enableCors();
  await app.listen(PORT);
  console.log("__NAME__-server listening on " + PORT);
}

bootstrap();
~~~

infra/templates/server/src/app.module.ts：

~~~ts
import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
})
export class AppModule {}
~~~

infra/templates/server/src/health.controller.ts：

~~~ts
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return { status: "up", service: "__NAME__-server" };
  }
}
~~~

infra/templates/server/src/health.e2e.test.ts：

~~~ts
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";

describe("health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/__NAME__");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/__NAME__/health 返回 up", async () => {
    const res = await request(app.getHttpServer()).get("/api/__NAME__/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("up");
  });
});
~~~

infra/templates/server/Dockerfile：

~~~dockerfile
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @mt/__NAME__-server build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/__NAME__/server/dist ./dist
CMD ["node", "dist/main.js"]
~~~

- [ ] **Step 7: 为 8 个子项目执行生成器**

Run:

~~~bash
pnpm new:app applicant
pnpm new:app gatherer
pnpm new:app investigator
pnpm new:app assessor
pnpm new:app manager
pnpm new:app designer
pnpm new:app scholar
pnpm new:app assistant
pnpm install
~~~

Expected: 8 个 apps/<name> 目录生成；ports.yaml 保持 9 项且端口无重复。

- [ ] **Step 8: 验证 applicant 全链路（本任务验收）**

Run（三个后台任务 + 两次探测）：

~~~bash
pnpm --filter @mt/applicant-server dev
pnpm --filter @mt/applicant-web dev
pnpm --filter @mt/gateway dev
curl http://127.0.0.1:5008/api/applicant/health
curl http://127.0.0.1:3000/applicant
curl http://127.0.0.1:3000/api/applicant/health
~~~

Expected: 前两个返回 `{"status":"up"...}`，`/applicant` 返回 HTML（含 title applicant）。

- [ ] **Step 9: 运行全仓测试与构建**

Run: `pnpm build`、`pnpm test`
Expected: 全部通过（8 个 web + 8 个 server + gateway + 各 package）

- [ ] **Step 10: Commit**

~~~bash
git add infra/scripts infra/templates apps pnpm-lock.yaml
git commit -m "feat(scaffold): 新增 app 生成器与 8 个子项目骨架"
~~~

---

### Task 8: @mt/db、outbox 事件表与本地数据库编排

**Files:**
- Create: `infra/docker-compose.dev.yml`
- Create: `packages/db/{package.json,tsconfig.json,vitest.config.ts,src/pool.ts,src/outbox.ts,src/migrations.ts,src/outbox.test.ts,migrations/001_outbox.sql}`
- Modify: `apps/applicant/server/src/main.ts`（接入数据库连接池 + 断连降级启动）、`apps/applicant/server/package.json`（加依赖）

**Interfaces:**
- Consumes: Task 3 的 `DataEnvelope`
- Produces: `createPool(connectionString): Pool`、`runMigrations(pool, dir): Promise<void>`、`appendOutbox(pool, event: DataEnvelope<unknown>): Promise<void>`、`processOutbox(pool, handler, opts?): Promise<number>`（后续 Gatherer→Scholar、Investigator→Assessor 等所有异步推送的通用机制）

- [ ] **Step 1: 创建 infra/docker-compose.dev.yml**

~~~yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: magictools
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
~~~

- [ ] **Step 2: 创建 packages/db/package.json 与 tsconfig.json**

package.json：

~~~json
{
  "name": "@mt/db",
  "version": "0.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "pg": "^8.12.0",
    "@mt/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/pg": "^8.11.0"
  }
}
~~~

tsconfig.json、vitest.config.ts 同 Task 2。

- [ ] **Step 3: 写失败测试 src/outbox.test.ts（数据库不可达时自动跳过）**

~~~ts
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrations";
import { appendOutbox, processOutbox } from "./outbox";

const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/mt_test";
let pool: Pool;
let available = false;

beforeAll(async () => {
  pool = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await pool.query("SELECT 1");
    available = true;
    await runMigrations(pool, process.cwd() + "/migrations");
  } catch {
    available = false;
  }
}, 15000);

afterAll(async () => {
  if (pool) await pool.end();
});

describe.skipIf(!available)("outbox", () => {
  it("append 后 process 成功处理并置为 done", async () => {
    await pool.query("DELETE FROM outbox WHERE id = $1", ["t-1"]);
    await appendOutbox(pool, {
      id: "t-1",
      event: "test.happened",
      source: "applicant",
      payload: { a: 1 },
      occurredAt: new Date().toISOString(),
    });
    const handled: string[] = [];
    const count = await processOutbox(pool, async (evt) => {
      handled.push(evt.id);
    });
    expect(count).toBe(1);
    expect(handled).toEqual(["t-1"]);
    const row = await pool.query("SELECT status FROM outbox WHERE id = $1", ["t-1"]);
    expect(row.rows[0].status).toBe("done");
  });

  it("handler 抛错时置为 retry 并记录错误", async () => {
    await pool.query("DELETE FROM outbox WHERE id = $1", ["t-2"]);
    await appendOutbox(pool, {
      id: "t-2",
      event: "test.failed",
      source: "applicant",
      payload: {},
      occurredAt: new Date().toISOString(),
    });
    await processOutbox(pool, async () => {
      throw new Error("boom");
    });
    const row = await pool.query("SELECT status, attempts FROM outbox WHERE id = $1", ["t-2"]);
    expect(row.rows[0].status).toBe("retry");
    expect(row.rows[0].attempts).toBe(1);
  });
});
~~~

- [ ] **Step 4: 运行测试确认失败**

Run: `pnpm --filter @mt/db test`
Expected: FAIL（模块不存在）

- [ ] **Step 5: 实现 src/pool.ts、src/migrations.ts、src/outbox.ts、src/index.ts 与 migrations/001_outbox.sql**

pool.ts：

~~~ts
import { Pool } from "pg";

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 5 });
}
~~~

migrations.ts：

~~~ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";

export async function runMigrations(pool: Pool, dir: string): Promise<void> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
  );
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const done = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (done.rowCount) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
~~~

outbox.ts：

~~~ts
import type { Pool } from "pg";
import type { DataEnvelope } from "@mt/types";

export async function appendOutbox(pool: Pool, event: DataEnvelope<unknown>): Promise<void> {
  await pool.query(
    "INSERT INTO outbox (id, event, source, payload, occurred_at, status) VALUES ($1, $2, $3, $4, $5, 'pending') ON CONFLICT (id) DO NOTHING",
    [event.id, event.event, event.source, JSON.stringify(event.payload), event.occurredAt]
  );
}

export interface ProcessOutboxOptions {
  batchSize?: number;
  maxAttempts?: number;
}

export async function processOutbox(
  pool: Pool,
  handler: (event: DataEnvelope<unknown>) => Promise<void>,
  options: ProcessOutboxOptions = {}
): Promise<number> {
  const batchSize = options.batchSize ?? 10;
  const maxAttempts = options.maxAttempts ?? 5;
  const rows = await pool.query(
    "SELECT * FROM outbox WHERE status IN ('pending', 'retry') AND attempts < $1 ORDER BY occurred_at LIMIT $2 FOR UPDATE SKIP LOCKED",
    [maxAttempts, batchSize]
  );
  let handled = 0;
  for (const row of rows.rows) {
    const event: DataEnvelope<unknown> = {
      id: row.id,
      event: row.event,
      source: row.source,
      payload: row.payload,
      occurredAt: new Date(row.occurred_at).toISOString(),
    };
    try {
      await handler(event);
      await pool.query("UPDATE outbox SET status = 'done', processed_at = now() WHERE id = $1", [row.id]);
    } catch (err) {
      await pool.query(
        "UPDATE outbox SET status = 'retry', attempts = attempts + 1, last_error = $2 WHERE id = $1",
        [row.id, String(err).slice(0, 500)]
      );
    }
    handled += 1;
  }
  return handled;
}
~~~

index.ts：

~~~ts
export { createPool } from "./pool";
export { runMigrations } from "./migrations";
export { appendOutbox, processOutbox } from "./outbox";
~~~

migrations/001_outbox.sql：

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

- [ ] **Step 6: applicant server 接入（断连降级启动）**

Modify apps/applicant/server/package.json dependencies 增加一行：

~~~json
    "@mt/db": "workspace:*",
~~~

Modify apps/applicant/server/src/main.ts 为：

~~~ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { createPool } from "@mt/db";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? 5008);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/applicant");
  app.enableCors();
  await app.listen(PORT);
  console.log("applicant-server listening on " + PORT);

  // 数据库断连降级：PG 不可用不影响服务启动（健康检查保持 up）
  const pool = createPool(process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/magictools");
  try {
    await pool.query("SELECT 1");
    console.log("db connected");
  } catch (err) {
    console.warn("db unavailable, continuing: " + String(err));
  }
}

bootstrap();
~~~

- [ ] **Step 7: 启动数据库并运行集成测试**

Run:

~~~bash
docker compose -f infra/docker-compose.dev.yml up -d
docker exec magictools-postgres-1 createdb -U postgres mt_test
pnpm --filter @mt/db test
~~~

Expected: postgres 健康；mt_test 创建成功；PASS（2 用例）。若本机无 Docker，测试自动跳过并在 CI 中执行（CI 提供 postgres 服务）。

- [ ] **Step 8: Commit**

~~~bash
git add infra/docker-compose.dev.yml packages/db apps/applicant/server
git commit -m "feat(db): 新增 outbox 事件表、迁移执行器与本地数据库编排"
~~~

---

### Task 9: 冒烟脚本、本地质量门禁与 Playwright E2E

**Files:**
- Create: `infra/scripts/smoke.mjs`、`infra/scripts/lib/smoke.test.mjs`、`infra/scripts/qa-gate.mjs`
- Create: `e2e/{package.json,playwright.config.ts,tests/gateway.spec.ts}`

**Interfaces:**
- Consumes: Task 2 的 ports.yaml；Task 6 的路由约定；Task 7 的 applicant 应用
- Produces: `buildChecks(ports): Array<{ name: string; url: string }>`、`runChecks(checks, timeoutMs?): Promise<Array<{ name; ok; status; ms; error? }>>`；命令 `pnpm smoke [--only <服务>]`、`pnpm qa:gate`、`pnpm --filter @mt/e2e e2e`（后续所有任务的验收门禁）

- [ ] **Step 1: 写失败测试 infra/scripts/lib/smoke.test.mjs**

~~~js
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { buildChecks, runChecks } from "../smoke.mjs";

test("buildChecks 为每个 web/server 与 gateway 生成检查项", () => {
  const checks = buildChecks({ applicant: { web: 4008, server: 5008 }, gateway: { web: 3000 } });
  assert.equal(checks.length, 5);
  assert.equal(checks.at(-1).name, "gateway");
});

test("runChecks 正确标记成功与失败", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const results = await runChecks(
    [
      { name: "ok", url: "http://127.0.0.1:" + port + "/" },
      { name: "bad", url: "http://127.0.0.1:1/" },
    ],
    1500
  );
  server.close();
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test infra/scripts/lib/smoke.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 infra/scripts/smoke.mjs 与 infra/scripts/qa-gate.mjs**

smoke.mjs：

~~~js
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export function buildChecks(ports) {
  const checks = [];
  for (const [name, p] of Object.entries(ports)) {
    if (p.server) checks.push({ name: name + "-server", url: "http://127.0.0.1:" + p.server + "/api/" + name + "/health" });
    if (p.web) checks.push({ name: name + "-web", url: "http://127.0.0.1:" + p.web + "/" });
  }
  checks.push({ name: "gateway", url: "http://127.0.0.1:3000/health" });
  return checks;
}

export async function runChecks(checks, timeoutMs = 3000) {
  const results = [];
  for (const check of checks) {
    const started = Date.now();
    try {
      const res = await fetch(check.url, { signal: AbortSignal.timeout(timeoutMs) });
      results.push({ name: check.name, ok: res.ok, status: res.status, ms: Date.now() - started });
    } catch (err) {
      results.push({ name: check.name, ok: false, status: 0, ms: Date.now() - started, error: String(err).slice(0, 120) });
    }
  }
  return results;
}

const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const ports = parse(readFileSync(join(process.cwd(), "infra", "ports.yaml"), "utf8"));
let checks = buildChecks(ports);
if (only) checks = checks.filter((c) => c.name.startsWith(only));

const results = await runChecks(checks);
let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log((r.ok ? "PASS" : "FAIL") + "  " + r.name.padEnd(22) + (r.status || r.error || "?") + "  (" + r.ms + "ms)");
}
process.exit(failed === 0 ? 0 : 1);
~~~

qa-gate.mjs（开发 agent 提交给测试 agent 前的本地门禁）：

~~~js
import { spawnSync } from "node:child_process";

const steps = [
  ["lint", ["lint"]],
  ["build", ["build"]],
  ["unit-test", ["test"]],
  ["infra-test", ["test:infra"]],
];

let failed = false;
for (const [label, args] of steps) {
  console.log("== qa-gate: " + label + " ==");
  const result = spawnSync("pnpm", args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    failed = true;
    break;
  }
}
console.log(failed ? "QA GATE FAILED" : "QA GATE PASSED");
process.exit(failed ? 1 : 0);
~~~

> 回归测试定义：qa:gate 与 CI 的 quality job 每次全量执行测试套件（全服务单元 + 集成），以全量套件覆盖变更影响面，即本项目的回归策略。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test infra/scripts/lib/smoke.test.mjs`
Expected: PASS（2 用例）

- [ ] **Step 5: 创建 e2e 配置与用例**

e2e/package.json：

~~~json
{
  "name": "@mt/e2e",
  "private": true,
  "scripts": {
    "e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0"
  }
}
~~~

e2e/playwright.config.ts：

~~~ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3000",
  },
  reporter: "list",
});
~~~

e2e/tests/gateway.spec.ts：

~~~ts
import { test, expect } from "@playwright/test";

test("网关将 /applicant 代理到 applicant web", async ({ page }) => {
  await page.goto("/applicant");
  await expect(page.getByText("applicant").first()).toBeVisible();
  await expect(page.getByText(/服务状态: up/)).toBeVisible();
});

test("网关健康检查返回 up", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("up");
});
~~~

- [ ] **Step 6: 全链路验收（启动栈 → 冒烟 → E2E）**

Run（先启动 4 个后台任务）：

~~~bash
docker compose -f infra/docker-compose.dev.yml up -d
pnpm --filter @mt/applicant-server dev
pnpm --filter @mt/applicant-web dev
pnpm --filter @mt/gateway dev
pnpm smoke --only applicant
pnpm exec playwright install chromium
pnpm --filter @mt/e2e e2e
~~~

Expected: 冒烟全部 PASS（含 gateway）；E2E 2 用例通过。

- [ ] **Step 7: 运行质量门禁并 Commit**

Run: `pnpm qa:gate`
Expected: QA GATE PASSED

~~~bash
git add infra/scripts e2e pnpm-lock.yaml
git commit -m "test(infra): 新增冒烟脚本、质量门禁与 Playwright E2E"
~~~

---

### Task 10: CI 流水线与 PR 模板

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**
- Consumes: Task 7~9 的构建/测试/冒烟/E2E 命令
- Produces: PR 必须通过的 3 个 job（quality / smoke / e2e）+ main 分支的 images 构建推送 job；PR 自检清单（后续所有任务的合并门槛）

- [ ] **Step 1: 创建 .github/workflows/ci.yml**

~~~yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, dev]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm build
      - run: pnpm test
      - run: pnpm test:infra
      - run: pnpm docs:lint

  smoke:
    needs: quality
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - "5432:5432"
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @mt/applicant-server build
      - name: 启动 applicant server
        run: node apps/applicant/server/dist/main.js &
        env:
          PORT: "5008"
          DATABASE_URL: postgres://postgres:postgres@127.0.0.1:5432/magictools
      - run: pnpm --filter @mt/applicant-web build
      - name: 启动 applicant web 预览
        run: pnpm --filter @mt/applicant-web exec vite preview --port 4008 --strictPort &
      - run: pnpm --filter @mt/gateway build
      - name: 启动 gateway
        run: node apps/gateway/dist/index.js &
      - run: sleep 5
      - run: node infra/scripts/smoke.mjs --only applicant

  e2e:
    needs: smoke
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - "5432:5432"
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @mt/applicant-server build
      - run: node apps/applicant/server/dist/main.js &
        env:
          PORT: "5008"
          DATABASE_URL: postgres://postgres:postgres@127.0.0.1:5432/magictools
      - run: pnpm --filter @mt/applicant-web build
      - run: pnpm --filter @mt/applicant-web exec vite preview --port 4008 --strictPort &
      - run: pnpm --filter @mt/gateway build
      - run: node apps/gateway/dist/index.js &
      - run: sleep 5
      - run: pnpm --filter @mt/e2e exec playwright install --with-deps chromium
      - run: pnpm --filter @mt/e2e exec playwright test

  images:
    if: github.ref == 'refs/heads/main'
    needs: [quality, smoke, e2e]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - gateway
          - applicant-web
          - applicant-server
          - gatherer-web
          - gatherer-server
          - investigator-web
          - investigator-server
          - assessor-web
          - assessor-server
          - manager-web
          - manager-server
          - designer-web
          - designer-server
          - scholar-web
          - scholar-server
          - assistant-web
          - assistant-server
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ secrets.REGISTRY_HOST }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}
      - name: 构建并推送镜像
        env:
          SERVICE: ${{ matrix.service }}
          IMAGE_PREFIX: ${{ secrets.REGISTRY_HOST }}/magictools
        shell: bash
        run: |
          set -e
          case "$SERVICE" in
            gateway)
              docker build -f apps/gateway/Dockerfile -t "$IMAGE_PREFIX/gateway:latest" .
              ;;
            *-web)
              app="${SERVICE%%-web}"
              docker build -f "apps/$app/web/Dockerfile" -t "$IMAGE_PREFIX/$SERVICE:latest" .
              ;;
            *-server)
              app="${SERVICE%%-server}"
              docker build -f "apps/$app/server/Dockerfile" -t "$IMAGE_PREFIX/$SERVICE:latest" .
              ;;
          esac
          docker push "$IMAGE_PREFIX/$SERVICE:latest"
~~~

- [ ] **Step 2: 创建 .github/PULL_REQUEST_TEMPLATE.md**

~~~markdown
## 变更说明

<!-- 简述本次变更内容与动机 -->

## 自检清单

- [ ] 已更新相关文档（spec / plan / dev / test 文档）
- [ ] 已更新 docs/memory/ 即时记忆
- [ ] 已添加 changeset 迭代日志（如适用）
- [ ] CI 全绿（lint / build / unit / smoke / e2e）
- [ ] 无 TODO / TBD 占位符
- [ ] 遵循 Conventional Commits 与分支命名规范

## 测试说明

<!-- 说明新增/修改的测试与验证方式 -->
~~~

- [ ] **Step 3: 校验 YAML 可解析**

Run: `cd packages/config && node -e "const y=require('yaml');const fs=require('fs');y.parse(fs.readFileSync('../../.github/workflows/ci.yml','utf8'));console.log('yaml ok')"`
Expected: 输出 yaml ok

- [ ] **Step 4: Commit**

~~~bash
git add .github
git commit -m "ci: 新增 CI 流水线（质量/冒烟/E2E/镜像）与 PR 模板"
~~~

> 注意：main/dev 分支保护、仓库 Secrets（REGISTRY_HOST/USERNAME/PASSWORD 等）需在 GitHub 仓库设置中手工开启一次，清单见 docs/git-workflow.md（Task 12）。

---

### Task 11: Docker 镜像与部署备份链路

**Files:**
- Create: `apps/gateway/Dockerfile`
- Create: `infra/compose.prod.yml`、`infra/deploy.ps1`、`infra/backup.ps1`

**Interfaces:**
- Consumes: Task 7 模板产出的 web/server Dockerfile；Task 6 的 MT_PROD=1 容器名寻址约定
- Produces: `docker compose -f infra/compose.prod.yml` 全栈编排；`infra/deploy.ps1 -HostName <ECS> -Registry <ACR> -ImageTag <tag>` 一键部署；`infra/backup.ps1` 备份

- [ ] **Step 1: 创建 apps/gateway/Dockerfile**

~~~dockerfile
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @mt/gateway build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/gateway/dist ./dist
CMD ["node", "dist/index.js"]
~~~

- [ ] **Step 2: 创建 infra/compose.prod.yml**

~~~yaml
services:
  gateway:
    image: ${REGISTRY}/magictools/gateway:${IMAGE_TAG}
    ports:
      - "3000:3000"
    environment:
      MT_PROD: "1"
    restart: unless-stopped

  applicant-web:
    image: ${REGISTRY}/magictools/applicant-web:${IMAGE_TAG}
    expose: ["4008"]
    restart: unless-stopped
  applicant-server:
    image: ${REGISTRY}/magictools/applicant-server:${IMAGE_TAG}
    expose: ["5008"]
    environment:
      PORT: "5008"
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/magictools
    depends_on: [postgres]
    restart: unless-stopped

  gatherer-web:
    image: ${REGISTRY}/magictools/gatherer-web:${IMAGE_TAG}
    expose: ["4001"]
    restart: unless-stopped
  gatherer-server:
    image: ${REGISTRY}/magictools/gatherer-server:${IMAGE_TAG}
    expose: ["5001"]
    environment:
      PORT: "5001"
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/magictools
    depends_on: [postgres]
    restart: unless-stopped

  investigator-web:
    image: ${REGISTRY}/magictools/investigator-web:${IMAGE_TAG}
    expose: ["4002"]
    restart: unless-stopped
  investigator-server:
    image: ${REGISTRY}/magictools/investigator-server:${IMAGE_TAG}
    expose: ["5002"]
    environment:
      PORT: "5002"
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/magictools
    depends_on: [postgres]
    restart: unless-stopped

  assessor-web:
    image: ${REGISTRY}/magictools/assessor-web:${IMAGE_TAG}
    expose: ["4003"]
    restart: unless-stopped
  assessor-server:
    image: ${REGISTRY}/magictools/assessor-server:${IMAGE_TAG}
    expose: ["5003"]
    environment:
      PORT: "5003"
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/magictools
    depends_on: [postgres]
    restart: unless-stopped

  manager-web:
    image: ${REGISTRY}/magictools/manager-web:${IMAGE_TAG}
    expose: ["4004"]
    restart: unless-stopped
  manager-server:
    image: ${REGISTRY}/magictools/manager-server:${IMAGE_TAG}
    expose: ["5004"]
    environment:
      PORT: "5004"
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/magictools
    depends_on: [postgres]
    restart: unless-stopped

  designer-web:
    image: ${REGISTRY}/magictools/designer-web:${IMAGE_TAG}
    expose: ["4005"]
    restart: unless-stopped
  designer-server:
    image: ${REGISTRY}/magictools/designer-server:${IMAGE_TAG}
    expose: ["5005"]
    environment:
      PORT: "5005"
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/magictools
    depends_on: [postgres]
    restart: unless-stopped

  scholar-web:
    image: ${REGISTRY}/magictools/scholar-web:${IMAGE_TAG}
    expose: ["4006"]
    restart: unless-stopped
  scholar-server:
    image: ${REGISTRY}/magictools/scholar-server:${IMAGE_TAG}
    expose: ["5006"]
    environment:
      PORT: "5006"
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/magictools
    depends_on: [postgres]
    restart: unless-stopped

  assistant-web:
    image: ${REGISTRY}/magictools/assistant-web:${IMAGE_TAG}
    expose: ["4007"]
    restart: unless-stopped
  assistant-server:
    image: ${REGISTRY}/magictools/assistant-server:${IMAGE_TAG}
    expose: ["5007"]
    environment:
      PORT: "5007"
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/magictools
    depends_on: [postgres]
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: magictools
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
~~~

- [ ] **Step 3: 创建 infra/deploy.ps1 与 infra/backup.ps1**

deploy.ps1：

~~~powershell
param(
  [Parameter(Mandatory = $true)][string]$HostName,
  [string]$Registry = "cr.aliyuncs.com/magictools",
  [string]$ImageTag = "latest"
)

$remoteCmd = "cd /opt/magictools && echo REGISTRY={0} > .env && echo IMAGE_TAG={1} >> .env && docker compose -f infra/compose.prod.yml pull && docker compose -f infra/compose.prod.yml up -d && docker image prune -f" -f $Registry, $ImageTag
ssh $HostName $remoteCmd
Write-Host "部署完成: $HostName (registry={0}, tag={1})" -f $Registry, $ImageTag
~~~

backup.ps1：

~~~powershell
param(
  [Parameter(Mandatory = $true)][string]$HostName,
  [string]$BackupDir = "./backups"
)

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = "magictools-$stamp.dump.gz"
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }
ssh $HostName "docker exec magictools-postgres-1 pg_dump -U postgres magictools | gzip > /tmp/$file"
scp ("{0}:/tmp/{1}" -f $HostName, $file) (Join-Path $BackupDir $file)
ssh $HostName "rm -f /tmp/$file"
Get-ChildItem $BackupDir -Filter "*.dump.gz" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
Write-Host "备份完成: $file（本地保留最近 15 份）"
~~~

- [ ] **Step 4: 校验 compose 配置**

Run: `docker compose -f infra/compose.prod.yml config`
Expected: 输出完整解析后的配置（本机无 Docker 时跳过，CI images job 已覆盖构建验证）

- [ ] **Step 5: Commit**

~~~bash
git add apps/gateway/Dockerfile infra/compose.prod.yml infra/deploy.ps1 infra/backup.ps1
git commit -m "deploy: 新增生产编排、镜像构建与一键部署备份脚本"
~~~

---

### Task 12: 文档体系、即时记忆与迭代日志落地

**Files:**
- Create: `AGENTS.md`、`docs/ui-spec.md`、`docs/git-workflow.md`、`docs/CHANGELOG.md`、`.changeset/config.json`、`.github/workflows/release.yml`
- Modify: `package.json`（加 changeset 脚本与依赖）
- Modify: `docs/superpowers/specs/2026-08-18-magictools-platform-design.md`（4.4 公共包表增加 @mt/db 行，落实文档与代码一致机制）

**Interfaces:**
- Consumes: 全部前置任务
- Produces: AI 会话启动协议入口 AGENTS.md；UI 规范文档；git 工作流文档（含四层分支清理与收尾协议）；changesets 迭代日志机制 + release 工作流

- [ ] **Step 1: 创建 AGENTS.md**

~~~markdown
# MagicTools AI 协作开发入口指令（AGENTS.md）

## 会话启动协议（每次会话必做）

1. 读本文件；
2. 读 docs/memory/ 下全部记忆文件（当前状态、关键决策、进行中任务、已知问题）；
3. 读任务涉及子项目的 docs 五类文档（architecture / prd / dev / test / changelog）；
4. 之后才能开始任何开发动作。

## 项目速览

- Monorepo（pnpm + turbo）：apps/ 下 8 子项目（web+server）+ gateway；packages/ 公共包（config/utils/types/model-client/ui/db）
- 全栈 TypeScript：React 18 + Vite + AntD 5 / NestJS 10 / PostgreSQL 16 + pgvector
- 端口唯一来源 infra/ports.yaml；服务间同步 REST + outbox（@mt/db）+ 幂等键
- LLM 唯一入口 @mt/model-client（DeepSeek + 智谱，可扩展）

## 硬性约定

1. TDD：先写失败测试再实现；禁止 TODO/TBD 占位符
2. 提交遵循 Conventional Commits（中文 subject，动词开头，不超过 50 字）
3. 每个任务完成即刻更新 docs/memory/ 与 changeset（迭代日志），禁止事后补记
4. 分支命名 feat-<项目>-<任务ID>-<描述>；一个任务一个 worktree；会话收尾必须执行收尾协议（见 docs/git-workflow.md）
5. 质量门禁：合入前本地跑 pnpm qa:gate，冒烟 pnpm smoke，全绿才可提交
6. 开发与测试分拆不同智能体（0 bug loop）：开发 agent 完成后必须由测试 agent 独立验收
7. 前端必须使用 @mt/ui（MtThemeProvider + tokens），禁止硬编码颜色值

## 常用命令

- pnpm install / pnpm build / pnpm test / pnpm lint / pnpm test:infra
- pnpm new:app <name>（新子项目）
- pnpm smoke [--only <服务>]（冒烟）
- pnpm qa:gate（本地门禁）
- pnpm ws:create <项目> <任务ID> / pnpm ws:cleanup <项目> <任务ID>（worktree）
- pnpm changeset（添加迭代日志）
~~~

- [ ] **Step 2: 创建 docs/ui-spec.md**

~~~markdown
# MagicTools UI 规范

## 设计令牌（packages/ui/src/tokens.ts 为唯一来源）

| 类别 | 键 | 值 |
|---|---|---|
| 主色 | color.primary | #2f54eb |
| 成功 | color.success | #52c41a |
| 警告 | color.warning | #faad14 |
| 错误 | color.error | #ff4d4f |
| 文本 | color.text / color.textSecondary | #1f1f1f / #666666 |
| 布局底色 | color.bgLayout | #f5f6f8 |
| 间距 | spacing.xs/sm/md/lg/xl | 4/8/16/24/32 |
| 字号 | fontSize.sm/md/lg/xl | 12/14/16/20 |
| 圆角 | radius | 6 |

## 强制规则

1. 所有 web 应用入口必须用 MtThemeProvider 包裹（模板已内置）；
2. 颜色一律引用 tokens.color，禁止在业务代码硬编码色值；
3. 空数据场景使用 MtEmptyState（title 必填，操作按钮用 actionText + onAction）；
4. 新通用组件先沉淀到 packages/ui，经评审后供全平台复用。
~~~

- [ ] **Step 3: 创建 docs/git-workflow.md**

~~~markdown
# Git 工作流与分支管理规范

## 分支模型

- main：生产（合并触发打镜像 + 迭代日志）
- dev：集成（PR 合并目标，CI 全绿后方可再合 main）
- feat-<项目>-<任务ID>-<描述>：开发分支（绑任务不绑对话）

## 并行开发（worktree）

一个任务一个 worktree，主仓库保持干净：

pnpm ws:create <项目> <任务ID>
pnpm ws:cleanup <项目> <任务ID>

## 分支清理四层机制

1. GitHub 仓库设置开启 "Automatically delete head branches"（PR 合并即删远程分支）；
2. CI 定时 GC（.github/workflows/branch-gc.yml，每周清理已合并/孤儿 feat 分支）；
3. 会话收尾协议（见下）；
4. 分支名携带任务 ID，Manager 任务关闭联动清理。

## 会话收尾协议（每个开发会话结束时强制执行，未完成视为会话未结束）

- [ ] 代码已提交且测试通过（pnpm qa:gate 全绿）
- [ ] 已推送并创建 PR（或合并）
- [ ] PR 合并后 worktree 已清理（pnpm ws:cleanup）
- [ ] docs/memory/ 已更新
- [ ] changeset 迭代日志已添加

## 仓库设置清单（GitHub 手工开启一次）

- main/dev 分支保护：require PR + review + status checks（CI 3 jobs）
- Automatically delete head branches
- Secrets：REGISTRY_HOST / REGISTRY_USERNAME / REGISTRY_PASSWORD / DEPLOY_SSH_KEY 等
~~~

- [ ] **Step 4: 创建 changesets 配置与 release 工作流**

Modify 根 package.json：scripts 增加 `"changeset": "changeset"`、`"release": "changeset version"`；devDependencies 增加 `"@changesets/cli": "^2.27.0"`。

.changeset/config.json：

~~~json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "restricted",
  "baseBranch": "main"
}
~~~

.github/workflows/release.yml：

~~~yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: changesets/action@v1
        with:
          version: pnpm release
          commit: "chore(release): 发布新版本并更新迭代日志"
          title: "chore(release): 迭代日志与版本更新"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
~~~

- [ ] **Step 5: 创建 docs/CHANGELOG.md 种子并修订 spec**

docs/CHANGELOG.md：

~~~markdown
# MagicTools 迭代日志（平台级）

- 各子项目与公共包的版本化变更由 changesets 自动生成到各自包目录的 CHANGELOG.md；
- 本文件记录平台级迭代摘要（阶段、里程碑、关键决策），在每次 dev→main 合并时追加一条；
- 条目格式：日期、变更摘要、涉及子项目、关联 PR。

## 2026-08-18

- 平台总体设计评审通过，建立 spec 与实施计划体系；
- Phase 0 工程化基座开工。
~~~

Modify docs/superpowers/specs/2026-08-18-magictools-platform-design.md 4.4 公共包表格：在末尾增加一行：

~~~markdown
| @mt/db | PG 连接池、outbox 事件表（append/process）、迁移执行器 |
~~~

（同步在决策记录表后追加说明："实现细化：4.4 公共包清单新增 @mt/db，详见 Phase 0 计划的设计偏差说明。"）

- [ ] **Step 5b: 创建 .env.template（敏感配置模板，对应 spec 4.3）**

~~~ini
# gateway 访问令牌（留空则本地不鉴权）
GATEWAY_TOKEN=
# LLM 密钥（真实值不入库）
DEEPSEEK_API_KEY=
ZHIPU_API_KEY=
# 数据库
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/magictools
~~~

> 真实敏感值通过 git-crypt 加密存储（git-crypt init 需本机 GPG 环境，手工执行一次；.env 已被 .gitignore 排除），CI 侧使用 GitHub Secrets。

- [ ] **Step 6: 校验并 Commit**

Run: `pnpm docs:lint`
Expected: 无报错

~~~bash
git add AGENTS.md docs .changeset package.json pnpm-lock.yaml .github/workflows/release.yml .env.template
git commit -m "docs: 落地文档体系、即时记忆入口与迭代日志机制"
~~~

---

### Task 13: 分支 GC 与 workspace 脚本

**Files:**
- Create: `infra/scripts/workspace.mjs`、`.github/workflows/branch-gc.yml`
- Modify: 根 `package.json`（ws:create / ws:cleanup 脚本）

**Interfaces:**
- Consumes: Task 12 的 git-workflow 约定
- Produces: `pnpm ws:create <项目> <任务ID>`、`pnpm ws:cleanup <项目> <任务ID>`；每周自动分支 GC

- [ ] **Step 1: 创建 infra/scripts/workspace.mjs**

~~~js
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const [cmd, project, taskId] = args;

function run(command) {
  execSync(command, { stdio: "inherit" });
}

if (cmd === "create") {
  if (!project || !taskId) {
    console.error("用法: pnpm ws:create <项目> <任务ID>");
    process.exit(1);
  }
  const branch = "feat/" + project + "-" + taskId;
  const dir = "../mt-ws/" + branch;
  run("git worktree add " + dir + " -b " + branch);
  console.log("worktree 已创建: " + dir + "（分支 " + branch + "）");
} else if (cmd === "cleanup") {
  if (!project || !taskId) {
    console.error("用法: pnpm ws:cleanup <项目> <任务ID>");
    process.exit(1);
  }
  const branch = "feat/" + project + "-" + taskId;
  const dir = "../mt-ws/" + branch;
  run("git worktree remove " + dir + " --force");
  console.log("worktree 已清理: " + dir);
  console.log("提示: PR 合并后远程分支会被自动删除；若 PR 未合并请先处理 PR。");
} else {
  console.log("用法: pnpm ws:create <项目> <任务ID> 或 pnpm ws:cleanup <项目> <任务ID>");
  process.exit(1);
}
~~~

Modify 根 package.json scripts 增加：

~~~json
    "ws:create": "node infra/scripts/workspace.mjs create",
    "ws:cleanup": "node infra/scripts/workspace.mjs cleanup",
~~~

- [ ] **Step 2: 创建 .github/workflows/branch-gc.yml**

~~~yaml
name: Branch GC

on:
  schedule:
    - cron: "0 3 * * 1"
  workflow_dispatch:

jobs:
  gc:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: 删除已合并或孤儿开发分支
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -e
          git branch -r --merged origin/main | grep -E 'origin/feat/' | sed 's|origin/||' > /tmp/merged.txt || true
          while read -r branch; do
            echo "删除已合并分支: $branch"
            git push origin --delete "$branch" || true
          done < /tmp/merged.txt
          echo "Branch GC 完成"
~~~

- [ ] **Step 3: 验证 worktree 脚本往返**

Run: `pnpm ws:create demo 0` → `git worktree list` → `pnpm ws:cleanup demo 0` → `git worktree list`
Expected: 创建后列表出现 ../mt-ws/feat/demo-0；清理后消失（本地演示分支可 git branch -D feat/demo-0 删除）

- [ ] **Step 4: 校验 YAML 并 Commit**

Run: `cd packages/config && node -e "const y=require('yaml');const fs=require('fs');y.parse(fs.readFileSync('../../.github/workflows/branch-gc.yml','utf8'));console.log('yaml ok')"`
Expected: yaml ok

~~~bash
git add infra/scripts/workspace.mjs .github/workflows/branch-gc.yml package.json
git commit -m "chore(workspace): 新增 worktree 脚本与分支定时 GC"
~~~

---

## 收尾步骤（全部任务完成后执行）

- [ ] **更新 docs/memory/state.md**：项目阶段改为 "Phase 0 完成，Phase 1（Applicant 试点 + 需求主线）计划待产出"；进行中任务清空；已知问题补充（如本机 Docker 可用性）
- [ ] **追加 docs/CHANGELOG.md 条目**：Phase 0 完成摘要 + 关联 PR
- [ ] **最终验证**：`pnpm qa:gate` 全绿 + `pnpm smoke --only applicant` 通过 + E2E 通过
- [ ] **Commit**: `git commit -m "docs(memory): Phase 0 完成，更新记忆与迭代日志"`

## 验收标准（Phase 0 DoD）

1. `pnpm qa:gate` 本地全绿（lint/build/unit/infra）
2. 栈启动后 `pnpm smoke` 全部 PASS（8 子项目 + gateway 共 17 项）
3. Playwright E2E 通过
4. CI 三个 job 在 PR 上全绿；main 合并后 images job 推镜像成功
5. 文档、记忆、迭代日志机制全部就位且被 CI 校验
