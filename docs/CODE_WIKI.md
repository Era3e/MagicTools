# MagicTools 代码 Wiki（完整结构化文档）

> 文档版本：v1.1（2026-08-27）· 新增 Mermaid 架构图 × 6 + 交叉引用标记
> 适用代码版本：main 分支 d12386d 及以后
> 维护者：MagicTools AI 协作体系

---

## 📌 文档维护约定与交叉引用

本文档是 **「一站式代码速查 + 架构总览」**，承担的是新人读一个文件即可对项目全貌、API 接口、数据流建立完整印象的功能。
因此与仓库内若干**主文档**存在摘要性重合，约定如下：

| 重合章节 | 对应的主文档（事实来源 / 修改起点） | CODE_WIKI 章节定位 |
|---|---|---|
| §8 前端体系设计 | [docs/ui-spec.md](file:///d:/MagicTools/docs/ui-spec.md) | 速查版：保留规范 + 主题表 + 组件图 |
| §12 Git 工作流 | [docs/git-workflow.md](file:///d:/MagicTools/docs/git-workflow.md) + [AGENTS.md](file:///d:/MagicTools/AGENTS.md) | 速查版：保留分支模型 + worktree + 收尾协议 |
| §16 决策与已知问题 | [docs/memory/state.md](file:///d:/MagicTools/docs/memory/state.md)（即时记忆） | 汇总快照：截止发布日期的精选项 |
| §1 项目概述 + §14 运行方式 | [README.md](file:///d:/MagicTools/README.md) | 速查版 + 扩展细节表 |
| §11.1 常用脚本命令 | [AGENTS.md §硬性约定 §常用命令](file:///d:/MagicTools/AGENTS.md) | 命令表与 Turbo 管道完整版 |
| §17 文档索引 | [README.md §文档导航](file:///d:/MagicTools/README.md) | 更细粒度的章节级索引 |

⚠️ **更新原则**：当内容产生冲突时，一律以左列「主文档」为准；CODE_WIKI 应紧随其后同步更新。若您只改一处，请优先修改主文档并在 CODE_WIKI 做一次增量同步。

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [目录结构详解](#3-目录结构详解)
4. [公共包（packages/）参考](#4-公共包packages参考)
5. [网关 Gateway](#5-网关-gateway)
6. [8 大业务子项目详解](#6-8-大业务子项目详解)
7. [服务间通信与事件契约](#7-服务间通信与事件契约)
8. [前端体系设计](#8-前端体系设计)
9. [后端与数据库体系](#9-后端与数据库体系)
10. [LLM 智能层](#10-llm-智能层)
11. [工程化与 CI/CD](#11-工程化与-cicd)
12. [Git 工作流与分支管理](#12-git-工作流与分支管理)
13. [环境与配置](#13-环境与配置)
14. [项目运行方式](#14-项目运行方式)
15. [依赖关系全景图](#15-依赖关系全景图)
16. [关键决策记录与已知问题](#16-关键决策记录与已知问题)
17. [参考文档索引](#17-参考文档索引)

---

## 1. 项目概述

> 📎 **本节与 [README.md](file:///d:/MagicTools/README.md) 内容重合，为速查摘要版。若子项目列表/技术栈版本变更，请优先修改 README.md，再同步回本节。**

### 1.1 定位

**MagicTools** 是一套面向个人使用的一体化 AI 工作工具平台。由 **8 个业务子项目 + 1 个统一网关 + 6 个公共包** 组成，全栈 TypeScript，覆盖需求主线、知识主线、设计辅助与求职辅助四大场景。

### 1.2 子项目速览

| 子项目 | 代号 | 定位 | 核心能力 |
|---|---|---|---|
| Applicant | 求职 | MVP 试点 | 岗位管理 / JD 解析 / 截图视觉识别 / 面试复盘 / 简历管理（ClawCV 集成） |
| Investigator | 调研 | 需求主线第一环 | 飞书 Bitable 源对接 / LLM 结构化提取 / 调研结果筛选与推送 |
| Assessor | 评审 | 需求主线第二环 | 跨库消费调研数据 / GitHub 仓库上下文 / LLM 需求分析+设计方案 / 五状态审核流 |
| Manager | 管理 | 需求主线核心 | 需求 7 态生命周期 / 迭代管理 / PR 状态联动 / Phantom 外部需求接入 |
| Gatherer | 采集 | 知识主线第一环 | RSS / JSON / 网页选择器三类采集 / Cron 调度 / LLM 富化 / 去重推送 |
| Scholar | 知识 | 知识主线第二环 | 三来源条目（gatherer/manual/obsidian）/ 全文+向量双通道检索 / 知识图谱 / 圈定 |
| Assistant | 助手 | 知识主线闭环 | 6 类意图路由 / 圈定内容问答 / cybercloud 数据查询 / 故障排查 / 反馈闭环 |
| Designer | 设计 | 辅助工具（降级版） | 自然语言/图片 → LLM 生成 @mt/ui 组件 → esbuild 沙箱预览 → 组件沉淀 |

### 1.3 技术栈

| 层 | 选型 | 版本要求 |
|---|---|---|
| 前端 | React 18 + TypeScript + Vite + Ant Design 5 | React ^18.3, TypeScript ^5.5 |
| 后端 | NestJS 10 + TypeScript + Express | Node.js >= 20 |
| 数据库 | PostgreSQL 16 + pgvector + 全文检索 FTS | pgvector/pgvector:pg16 |
| 仓库管理 | pnpm workspace + Turborepo 2 | pnpm 9.12.0 |
| LLM | @mt/model-client 统一抽象（OpenAI 兼容协议） | DeepSeek + 智谱双供应商 |
| 测试 | Vitest 2（单元/集成/覆盖率）+ Playwright（E2E） | Vitest ^2, Coverage @vitest/coverage-v8 |
| CI/CD | GitHub Actions | — |
| 部署 | Docker + Docker Compose + 单台阿里云 ECS | — |

---

## 2. 整体架构

### 2.1 架构分层图

```
┌─────────────────────────────────────────────────────────────────┐
│                        外部访问层                                │
│                  浏览器 / HTTP API 客户端                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Gateway (端口 3000)                        │
│  · 路径路由  · X-Access-Token 鉴权  · 健康检查聚合  · 首页导航   │
│  · /<name>/ → Web (Vite preview / Nginx)                        │
│  · /api/<name>/ → Server (NestJS)                                │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Applicant  │ │ Gatherer   │ │ Investigator││ Designer   │
│ 4008/5008  │ │ 4001/5001  │ │ 4002/5002   │ │ 4005/5005  │
└─────┬──────┘ └─────┬──────┘ └──────┬───────┘ └────────────┘
      │              │               │
      │              ▼               ▼
      │        ┌────────────┐  ┌────────────┐
      │        │ Scholar    │  │ Assessor   │
      │        │ 4006/5006  │  │ 4003/5003  │
      │        └─────┬──────┘  └──────┬───────┘
      │              │               │
      │              ▼               ▼
      │        ┌────────────┐  ┌────────────┐
      │        │ Assistant  │  │ Manager    │
      │        │ 4007/5007  │  │ 4004/5004  │
      │        └────────────┘  └────────────┘
      │
      └─────────────────────────────────────────── 独立闭环
```

#### 2.1.1 系统分层架构图（Mermaid）

```mermaid
graph TB
    classDef ext fill:#eef4ff,stroke:#4c7dff,stroke-width:2px,color:#1f1f1f
    classDef gw fill:#fff4e6,stroke:#faad14,stroke-width:2px,color:#1f1f1f
    classDef web fill:#f6ffed,stroke:#52c41a,stroke-width:1px,color:#1f1f1f
    classDef srv fill:#f0f5ff,stroke:#2f54eb,stroke-width:1px,color:#1f1f1f
    classDef db fill:#fff0f6,stroke:#eb2f96,stroke-width:1px,color:#1f1f1f
    classDef pkg fill:#fafafa,stroke:#8c8c8c,stroke-dasharray:5 5,color:#1f1f1f

    User([🧑‍💻 浏览器 / HTTP 客户端]):::ext -->|HTTP :3000| G[Gateway<br/>鉴权·路由·首页]:::gw

    subgraph Web 层 [🌐 前端 · Vite + React + AntD]
        direction LR
        AW[applicant<br/>4008]:::web
        GW2[gatherer<br/>4001]:::web
        IW[investigator<br/>4002]:::web
        EW[assessor<br/>4003]:::web
        MW[manager<br/>4004]:::web
        DW[designer<br/>4005]:::web
        SW[scholar<br/>4006]:::web
        CW[assistant<br/>4007]:::web
    end

    subgraph Server 层 [⚙️ 后端 · NestJS 10]
        direction LR
        AS[applicant-srv<br/>5008]:::srv
        GS[gatherer-srv<br/>5001]:::srv
        IS[investigator-srv<br/>5002]:::srv
        ES[assessor-srv<br/>5003]:::srv
        MS[manager-srv<br/>5004]:::srv
        DS[designer-srv<br/>5005]:::srv
        SS[scholar-srv<br/>5006]:::srv
        CS[assistant-srv<br/>5007]:::srv
    end

    subgraph DB 层 [💾 PostgreSQL 16 + pgvector · 单实例多库]
        direction LR
        ADB[(applicant DB)]:::db
        GDB[(gatherer DB)]:::db
        IDB[(investigator DB)]:::db
        EDB[(assessor DB)]:::db
        MDB[(manager DB)]:::db
        DDB[(designer DB)]:::db
        SDB[(scholar DB)]:::db
        CDB[(assistant DB)]:::db
    end

    subgraph 公共包 packages/ [📦 公共能力 · 6 包]
        direction TB
        CFG[@mt/config]:::pkg
        TYP[@mt/types]:::pkg
        UTL[@mt/utils]:::pkg
        DB_PKG[@mt/db · outbox]:::pkg
        LLM[@mt/model-client · 双供应商]:::pkg
        UI[@mt/ui · 三外壳]:::pkg
    end

    %% 网关 → Web
    G -->|/<name>/ 反代| AW & GW2 & IW & EW & MW & DW & SW & CW
    %% 网关 → Server
    G -->|/api/<name>/ 反代| AS & GS & IS & ES & MS & DS & SS & CS

    %% Web → 同项目 Server
    AW -->|REST /api/applicant| AS
    GW2 -->|REST /api/gatherer| GS
    IW -->|REST /api/investigator| IS
    EW -->|REST /api/assessor| ES
    MW -->|REST /api/manager| MS
    DW -->|REST /api/designer| DS
    SW -->|REST /api/scholar| SS
    CW -->|REST /api/assistant| CS

    %% Server → 对应 DB
    AS --> ADB
    GS --> GDB
    IS --> IDB
    ES --> EDB
    MS --> MDB
    DS --> DDB
    SS --> SDB
    CS --> CDB

    %% 跨库 outbox 事件流（需求主线）
    IDB == outbox researcher.response.push ==> ES
    EDB == outbox requirement.created ==> MS

    %% 跨库 outbox 事件流（知识主线）
    GDB == outbox knowledge.item.collected ==> SS
    SDB == REST / 直连 圈定检索 ==> CS

    %% Server 消费公共包
    AS & GS & IS & ES & MS & DS & SS & CS --> CFG
    AS & GS & IS & ES & MS & DS & SS & CS --> TYP
    AS & GS & IS & ES & MS & DS & SS & CS --> UTL
    AS & GS & IS & ES & MS & DS & SS & CS --> DB_PKG
    AS & GS & IS & ES & MS & DS & SS & CS --> LLM

    %% Web 消费 @mt/ui
    AW & GW2 & IW & EW & MW & DW & SW & CW --> UI
```

### 2.2 数据流主线

```
【需求主线】
飞书问卷 → Bitable → Investigator(拉取+结构化)
  └─ outbox: researcher.response.push ──▶ Assessor(分析+设计+审核)
    └─ outbox: requirement.created ──▶ Manager(生命周期+PR联动)

【知识主线】
信息源(RSS/JSON/网页) → Gatherer(采集+LLM富化+去重)
  └─ outbox: knowledge.item.collected ──▶ Scholar(收件箱+检索+图谱+圈定)
    └─ REST / DB 直连 ──▶ Assistant(圈定问答 + 6 意图路由)

【独立闭环】
Applicant: 岗位/JD/面试/简历 自闭环（ClawCV 外部集成）
Designer: 组件生成/预览/沉淀 自闭环（esbuild 沙箱）
```

### 2.3 架构原则

1. **边界清晰**：每子项目 = 独立 `web + server` + 独立 PostgreSQL 数据库（单实例多库隔离）
2. **唯一入口**：所有外部访问经 gateway 路由，端口唯一来源 [infra/ports.yaml](file:///d:/MagicTools/infra/ports.yaml)
3. **服务间通信**：同步 REST + outbox 事件表（失败重试 + dead 终态）+ 幂等键
4. **公共能力下沉**：`packages/` 6 个公共包统一复用，子项目禁止重复实现
5. **前后台分离**：前端信息架构走「前台各异、后台统一」双外壳
6. **可测试可观测**：全服务健康检查 + 四层测试 + CI 全绿门禁

---

## 3. 目录结构详解

```
MagicTools/
├─ apps/                                    # 8 子项目 + gateway
│  ├─ gateway/                              # 统一网关（Express + http-proxy-middleware）
│  │  └─ src/
│  │     ├─ app.ts                          # createGateway() 鉴权+路由+首页
│  │     ├─ routes.ts                       # buildRoutes() 从 ports.yaml 生成
│  │     └─ index.ts                        # 启动入口
│  │
│  ├─ <app-name>/                           # 8 子项目（applicant/gatherer/investigator/assessor/manager/scholar/assistant/designer）
│  │  ├─ server/                            # NestJS 后端
│  │  │  ├─ migrations/                     # SQL 迁移脚本（001_*.sql 命名排序）
│  │  │  ├─ src/
│  │  │  │  ├─ main.ts                      # NestFactory bootstrap，端口+迁移+outbox 轮询
│  │  │  │  ├─ app.module.ts                # 根模块：controllers + providers 注册
│  │  │  │  ├─ db.ts                        # 数据库自举：createPool + runMigrations
│  │  │  │  ├─ schemas.ts                   # Zod schema（请求参数/响应 DTO 校验）
│  │  │  │  ├─ health.controller.ts         # /health 健康检查（通用）
│  │  │  │  ├─ <domain>.controller.ts       # 领域 Controller：路由定义
│  │  │  │  ├─ <domain>.service.ts          # 领域 Service：业务逻辑
│  │  │  │  ├─ <domain>.repo.ts             # 领域 Repo：数据库 CRUD
│  │  │  │  ├─ llm.ts                       # LLM 调用封装（统一 createModelClient + parseJson）
│  │  │  │  └─ <integration>/               # 外部集成子目录（feishu/github/clawcv/cybercloud）
│  │  │  ├─ Dockerfile                      # 多阶段：build → production
│  │  │  ├─ package.json                    # @mt/<name>-server
│  │  │  ├─ tsconfig.json                   # 继承 tsconfig.base.json
│  │  │  └─ vitest.config.ts                # 测试配置
│  │  │
│  │  └─ web/                               # Vite + React 前端
│  │     ├─ src/
│  │     │  ├─ main.tsx                     # 入口：MtThemeProvider + BrowserRouter
│  │     │  ├─ App.tsx                      # 根组件：Shell 选择（UserShell/AdminShell/AppShell）+ 路由表
│  │     │  ├─ api.ts                       # fetch 封装，base = /api/<name>
│  │     │  ├─ pages/                       # 页面组件（前后台分路由）
│  │     │  ├─ components/                  # 项目内复用组件
│  │     │  ├─ test-setup.ts                # Vitest + jsdom + testing-library
│  │     │  └─ status.ts                    # 枚举/标签映射（applicant 特有）
│  │     ├─ Dockerfile                      # 构建 → Nginx 托管静态资源
│  │     ├─ nginx.conf                      # SPA fallback + gzip
│  │     ├─ index.html                      # Vite 入口 HTML
│  │     ├─ vite.config.ts                  # base = "/<name>/"（与 gateway 路由对齐）
│  │     ├─ package.json                    # @mt/<name>-web
│  │     └─ tsconfig.json
│  │
├─ packages/                                 # 6 个公共包（全部 workspace:* 引用）
│  ├─ config/    @mt/config                 # 配置加载：.env 根目录查找 + YAML + Zod 校验
│  ├─ types/     @mt/types                  # 共享类型：ProjectId / DataEnvelope / ApiResponse
│  ├─ utils/     @mt/utils                  # 通用工具：幂等键 / 内容指纹 / 日期格式化
│  ├─ db/        @mt/db                     # 数据库：Pool / outbox 事件表 / 迁移执行器
│  ├─ model-client/ @mt/model-client        # LLM：双供应商 + chat/embed + 流式 + 容错 parseJson
│  └─ ui/        @mt/ui                     # 前端：设计令牌 + 三外壳 + 空态组件 + 应用注册表
│
├─ docs/                                     # 文档体系（见 17 节索引）
│  ├─ AGENTS.md                              # ✅ AI 入口指令（会话启动必读）
│  ├─ CHANGELOG.md                           # 平台级迭代日志
│  ├─ ui-spec.md                             # UI 规范（令牌 + 双外壳 + 主题表）
│  ├─ git-workflow.md                        # Git 工作流 + 分支管理
│  ├─ integrations/                          # 外部集成手册（feishu/clawcv/cybercloud）
│  ├─ memory/state.md                        # ✅ AI 即时记忆（当前状态 + 决策 + 进行中 + 已知问题）
│  └─ superpowers/
│     ├─ specs/                              # 设计文档（11 份：平台 + 各子项目 + 意图/路由）
│     └─ plans/                              # 实施计划（10 份，与 specs 对应）
│
├─ infra/                                    # 基础设施
│  ├─ ports.yaml                             # ✅ 端口唯一注册表（9 服务 web+server）
│  ├─ docker-compose.dev.yml                 # 本地 PostgreSQL + pgvector 容器
│  ├─ compose.prod.yml                       # 生产环境编排（待补全）
│  ├─ postgres-init.sql                      # 多库自举初始化脚本
│  ├─ deploy.ps1                             # ECS 部署脚本（PowerShell）
│  ├─ backup.ps1                             # 数据库备份脚本
│  ├─ templates/                             # pnpm new:app 模板（server + web 骨架）
│  └─ scripts/                               # 工程化脚本（全部 .mjs ESM）
│     ├─ smoke.mjs                           # 冒烟：读取 ports.yaml 探活全部服务
│     ├─ qa-gate.mjs                         # （预留，当前 package.json 直接拼命令）
│     ├─ new-app.mjs                         # 新建子项目：复制模板 + 分配端口 + 写 ports.yaml
│     ├─ workspace.mjs                       # worktree：ws:create / ws:cleanup
│     └─ lib/
│        ├─ ports.mjs                        # nextFree / allocPorts（new-app 用）
│        ├─ ports.test.mjs                   #
│        └─ smoke.test.mjs                   #
│
├─ e2e/                                      # Playwright 端到端测试（11 个 spec）
│  ├─ tests/
│  │  ├─ gateway.spec.ts
│  │  ├─ applicant.spec.ts ~ designer.spec.ts  # 8 子项目各 1 份
│  │  ├─ assistant.spec.ts / assistant-intents.spec.ts / assistant-routing.spec.ts
│  ├─ playwright.config.ts
│  └─ package.json                           # @mt/e2e
│
├─ .github/
│  ├─ workflows/
│  │  ├─ ci.yml                              # CI 4 Job：quality → smoke → e2e → images(main 才触发)
│  │  ├─ release.yml                         # changesets 版本发布
│  │  └─ branch-gc.yml                       # 定时分支清理
│  └─ PULL_REQUEST_TEMPLATE.md               # PR 模板：文档/日志/测试 勾选清单
│
├─ .changeset/                               # Changesets 迭代日志（16 份变更记录）
├─ .env.template                             # 环境变量模板（22 项配置）
├─ package.json                              # 根包：pnpm 9.12.0 + turbo 脚本
├─ pnpm-workspace.yaml                       # Workspace：apps/*/* + packages/* + e2e
├─ turbo.json                                # Turbo 任务管道：build/test/coverage/lint/dev
├─ tsconfig.base.json                        # TypeScript 基础配置（strict 全开）
├─ eslint.config.mjs                         # ESLint：typescript-eslint + react-hooks
└─ README.md                                 # 项目说明（精简版）
```

---

## 4. 公共包（packages/）参考

### 4.1 @mt/config — 配置加载器

- **包路径**：[packages/config](file:///d:/MagicTools/packages/config)
- **依赖**：yaml ^2.5, zod ^3.23, dotenv ^16.4
- **版本**：0.0.0

#### 关键函数

| 函数 | 签名 | 说明 |
|---|---|---|
| `findRootEnvFile` | `(startDir: string) => string \| null` | 从 startDir 向上最多 10 层查找仓库根 `.env` |
| `loadRootEnv` | `(startDir?: string) => void` | 找到 .env 后调用 dotenv.config() 注入 process.env；找不到静默 |
| `loadYamlFile` | `(path: string) => unknown` | 同步读取 YAML 文件并 parse（用于 ports.yaml） |
| `resolveEnvOverrides` | `(base, prefix: string) => Record` | 用 `process.env` 中前缀匹配的键覆盖 base 对象 |
| `validateConfig` | `<T>(schema: ZodType, value) => z.infer<T>` | Zod schema 校验，失败抛错（含字段错误信息） |

#### 使用模式

子项目 server `main.ts` 启动时第一行调用：

```ts
import { loadRootEnv } from "@mt/config";
loadRootEnv();
```

保证 `pnpm --filter xxx dev` 在子目录执行时仍能读到仓库根的 .env。

---

### 4.2 @mt/types — 跨前后端共享类型

- **包路径**：[packages/types](file:///d:/MagicTools/packages/types)
- **无外部依赖**

#### 关键类型与常量

```ts
// 8 子项目 ID 枚举（PROJECT_IDS 为 const 数组，ProjectId 为推导联合类型）
export const PROJECT_IDS = ["gatherer","investigator","assessor","manager","designer","scholar","assistant","applicant"] as const;
export type ProjectId = typeof PROJECT_IDS[number];

// outbox 事件通用信封（跨子项目数据契约）
export interface DataEnvelope<T> {
  id: string;          // 幂等键（@mt/utils idempotencyKey 生成）
  event: string;       // 事件名：见第 7 节事件契约
  source: ProjectId;   // 产生事件的子项目
  payload: T;          // 事件负载（各事件类型化定义）
  occurredAt: string;  // ISO 时间戳
}

// API 响应通用包裹
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
```

---

### 4.3 @mt/utils — 通用工具

- **包路径**：[packages/utils](file:///d:/MagicTools/packages/utils)
- **无外部依赖**

#### 关键函数

| 函数 | 签名 | 说明 |
|---|---|---|
| `idempotencyKey` | `(prefix: string) => string` | 生成 `"<prefix>-<UUID>"` 格式幂等键，用于 outbox 事件 |
| `contentFingerprint` | `(text: string) => string` | SHA-256 取前 32 位十六进制，用于 gatherer 去重 |
| `formatDate` | `(d: Date) => string` | ISO 日期 YYYY-MM-DD 格式 |

---

### 4.4 @mt/db — 数据库核心

- **包路径**：[packages/db](file:///d:/MagicTools/packages/db)
- **依赖**：pg ^8.12, @mt/types (workspace:*)
- **内置迁移**：migrations/001_outbox.sql

#### 关键函数

| 函数 | 所在文件 | 签名 | 说明 |
|---|---|---|---|
| `createPool` | [pool.ts](file:///d:/MagicTools/packages/db/src/pool.ts) | `(connectionString: string) => Pool` | 创建 PG 连接池（max=5），单例由子项目 db.ts 持有 |
| `runMigrations` | [migrations.ts](file:///d:/MagicTools/packages/db/src/migrations.ts) | `(pool: Pool, dir: string) => Promise<void>` | 读取 dir 下 `*.sql` 按文件名升序执行，`schema_migrations` 表去重，事务包裹单文件，失败回滚 |
| `appendOutbox` | [outbox.ts](file:///d:/MagicTools/packages/db/src/outbox.ts) | `(pool, event: DataEnvelope) => Promise<void>` | 向 outbox 表插入事件，`ON CONFLICT (id) DO NOTHING` 实现幂等 |
| `processOutbox` | [outbox.ts](file:///d:/MagicTools/packages/db/src/outbox.ts) | `(pool, handler, options?) => Promise<number>` | 批处理 pending/retry 事件（`FOR UPDATE SKIP LOCKED` 锁），成功 → done，失败 → 次数+1；达到 maxAttempts（默认 5）→ **dead 终态**（防止无限重试），返回处理数 |

#### outbox 表结构（001_outbox.sql）

| 列 | 类型 | 说明 |
|---|---|---|
| id | text PK | 幂等键 |
| event | text NOT NULL | 事件名 |
| source | text NOT NULL | 来源子项目 |
| payload | jsonb NOT NULL | 数据负载 |
| occurred_at | timestamptz NOT NULL | 发生时间 |
| status | text NOT NULL | pending / retry / done / dead |
| attempts | integer DEFAULT 0 | 已尝试次数 |
| last_error | text | 最近错误信息（最多 500 字符） |
| processed_at | timestamptz | 处理完成时间 |
| 索引 | idx_outbox_pending(status, attempts, occurred_at) | 加速待处理查询 |

#### outbox 事件生命周期状态机图（Mermaid）

```mermaid
stateDiagram-v2
    direction LR
    [*] --> pending : appendOutbox()\nON CONFLICT DO NOTHING
    pending --> processing : processOutbox() 5s 轮询\nFOR UPDATE SKIP LOCKED 取批
    retry --> processing : 同 pending 一起被取到
    processing --> done : handler() 成功\nUPDATE status=done + processed_at=now()
    processing --> retry : handler() 抛错\nattempts < maxAttempts(默认 5)\nUPDATE status=retry + attempts++ + last_error
    processing --> dead : handler() 抛错\nattempts >= maxAttempts\n进入终态防止无限重试
    done --> [*] : 消费完成
    dead --> [*] : ❌ 死信（需人工介入排查）

    note left of pending
      索引 idx_outbox_pending(status,attempts,occurred_at)
      加速查询 pending + retry 两类
    end note
    note right of dead
      设计决策：status 为 text 列（无 ENUM 约束）
      无需迁移即可追加新状态
    end note
```

---

### 4.5 @mt/model-client — LLM 统一抽象层

- **包路径**：[packages/model-client](file:///d:/MagicTools/packages/model-client)
- **无运行时外部依赖**（纯 fetch API）

#### 4.5.1 核心接口 ModelClient

```ts
export interface ModelClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<{ content: string; usage: UsageLog }>;
  embed(texts: string[]): Promise<number[][]>;
}
```

#### 4.5.2 内置供应商

| 常量 | name | baseUrl | 默认模型 | 视觉模型 | Embedding 模型 |
|---|---|---|---|---|---|
| `DEEPSEEK` | deepseek | api.deepseek.com/v1 | deepseek-chat | — | — |
| `ZHIPU` | zhipu | open.bigmodel.cn/api/paas/v4 | glm-4-flash | glm-4v-flash | embedding-2 |

> 供应商通过 `ModelProviderConfig` 注册，可扩展任意 OpenAI 兼容协议服务。

#### 4.5.3 关键函数

| 函数 | 签名 | 说明 |
|---|---|---|
| `createModelClient` | `(provider, logUsage?) => ModelClient` | 创建客户端；chat 含 3 次重试（429/5xx 指数退避 500ms/1s），可 stream |
| `chatStream` | `async generator (provider, messages, options?, logUsage?)` | SSE 流式逐 token yield，SSE 结束时回调 logUsage |
| **`parseJson`** | `(raw: string) => unknown` | **⭐ LLM 输出容错 JSON 解析（禁止子项目裸 JSON.parse）**：4 级降级 — ① quoteKeys 补引号 → ② 剥离 `` ```json `` ``` 代码围栏 → ③ 正则提取首个 `{...}` 块 → ④ 抛错。兼容无引号键、夹杂文字、代码围栏等常见 LLM 脏输出 |

#### 4.5.4 类型定义

```ts
ChatMessage = { role: "system"|"user"|"assistant", content: string | ContentPart[] }
// ContentPart 支持多模态：{ type:"text", text } | { type:"image_url", image_url:{url} }

ChatOptions = { model?, temperature? (默认 0.3), maxTokens? (默认 2048), stream?, vision? }

UsageLog = { provider, model, inputTokens, outputTokens, ms }
```

---

### 4.6 @mt/ui — 前端设计系统

- **包路径**：[packages/ui](file:///d:/MagicTools/packages/ui)
- **peer 依赖**：React 18, AntD 5（无直接依赖，由子项目 web 提供）

#### 4.6.1 设计令牌 tokens

文件：[tokens.ts](file:///d:/MagicTools/packages/ui/src/tokens.ts) — **颜色唯一来源，禁止硬编码色值**

| 类别 | 键 | 值 |
|---|---|---|
| 主色/成功/警告/错误 | primary / success / warning / error | #2f54eb / #52c41a / #faad14 / #ff4d4f |
| 文本 | text / textSecondary | #1f1f1f / #666666 |
| 背景 | bgLayout / bgContainer / bgNeutral / bgActive / bgUser | #f5f6f8 / #fff / #f6f6f6 / #f0f5ff / #e6f4ff |
| 边框/强调 | border / purple / cyan | #f0f0f0 / #722ed1 / #13c2c2 |
| 间距 | xs/sm/md/lg/xl | 4/8/16/24/32 |
| 字号 | sm/md/lg/xl | 12/14/16/20 |
| 圆角 | radius | 6 |

#### 4.6.2 主题提供者

```tsx
// main.tsx 最外层必须包裹
<MtThemeProvider>
  <BrowserRouter basename="/<name>">
    <App />
  </BrowserRouter>
</MtThemeProvider>
```

内部将 tokens 注入 AntD `ConfigProvider`（colorPrimary/borderRadius/fontSize 等）。

#### 4.6.3 三外壳体系

| 外壳 | 组件 | 设计语言 | 适用场景 |
|---|---|---|---|
| **用户前台** | `UserShell` | 每应用独立主题，默认杂志风 | 终端用户消费型页面（浏览/阅读/对话） |
| **配置后台** | `AdminShell` | 全平台统一控制台风（深色侧栏 #1c1f26 + 蓝 accent #4c7dff） | 管理员增删改查/配置页面 |
| **过渡外壳** | `AppShell` | 侧栏 + 顶栏 + 跨应用切换（默认 tokens） | 单一形态无前后台之分的应用 |

#### UserShell 核心 Props

```ts
interface UserShellProps {
  title: string; subtitle?: string;
  navItems: UserNavItem[]; selectedKey: string;
  onNavigate: (key) => void;
  adminPath?: string; adminLabel?: string;  // 页脚「去后台」入口
  footerNote?: string;                       // 个性化页脚文字
  theme?: UserShellTheme;                    // 主题定制（6 字段）
  children: ReactNode;
}
// 默认主题 MAGAZINE_THEME：Georgia/Noto Serif SC + 暖纸 #f8f5ef + 砖红 #b4532a
```

#### AdminShell 核心 Props

```ts
interface AdminShellProps {
  title: string; navItems: AdminNavItem[]; selectedKey: string;
  onNavigate: (key) => void;
  frontPath?: string; frontLabel?: string;  // 侧栏底部「返回前台」（无前台形态 omit）
  children: ReactNode;
}
```

#### 4.6.4 应用注册表 APPS

```ts
// 外壳顶栏「切换应用」下拉数据源
export const APPS: AppEntry[] = [
  { key:"applicant", label:"求职",    path:"/applicant" },
  { key:"investigator", label:"调研", path:"/investigator" },
  { key:"assessor", label:"评审",     path:"/assessor" },
  { key:"manager", label:"管理",      path:"/manager" },
  { key:"gatherer", label:"采集",     path:"/gatherer" },
  { key:"scholar", label:"知识",      path:"/scholar" },
  { key:"assistant", label:"助手",    path:"/assistant" },
  { key:"designer", label:"设计",     path:"/designer" },
];
```

#### 4.6.5 空态组件

```tsx
<MtEmptyState title="暂无数据" description="可以通过右上角按钮添加第一条" actionText="新建" onAction={() => openModal()} />
```

> 空数据场景强制使用，禁止页面空空白白。

---

## 5. 网关 Gateway

- **路径**：[apps/gateway](file:///d:/MagicTools/apps/gateway)
- **端口**：3000（唯一对外入口）
- **技术**：Express 4 + http-proxy-middleware

### 5.1 核心函数

#### `createGateway(ports: PortsConfig, env?)` → Express App

文件：[app.ts](file:///d:/MagicTools/apps/gateway/src/app.ts)

**执行流程：**

1. **鉴权中间件**：若 env.GATEWAY_TOKEN 非空，校验请求头 `X-Access-Token`，不一致返回 401；留空 = 本地不鉴权
2. **路由生成**：调用 `buildRoutes(ports, host)` 从 ports.yaml 生成所有代理路由
3. **Web 尾斜杠补全**：精确匹配 `/<name>` 时 302 重定向到 `/<name>/`
4. **反向代理**：`createProxyMiddleware` 带 pathFilter，Web 走 `"/"+name` → web 容器 Vite/Nginx；API 走 `"/api/"+name` → NestJS server
5. **`GET /health`**：返回 `{ status:"up", service:"gateway" }`
6. **`GET /` 首页**：生成卡片式应用导航页（APP_META 提供 8 应用标题+简介），替代纯反代的 Cannot GET /

#### `buildRoutes(ports, host)` → ProxyRoute[]

文件：[routes.ts](file:///d:/MagicTools/apps/gateway/src/routes.ts)

对 ports 中除 gateway 外的每个服务：
- 有 web 端口 → 生成 `{ name, path:"/<name>", target:"http://<host>:<webPort>" }`
- 有 server 端口 → 生成 `{ name, path:"/api/<name>", target:"http://<host>:<serverPort>" }`

`host(name)` 函数：env.MT_PROD === "1" 时返回 name（Docker Compose 服务名解析），否则返回 127.0.0.1（本地直连）。

### 5.2 路由表（示例）

| 网关路径 | 代理目标（本地） | 说明 |
|---|---|---|
| `/applicant/*` | http://127.0.0.1:4008/applicant/* | 求职 Web（Vite build + Nginx） |
| `/api/applicant/*` | http://127.0.0.1:5008/api/applicant/* | 求职 Server API |
| `/scholar/*` | http://127.0.0.1:4006/scholar/* | 知识 Web |
| ...（8 服务 × 2 共 16 条） | | |

---

## 6. 8 大业务子项目详解

### 6.1 Applicant（求职·独立闭环试点）

**端口**：Web 4008 / Server 5008
**主题**：MAGAZINE_THEME（杂志风 — 衬线、暖纸 #f8f5ef、砖红 #b4532a）

#### 后端模块（AppModule）

| 层 | Controller | Service | Repo | 核心职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | /health 探活 |
| 岗位 | PositionController | PositionService | PositionRepo | CRUD / JD 文本解析 / 截图视觉识别 / 投递话术生成 |
| 面试 | InterviewController | InterviewService | InterviewRepo | 记录 / LLM 分析（问题清单+改进建议+行动项）/ Markdown 导出 |
| 简历 | ResumeController | ResumeService | ResumeRepo | ClawCV analyze/rewrite/match + 无 Key 降级为 LLM |

**外部集成**：`clawcv/` 子目录 — client.ts（HTTP 调用 API）+ fallback.ts（API 失败或无 Key 时 LLM 替代）

**关键路由**：
- `POST /api/applicant/positions` — 创建岗位（含 JD parse）
- `POST /api/applicant/positions/upload-image` — 截图上传 → 视觉 LLM 提取 JD
- `POST /api/applicant/positions/:id/interviews` — 添加面试记录 + LLM 复盘
- `POST /api/applicant/resumes/analyze` / `rewrite` / `match` — 简历三件套

#### 前端路由

```
前台（UserShell /applicant）：
  /positions           PositionWall    岗位博览墙（杂志风检索+分页）
  /positions/:id       PositionDetail  机会档案（FEATURE 特稿版式）
  /positions/:id/interviews InterviewPage  面试复盘（DEBRIEF 对开双栏）
  /resumes             ResumeCenter    简历工坊（WORKSHOP 改写台）

后台（AdminShell /applicant/admin）：
  /admin/positions     PositionList    岗位管理表格（CRUD）
```

---

### 6.2 Investigator（调研·需求主线第一环）

**端口**：Web 4002 / Server 5002
**主题**：ARCHIVE_THEME（档案风 — Courier / 牛皮纸 / 铜金）
**前台形态**：仅报头展示，默认直跳后台

#### 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 调研 | SurveyController | SurveyService | SurveyRepo + ResponseRepo | 飞书 Bitable 源配置/字段映射、定时/手动拉取、LLM 结构化、筛选推送 Assessor |

**外部集成**：`feishu/client.ts` — 令牌缓存 + 分页 + 归一化读取多维表格记录，支持 FEISHU_STUB=1 桩

**推送事件**：`researcher.response.push`（appendOutbox 单条记录一封）

#### 前端路由

```
前台（直跳后台）
后台（AdminShell /investigator/admin）：
  /admin/surveys       SurveyList    调研主题列表（含「编辑」列）
  /admin/surveys/:id   SurveyDetail  结果查看 + 推送 Assessor（操作闭环 D1）
```

---

### 6.3 Assessor（评审·需求主线第二环）

**端口**：Web 4003 / Server 5003
**主题**：BRIEF_THEME（文书风 — Georgia / 暖白 / 深赭）
**前台形态**：仅报头展示，默认直跳后台

#### 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 评审 | RequestController | RequestService | RequestRepo | 跨库消费 investigator → 批次聚合幂等入库 → GitHub 仓库上下文（README/目录树）→ LLM 分析+设计 → 五状态审核 → 推送 Manager |

**外部集成**：`github/client.ts` — README/目录/语言抓取，GITHUB_STUB=1 桩

**消费事件**：`researcher.response.push`（跨库连接 INVESTIGATOR_DATABASE_URL，processOutbox 轮询）
**推送事件**：`requirement.created`（payload: analysisMd/designMd/repoUrl/reviewComment）

#### 前端路由

```
前台（直跳后台）
后台（AdminShell /assessor/admin）：
  /admin/requests      RequestList   评审请求列表
  /admin/requests/:id  RequestDetail 分析+设计+审核+推送 Manager（D1 收件箱说明）
```

---

### 6.4 Manager（管理·需求主线核心）

**端口**：Web 4004 / Server 5004
**主题**：COCKPIT_THEME（驾驶舱风 — Consolas / 冷灰蓝 / 天蓝）

#### 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 需求 | RequirementController | RequirementService | RequirementRepo | 7 态生命周期 / 三来源标签（Assessor/手动/GitHub Phantom）/ PR 联动 |
| 迭代 | IterationController | IterationService | IterationRepo | 迭代管理（增删改查 + 需求关联） |

**消费事件**：`requirement.created`（ASSESSOR_DATABASE_URL processOutbox）
**外部集成**：`github/client.ts` — Phantom GitHub Issues 同步（GITHUB_STUB=1）

#### 需求 7 态状态机

```
待分析 → 设计中 → 待开发 → 开发中 → 测试中 → 待验收 → 已完成
```

#### 前端路由

```
前台（UserShell /manager）：
  /              RequirementBoard   FLIGHT DECK 七泳道看板（优先级色条 + PR 标记）
  /requirements/:id  RequirementDetail  飞行日志（仪表卡+简报+时间线）

后台（AdminShell /manager/admin）：
  /admin/requirements  RequirementList  需求管理表格
  /admin/iterations    IterationList    迭代管理
```

---

### 6.5 Gatherer（采集·知识主线第一环）

**端口**：Web 4001 / Server 5001
**主题**：PRESS_THEME（报刊风 — Impact 报头 / 藏青）
**前台形态**：仅报头展示，默认直跳后台

#### 后端模块

| 层 | Controller | Service | 职责 |
|---|---|---|---|
| 健康 | HealthController | — | — |
| 信息源 | SourceController | SourceService + CollectService | 三类源配置（RSS/JSON/网页选择器）、试采、Cron 调度（node-cron）、管道：解析→去重→LLM富化→入库、推送 Scholar |

**采集管道**：`feed/parser.ts` — RSS（rss-parser）/ JSON / 网页（cheerio 选择器）解析 → contentFingerprint 去重 → LLM 富化（提取标题/摘要/正文/分类/关键词）

**推送事件**：`knowledge.item.collected`

#### 前端路由

```
前台（直跳后台）
后台（AdminShell /gatherer/admin）：
  /admin/sources         SourceList  信息源列表（含「编辑」列 Modal — PATCH）
  /admin/sources/:id     SourceDetail  条目查看 + 推送 Scholar（D1 提示收件箱）
  /admin/items           ItemList    采集条目列表
```

---

### 6.6 Scholar（知识·知识主线第二环）

**端口**：Web 4006 / Server 5006
**主题**：LIBRARY_THEME（图书馆风 — Palatino / 羊皮纸绿）

#### 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 收件箱 | InboxController | InboxService | SearchRepo | 跨库消费 gatherer → 收件箱 → 审核入库 |
| 条目 | EntryController | EntryService | SearchRepo | 三来源 CRUD（gatherer/manual/obsidian）/ 分类 / 标签 / **圈定**（Assistant 可见）|
| 检索 | — | SearchService | SearchRepo | 双通道：pg_trgm 全文 + pgvector 向量（embedding-2 1024 维，桩模式 bigram 哈希伪向量）|
| 图谱 | GraphController | GraphService | GraphRepo | LLM 实体关系抽取 → 图谱节点/边存储 + 查询 + 重建 |
| Obsidian | ObsidianController | ObsidianService | — | Vault 目录扫描 → 条目同步（路径去重） |
| 设置 | — | — | SettingsRepo | 向量模型配置等 |

**消费事件**：`knowledge.item.collected`（GATHERER_DATABASE_URL processOutbox）

#### 前端路由

```
前台（UserShell /scholar）：
  /search          SearchPage   书目检索（图书馆目录卡片 + 双通道切换）
  /entries         EntryList    馆藏目录（书卷列表 + 书签式圈定）
  /graph           GraphPage    知识图谱（类目卡片墙 + 图书馆配色）
  /settings        SettingsPage Obsidian Vault 路径 / 分类标签管理

后台（AdminShell /scholar/admin）：
  /admin/entries   EntryList    后台条目管理（含「编辑」五项字段 Modal）
```

---

### 6.7 Assistant（助手·知识主线闭环·6 意图）

**端口**：Web 4007 / Server 5007
**主题**：QUIET_THEME（对话极简 — 无衬线 / 瓷白 / 砖橙）

#### 后端模块

| 层 | Controller/Service | 职责 |
|---|---|---|
| 健康 | HealthController | — |
| 对话 | ChatController + ChatService | HTTP + 网页双入口、多轮持久化、调用 IntentService 路由 |
| 意图 | IntentService | **双层路由（系统归属→域内意图）** / 规则+模型双轨 / 置信度输出、低置信度澄清反问闭环 |
| 知识问答 | KnowledgeService | 连接 Scholar SCHOLAR_DATABASE_URL → 查圈定条目 → 生成带引用回答 |
| 数据查询 | CybercloudService | **真实 cybercloud 对接**（SPKI DER 公钥加密登录/JWT 提取/双头认证/401 自动重登/智能体 block 对话），桩模式 CYBERCLOUD_STUB=1 |
| 动作执行 | ActionService | process_execution：网关调 Manager 创建需求 / 调 Gatherer 触发采集 |
| 故障排查 | TroubleService | 全服务 /health 探测聚合 + LLM 排查建议 |
| 反馈 | FeedbackController + FeedbackService | complaint_feedback：落库 + 前端反馈页可查 |
| 意图日志 | IntentLogController | 可观测层：{domain,intent,confidence} 日志列表 + 纠错回填 API |
| 元信息 | MetaController | 支持的意图清单 / 系统状态 |

#### 6 类意图路由（IntentService）

| 意图 | 说明 | 下游服务 |
|---|---|---|
| `product_inquiry` | 产品咨询 | KnowledgeService → Scholar 圈定条目 + 引用回答 |
| `data_query` | 数据查询 | CybercloudService → cybercloud 智能体（可配置 + 桩） |
| `process_execution` | 流程执行 | ActionService → 网关转发 Manager/Gatherer 创建需求/触发采集 |
| `trouble_shooting` | 故障排查 | TroubleService → 全服务健康探测 + LLM 建议 |
| `complaint_feedback` | 反馈投诉 | FeedbackService → 落库 + 可查 |
| `chitchat_reject` | 闲聊兜底 | 礼貌拒绝 + 引导使用正式能力 |

#### 前端路由

```
前台（UserShell /assistant）：
  /              ChatPage      极简双栏对话（异形圆角气泡 + 意图署名 + 虚线引用区）
  /feedback      FeedbackPage  反馈提交 + 历史查看
  /intent-logs   IntentLogPage 意图日志可观测 + 纠错回填

后台（AdminShell /assistant/admin）：
 （当前版本复用前台路由，后续可扩展配置管理）
```

---

### 6.8 Designer（设计·降级版组件生成器）

**端口**：Web 4005 / Server 5005
**主题**：GALLERY_THEME（画廊风 — Helvetica / 纯白 / 墨黑）

#### 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 生成 | GenerateController | GenerateService | GenerationRepo | 自然语言/设计稿图片 → LLM 生成 @mt/ui 组件源码 → 生成记录 |
| 预览 | PreviewController | PreviewService | — | **esbuild 沙箱**编译 React+TSX → 返回可渲染 HTML 字符串供 iframe 预览 |
| 组件库 | ComponentController | ComponentService | ComponentRepo | 审核入库 @mt/ui 候选池 + 组件 CRUD |

**MVP 边界**：降级版，无可视化编辑器/拖拽/实时编辑

#### 前端路由

```
前台（UserShell /designer）：
  /generate       GeneratePage  画廊委托单（自然语言/图片上传 → 展品卡+预览展位）
  /components     ComponentList 组件库列表
  /history        HistoryList   生成历史

后台（AdminShell /designer/admin）：
  /admin/components  ComponentList 组件审核管理
```

---

## 7. 服务间通信与事件契约

### 7.1 通信模型

```
同步 REST：适合同一子项目内 web → server（经 gateway 反代）
          如 assistant → scholar（SCHOLAR_DATABASE_URL 直连也可）

outbox 事件表：适合跨子项目异步解耦（失败重试 + dead 终态）
  生产者：appendOutbox(pool, { id:event-uuid, event:"xxx", source, payload, occurredAt })
  消费者：setInterval(() => processOutbox(pool, handler, { batchSize:10, maxAttempts:5 }), 5000)
          （每 5 秒轮询一次，SKIP LOCKED 避免并发重复）

幂等键：@mt/utils.idempotencyKey(prefix)，outbox ON CONFLICT DO NOTHING
        消费者可根据事件 id 建立本地去重表
```

### 7.2 三大核心事件契约（跨库直连 processOutbox）

#### ① researcher.response.push（Investigator → Assessor）

```
方向：investigator.outbox → assessor 跨库连接 INVESTIGATOR_DATABASE_URL
触发：Investigator 管理员在 SurveyDetail 点「推送 Assessor」
payload：{
  surveyId, responseId,
  records: [{ question, answer, priority, sentiment, painPoint, expectation }]  // LLM 结构化提取
}
Assessor 消费：批次聚合同 surveyId 的多 response → 生成 Request + 状态 pending_analysis
```

#### ② requirement.created（Assessor → Manager）

```
方向：assessor.outbox → manager 跨库连接 ASSESSOR_DATABASE_URL
触发：Assessor RequestDetail 审核通过 → Push Manager
payload：{
  requestId,
  title, requirement,
  analysisMd,   // LLM 需求分析
  designMd,     // LLM 设计方案
  repoUrl,      // 关联 GitHub 仓库
  reviewComment // 人工审核备注
}
Manager 消费：创建 Requirement（来源=assessor），初始状态待分析
```

#### ③ knowledge.item.collected（Gatherer → Scholar）

```
方向：gatherer.outbox → scholar 跨库连接 GATHERER_DATABASE_URL
触发：Gatherer Item 列表「推送 Scholar」或 Cron 自动审核通过
payload：{
  itemId, url, title, content, summary,
  category, keywords: string[],
  publishedAt
}
Scholar 消费：进入收件箱（InboxService），等待人工审核或自动入库为 Entry
```

### 7.3 需求主线时序图（Mermaid）

```mermaid
sequenceDiagram
    actor 管理员 as Admin
    participant 飞书 as Feishu Bitable
    participant I as Investigator Server
    participant IOutbox as Investigator.outbox
    participant A as Assessor Server
    participant GH as GitHub
    participant LLM as LLM(@mt/model-client)
    participant AOutbox as Assessor.outbox
    participant M as Manager Server

    Note over Admin,Feishu: 外部调研触发
    Admin->>飞书: 配置问卷 → 数据落多维表格
    Admin->>I: SurveyDetail 点「拉取最新」
    I->>飞书: feishu/client 分页拉取(令牌缓存)
    飞书-->>I: 返回原始记录列表
    I->>LLM: chat() 结构化提取\n需求点/痛点/优先级/情绪
    LLM-->>I: records[]
    Admin->>I: 点「推送 Assessor」
    I->>IOutbox: appendOutbox(event="researcher.response.push")\nON CONFLICT DO NOTHING
    Note over IOutbox: ☝️ 异步解耦，无需 Assessor 在线

    loop 每 5s processOutbox 轮询
        A->>IOutbox: SELECT ... FROM outbox\nWHERE status IN (pending,retry)\nAND attempts<5 FOR UPDATE SKIP LOCKED
        IOutbox-->>A: 返回批量事件
    end
    A->>A: 聚合同 surveyId 多 response → Request(pending_analysis)
    A->>GH: client.getRepoContext(repoUrl)\nREADME + 目录树 + 语言分布
    GH-->>A: 返回仓库上下文
    A->>LLM: chat() 生成 analysisMd + designMd + 验收标准
    LLM-->>A: markdown 分析 + 方案文本
    Admin->>A: RequestDetail 人工审核通过
    A->>AOutbox: appendOutbox(event="requirement.created")\npayload含分析/方案/仓库地址
    Note over AOutbox: ☝️ 第二环事件输出

    loop 每 5s Manager 侧 processOutbox
        M->>AOutbox: 跨库连接 ASSESSOR_DATABASE_URL 轮询
        AOutbox-->>M: 返回 requirement.created 事件
    end
    M->>M: 创建 Requirement(初始状态 待分析，来源=assessor)\n状态机开始流转
    Admin->>M: 后续生命周期：设计中→待开发→开发中→测试中→待验收→已完成
```

### 7.4 知识主线时序图（Mermaid）

```mermaid
sequenceDiagram
    actor 用户 as User
    participant Src as 信息源<br/>(RSS/JSON/网页)
    participant G as Gatherer Server
    participant LLM as LLM(@mt/model-client)
    participant GOutbox as Gatherer.outbox
    participant S as Scholar Server
    participant C as Assistant Server
    participant CC as cybercloud

    Note over Src,GOutbox: 第一环：采集 → 推送
    loop Cron 调度 or 手动试采
        G->>Src: rss-parser / cheerio 选择器 / fetch JSON
        Src-->>G: 原始内容 feed[]
    end
    G->>G: contentFingerprint(SHA-256)\n去重过滤
    G->>LLM: chat() 富化：标题/摘要/分类/关键词
    LLM-->>G: 结构化 item
    G->>GOutbox: appendOutbox(event="knowledge.item.collected")\npayload含 itemId/url/title/summary/category/keywords
    Note over GOutbox: ☝️ 异步，Scholar 离线也不丢

    loop 每 5s Scholar 侧 processOutbox
        S->>GOutbox: 跨库 GATHERER_DATABASE_URL 轮询(含 skip locked)
        GOutbox-->>S: 批量事件
    end
    S->>S: InboxService 收件箱入库，等待人工审核通过
    用户->>S: 点「纳入馆藏」/ 设置自动入库
    S->>S: EntryService 生成条目 → SearchService 双通道
    S->>LLM: embed() 生成 1024 维向量写入 embedding 列
    LLM-->>S: vector
    用户->>S: GraphService 抽取图谱 / 勾选 圈定

    Note over C,CC: 第三环：Assistant 问答闭环
    用户->>C: ChatPage 提问
    C->>C: IntentService 双层路由\n(系统归属 → 域内意图)\n→ 判定 product_inquiry
    C->>S: KnowledgeService 跨库 SCHOLAR_DATABASE_URL\n查询 圈定=true 的 entry 集合
    S-->>C: 返回命中条目(title, content 片段)
    C->>LLM: chat(system+引用条目+用户问题) 生成答案\n要求在末尾附引用来源
    LLM-->>C: 回答 + 引用链接
    C-->>用户: ChatPage 气泡 + 虚线引用区展示

    alt 其他意图分流
        用户->>C: 提问「本月销售额多少」→ data_query
        C->>CC: CybercloudService JWT 认证+智能体对话
        CC-->>C: 返回业务数据回答
        C-->>用户: 数据查询结果
    else process_execution
        用户->>C: 「帮我创建一个 xxx 需求」
        C->>G: ActionService 经 gateway 转发 REST\nPOST /api/manager/requirements
    else trouble_shooting
        C->>C: TroubleService 聚合 8 服务 /health
        C->>LLM: chat() 生成排查建议
    else complaint_feedback
        用户->>C: FeedbackPage 提交反馈
        C->>C: FeedbackService 落库 feedback 表
    end
```

---

## 8. 前端体系设计

> 📎 **本节主文档为 [docs/ui-spec.md](file:///d:/MagicTools/docs/ui-spec.md)。本节为速查摘要版：覆盖规范、路由划分、主题对照表 + 新增 Mermaid 组件结构图。若涉及设计令牌新增、外壳 Props 变更、新应用主题，请优先修改 ui-spec.md 后同步回本节。**

### 8.1 强制规范（ui-spec.md）

1. 入口必须包裹 `<MtThemeProvider>`（Vite 模板已内置）
2. 颜色一律 `tokens.color.xxx`，**禁止业务硬编码色值**
3. 空数据必须 `<MtEmptyState>`（title 必填；自定义操作按钮传 `actionText` + `onAction` 两参数协作）
4. 新通用组件先提 PR 沉淀到 packages/ui，评审后供全平台复用
5. 有终端用户 + 配置管理场景的应用，**必须拆分前后台双外壳**（禁止共用一套导航）

### 8.2 前后台路由划分规则

- **前台路由**：`/<name>/<page>` — UserShell 包裹，按应用定制主题
- **后台路由**：`/<name>/admin/<page>` — AdminShell 包裹，全平台统一控制台风
- App.tsx 判断：`isAdmin = location.pathname.startsWith("/admin")` 二选一渲染
- 互跳：UserShell 页脚 `adminPath="/admin/xxx"` + AdminShell 侧栏底部 `frontPath="/xxx"`

> ⚠️ **硬约束**：`AdminShell` 全平台统一控制台风，**不接受 theme 参数**，禁止在后台页面做个性化外壳定制。
> ⚠️ **架构约定**：三外壳均为**受控组件**（通过 props `onNavigate` 回调通知上层路由切换），`@mt/ui` 包本身**不依赖 react-router**，保持零路由耦合。

### 8.2.1 前端双外壳组件结构图（Mermaid）

```mermaid
graph TD
    classDef root fill:#f0f5ff,stroke:#2f54eb,stroke-width:2px
    classDef shell fill:#fff4e6,stroke:#faad14,stroke-width:2px
    classDef route fill:#f6ffed,stroke:#52c41a,stroke-width:1px
    classDef page fill:#ffffff,stroke:#8c8c8c,stroke-width:1px

    Entry[main.tsx 入口]:::root -->|包裹| T[MtThemeProvider<br/>(AntD ConfigProvider + tokens)]:::root
    T -->|挂载 basename=/<name>/| R[BrowserRouter<br/>react-router-dom]:::root
    R -->|根组件| App[App.tsx Shell 选择器]

    App -->|location.startsWith /admin ?| Judge{🔀 前后台判定}
    Judge -->|Yes · 配置管理| A[AdminShell<br/>✅ 全平台统一控制台风]:::shell
    Judge -->|No · 用户前台| U[UserShell<br/>🎨 每应用独立审美主题]:::shell
    Judge -->|单一形态应用（过渡）| O[AppShell<br/>通用侧栏+顶栏外壳]:::shell

    %% AdminShell 子结构
    A --> Sider[🟣 深色侧栏 #1c1f26<br/>ADMIN_TOKENS]
    A --> Header[🔵 顶栏「后台」Tag + 切换应用下拉]
    A --> AdminContent[📋 内容区 统一 #f4f5f7]
    A -->|frontPath 可选| Back[← 返回前台入口<br/>侧栏底部，无前台 omit]
    AdminContent --> ARoutes[<Routes> /admin/*]:::route
    ARoutes --> A1[<Page /> · CRUD 表格]:::page
    ARoutes --> A2[<Page /> · 配置表单]:::page

    %% UserShell 子结构
    U --> MastHead[📰 报头区：MagicTools 小字 + h1 衬线大字<br/>+ 副标题 + 双线/双线分隔]
    U --> Nav[🧭 水平导航条：UserNavItem 左右居中]
    U --> UserContent[📖 内容区：max-width 1080 居中]
    U -->|adminPath 可选| FooterAdmin[管理后台 → 入口 · 页脚右侧]
    U --> Footer[ⓘ footerNote 个性化页脚 · 页脚左侧]
    UserContent --> URoutes[<Routes> /* 前台路由]:::route
    URoutes --> U1[PositionWall / ChatPage / FlightDeck<br/>主题化深度设计页]:::page
    URoutes --> U2[SearchPage / EntryList / GraphPage<br/>个性化内容页]:::page

    %% 三外壳共享：跨应用切换下拉（顶栏 or 页脚）
    AppSwitch[🔁 切换应用：APPS 注册表 8 项]
    A --> AppSwitch
    U --> AppSwitch
    O --> AppSwitch
```

### 8.3 8 应用前台主题对照表

| 应用 | 主题常量 | 报头标题 | 设计语言关键词 |
|---|---|---|---|
| applicant | MAGAZINE_THEME | 求职 · 每一次投递，都值得被认真对待 | 杂志风：Georgia/Noto Serif SC 衬线、暖纸 #f8f5ef、砖红 #b4532a |
| scholar | LIBRARY_THEME | 知识书院 · 典藏知识，检索于心 | 图书馆风：Palatino、羊皮纸绿系、书签编号 |
| assistant | QUIET_THEME | 智能助手 · 有问必答 | 对话极简：无衬线、瓷白、砖橙、异形气泡 |
| gatherer | PRESS_THEME | 知识采集部 · 日日新 | 报刊风：Impact 报头、藏青、排版密 |
| investigator | ARCHIVE_THEME | 调研档案馆 · 事实在先 | 档案风：Courier 等宽、牛皮纸 #f5e9cf、铜金 #b8860b |
| assessor | BRIEF_THEME | 评审文书房 · 审慎落笔 | 文书风：Georgia、暖白、深赭、段落缩进 |
| manager | COCKPIT_THEME | 交付驾驶舱 · 掌控节奏 | 驾驶舱风：Consolas 等宽、冷灰蓝 #1e2a38、天蓝 #3b82f6 |
| designer | GALLERY_THEME | 组件画廊 · 灵感即展品 | 画廊风：Helvetica、纯白底、墨黑线条 |

> gatherer / investigator / assessor 三应用前台无实际内容，根路径仅展示报头后重定向至后台。

### 8.4 前端通用模式（所有 web 项目同构）

```tsx
// api.ts 模式
const BASE = "/api/<name>";
export const api = {
  list: () => fetch(BASE + "/entries").then(r => r.json()),
  // ...
};

// vitest 配置：jsdom + @testing-library/react
// test-setup.ts：jsdom 全局注入 + AntD 兼容桩
```

---

## 9. 后端与数据库体系

### 9.1 NestJS 统一骨架模式

每个子项目 server 完全同构，仅领域不同：

```
main.ts
├─ loadRootEnv()           // @mt/config 读仓库根 .env
├─ const PORT = process.env.PORT            // 来自 ports.yaml
├─ const DATABASE_URL = process.env.DATABASE_URL
├─ const pool = createPool(DATABASE_URL)    // @mt/db createPool
├─ runMigrations(pool, join(__dirname, "../migrations"))  // 自动执行 SQL
├─ const app = await NestFactory.create(AppModule)
├─ app.setGlobalPrefix("/api/<name>")       // 全局前缀（与 gateway /api/<name>/ 对齐）
├─ setInterval(() => processOutbox(pool, handler, opts), 5000)  // 消费上游事件
└─ app.listen(PORT)
```

### 9.2 三层代码分层

```
schemas.ts (Zod 校验 DTO)
  ↓
*.controller.ts (路由 + 参数校验 + 调用 Service)
  ↓
*.service.ts (业务逻辑：编排 LLM/外部集成/Repo 调用)
  ↓
*.repo.ts (纯数据库 CRUD：pool.query SQL 原生)
```

> 选型原则：不引入 TypeORM/Prisma，原生 PG SQL + Zod 校验最轻量、最可控。

### 9.3 数据库模式（单实例多库）

PostgreSQL 单实例（pgvector/pgvector:pg16），使用 `infra/postgres-init.sql` 初始化时为每个子项目 + 测试创建独立数据库：

| 数据库 | 用途 | 迁移来源 |
|---|---|---|
| applicant | 求职 | apps/applicant/server/migrations + @mt/db outbox |
| investigator | 调研 | apps/investigator/server/migrations（含 002_outbox.sql） |
| assessor | 评审 | 同上（含 outbox） |
| manager | 管理 | 同上 |
| gatherer | 采集 | 同上 |
| scholar | 知识 | apps/scholar/server/migrations |
| assistant | 助手 | apps/assistant/server/migrations（3 个：core/feedback/intent_logs） |
| designer | 设计 | apps/designer/server/migrations |
| mt_test | E2E 测试共享 | — |

### 9.4 迁移执行器机制（runMigrations）

- 自动建 `schema_migrations(name PK, applied_at)` 表
- 读取 migrations 目录下所有 `*.sql` 按文件名升序执行
- 每个文件单事务包裹：BEGIN → 执行 → INSERT schema_migrations → COMMIT；失败 ROLLBACK 抛错
- 幂等：已在 schema_migrations 中的文件跳过
- 子项目迁移目录必须包含自己的业务表 + 需要 outbox 时追加 `002_outbox.sql`（@mt/db/migrations 是模板）

---

## 10. LLM 智能层

### 10.1 供应商切换与桩模式

```bash
# 环境变量控制
DEEPSEEK_API_KEY=xxx   # 留空则此供应商不可用
ZHIPU_API_KEY=xxx       # 过期会 401，建议 MT_LLM_STUB=1 桩模式跑测试

# 全局桩（CI/本地无 Key 时用）
MT_LLM_STUB=1          # 所有子项目 llm.ts 检查此 env，true → 返回固定 mock 文本
```

**使用模式（子项目 llm.ts 统一封装）**：

```ts
import { createModelClient, parseJson, ZHIPU } from "@mt/model-client";
const llm = createModelClient(ZHIPU, (u) => console.log("[usage]", u));
// 无 Key 或 MT_LLM_STUB 时，llm.chat 返回占位符文本，不抛错

// 必须：结构化输出用 parseJson
const raw = (await llm.chat(messages)).content;
const data = parseJson(raw) as MySchema;  // 4 级降级容错
```

### 10.2 视觉能力（Applicant 截图识别）

智谱 glm-4v-flash 多模态：

```ts
const message: ChatMessage = {
  role: "user",
  content: [
    { type: "text", text: "提取图片中的岗位 JD 信息为 JSON" },
    { type: "image_url", image_url: { url: "data:image/png;base64," + b64 } }
  ]
};
await llm.chat([message], { vision: true });
// vision:true 自动路由到 visionModel（glm-4v-flash），无则 fallback defaultModel
```

### 10.3 向量能力（Scholar 检索）

智谱 embedding-2（1024 维）：

```ts
const vectors = await llm.embed(["文档1", "文档2"]);  // Promise<number[][]>
// MT_LLM_STUB 模式下返回 bigram 哈希伪向量（保证维度一致，仅用于测试流程）
```

Scholar 双通道检索：
1. 全文检索：`to_tsvector('english', content) @@ plainto_tsquery(?)` + pg_trgm 相似度
2. 向量检索：`embedding <=> $1 ORDER BY 1 LIMIT n`（余弦距离，pgvector 操作符）

---

## 11. 工程化与 CI/CD

> 📎 **§11.1 脚本命令表与 [AGENTS.md](file:///d:/MagicTools/AGENTS.md) §常用命令、README.md 有重合。脚本新增/改名请优先改 package.json + AGENTS.md。§11.4 CI 流水线章节为主原创内容。**

### 11.1 根 package.json 脚本

| 命令 | 实际执行 | 说明 |
|---|---|---|
| `pnpm build` | `turbo run build` | 全 Monorepo 构建（^build 拓扑依赖，先公共包后子项目），输出 dist/ |
| `pnpm test` | `turbo run test` | 全量 Vitest 运行（dependsOn build） |
| `pnpm test:affected` | `turbo run test --affected` | ⭐ 回归层：只跑变更影响的包 |
| `pnpm coverage` | `turbo run coverage` | Vitest 覆盖率，输出 coverage/（公共包门槛 70/70/70/50） |
| `pnpm lint` | `eslint .` | 全局 ESLint（typescript-eslint + react-hooks 规则集） |
| `pnpm test:infra` | `node --test infra/scripts/lib/*.test.mjs` | Node 原生测试 infra 脚本 |
| `pnpm smoke [--only <服务>]` | `node infra/scripts/smoke.mjs` | 冒烟：读取 ports.yaml 探活所有服务健康检查 |
| `pnpm qa:gate` | lint + build + test + coverage + test:infra + docs:lint | ✅ **本地合入前强制门禁，等同 CI quality job** |
| `pnpm new:app <name>` | `node infra/scripts/new-app.mjs` | 复制模板 + 分配端口 + 写 ports.yaml |
| `pnpm ws:create <项目> <任务ID>` / `ws:cleanup` | `workspace.mjs` | Git worktree 管理 |
| `pnpm changeset` / `release` | changesets CLI | 迭代日志 / 版本号自动生成 |

### 11.2 Turbo 管道（turbo.json）

```json
{
  "build":    { "dependsOn": ["^build"], "outputs": ["dist/**"] },
  "test":     { "dependsOn": ["build"] },
  "coverage": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
  "lint":     { "dependsOn": ["^build"] },
  "dev":      { "cache": false, "persistent": true }
}
```

- ^build = 先构建上游 workspace 依赖包（config/types/db/ui/model-client/utils）
- CI 用 actions/cache 缓存 `.turbo` 目录大幅加速

### 11.3 四层测试体系

| 层 | 工具 | 范围 | 命令 | CI Job |
|---|---|---|---|---|
| 1 单元 | Vitest | 公共包核心逻辑 + Service 单测 | `pnpm test` | quality |
| 2 冒烟 | smoke.mjs fetch | 所有服务健康检查（server /health + web 200） | `pnpm smoke` | smoke |
| 3 回归 | Turbo --affected | 仅构建变更影响的包 + 跑对应测试 | `pnpm test:affected` | 本地（CI 全量） |
| 4 E2E | Playwright chromium | 11 个 spec 全流程真实交互 | `@mt/e2e playwright test` | e2e |

### 11.4 CI 流水线（.github/workflows/ci.yml）

**4 Job 顺序执行（DAG）：**

```
quality（quality gate）→ smoke → e2e → images（仅 main 分支）
```

#### CI 流水线流程图（Mermaid）

```mermaid
flowchart LR
    classDef trig fill:#eef4ff,stroke:#4c7dff,stroke-width:2px
    classDef job fill:#fff4e6,stroke:#faad14,stroke-width:2px
    classDef step fill:#f6ffed,stroke:#52c41a,stroke-width:1px
    classDef svc fill:#f0f5ff,stroke:#2f54eb,stroke:1px
    classDef cond fill:#fff0f6,stroke:#eb2f96,stroke-dasharray:5 5
    classDef out fill:#f9f0ff,stroke:#722ed1,stroke-width:2px

    Trigger[🔔 触发事件<br/>PR / push(main|dev)]:::trig --> Q[Job 1 · quality]:::job
    Q -->|needs: 无| QSvc[📦 Service: pgvector pg16<br/>POSTGRES_DB=mt_test]:::svc
    QSvc --> Q1[actions/checkout + setup-node + pnpm]:::step
    Q1 --> QCache[💾 缓存 .turbo<br/>actions/cache key=turbo-os-sha]:::step
    QCache --> Q2[pnpm install --frozen-lockfile]:::step
    Q2 --> Q3[pnpm lint · ESLint 全量]:::step
    Q3 --> Q4[pnpm build · turbo 并行 16 包]:::step
    Q4 --> Q5[pnpm test · Vitest 全量 + 覆盖率]:::step
    Q5 --> Q6[pnpm test:infra · Node 原生测试脚本]:::step
    Q6 --> Q7[pnpm docs:lint · markdownlint]:::step
    Q7 --> QOut{❓ quality 全通过?}:::cond
    QOut -->|✅ Yes| S[Job 2 · smoke<br/>needs: quality]:::job
    QOut -->|❌ No| Fail[🚫 终止，PR 红]:::out

    S --> SSvc[📦 Service: pgvector pg16<br/>POSTGRES_DB=applicant + 8 环境变量覆盖]:::svc
    SSvc --> SStub[🧪 全局桩模式<br/>MT_LLM_STUB=1 FEISHU/GITHUB/CYBERCLOUD/FEED=1]:::step
    SStub --> SBuild[复用缓存后的 dist/]:::step
    SBuild --> SStart[🚀 启动 17 个进程<br/>gateway + 8 web + 8 server · 后台 &]:::step
    SStart --> SWait[⌛ sleep 10s 等待健康]:::step
    SWait --> S8[🔁 smoke.mjs --only × 8<br/>applicant → designer 逐个探活]:::step
    S8 --> SOut{❓ smoke 全 PASS?}:::cond
    SOut -->|✅| E[Job 3 · e2e<br/>needs: smoke]:::job
    SOut -->|❌| Fail

    E --> ESvc[📦 Service: pgvector pg16 · 同 smoke]:::svc
    ESvc --> EStub[🧪 桩模式开关与 smoke 完全一致]:::step
    EStub --> EBuild[复用 dist/]:::step
    EBuild --> EPlay[💻 actions/cache: ~/.cache/ms-playwright<br/>pnpm --filter @mt/e2e exec playwright install chromium]:::step
    EPlay --> EStart[🚀 启动全服务 17 进程 · 同 smoke]:::step
    EStart --> ERun[🎭 pnpm --filter @mt/e2e exec playwright test<br/>11 specs 并行 chromium]:::step
    ERun --> EOut{❓ e2e 全通过?}:::cond
    EOut -->|✅| Img[Job 4 · images<br/>needs:[quality,smoke,e2e]]:::job
    EOut -->|❌| Fail

    Img --> ImgIf{🔀 if: github.ref == refs/heads/main<br/>仅 main 分支触发}:::cond
    ImgIf -->|❌ 其他分支| Skip[⏭️ 跳过镜像构建]:::out
    ImgIf -->|✅ main| ImgHost{🔐 if: env.REGISTRY_HOST != ''<br/>GitHub Secret 已配置?}:::cond
    ImgHost -->|❌ 未配置| Skip
    ImgHost -->|✅ 已配置| ImgLogin[docker/login-action<br/>登录 ACR/GHCR]:::step
    ImgLogin --> ImgMx[Strategy Matrix × 17<br/>gateway + 8app×web/server]:::step
    ImgMx --> ImgBuild[docker build<br/>按 SERVICE 选 Dockerfile 路径]:::step
    ImgBuild --> ImgPush[docker push<br/><REGISTRY_HOST>/magictools/<service>:latest]:::step
    ImgPush --> Deploy[📦 镜像仓库，供 deploy.ps1 拉取重启]:::out
```

#### Job 1: quality
- 依赖服务：pgvector/pgvector:pg16（POSTGRES_DB=mt_test）
- 步骤：pnpm install → 缓存 .turbo → pnpm lint → pnpm build → pnpm test → pnpm test:infra → pnpm docs:lint

#### Job 2: smoke（needs quality）
- 启动 applicant ~ designer 全部 16 个进程（8 web + 8 server）+ gateway
- 环境变量：MT_LLM_STUB=1 / FEISHU_STUB=1 / GITHUB_STUB=1 / CYBERCLOUD_STUB=1 / FEED_STUB=1（桩模式避免真实外部调用）
- 循环执行 `smoke.mjs --only <app>` × 8

#### Job 3: e2e（needs smoke）
- 同 smoke 启动全部服务
- 安装 Playwright chromium（缓存 ~/.cache/ms-playwright）
- 运行 `@mt/e2e exec playwright test`

#### Job 4: images（needs [quality, smoke, e2e]，仅 main 分支触发）
- Strategy matrix：17 个镜像（gateway + 8 app × 2 web/server）
- 有 REGISTRY_HOST Secret 才构建推送（缺省自动跳过）
- 镜像路径：`<REGISTRY_HOST>/magictools/<service>:latest`（Dockerfile 多阶段）

---

## 12. Git 工作流与分支管理

> 📎 **本节主文档为 [docs/git-workflow.md](file:///d:/MagicTools/docs/git-workflow.md) + [AGENTS.md](file:///d:/MagicTools/AGENTS.md) 分支/收尾部分。本节为速查摘要版：分支模型、worktree、四层清理、收尾协议。若涉及 worktree 脚本、分支命名规则、仓库保护配置变更，请先修改对应主文档。**
>
> 🔴 **硬性纪律（AGENTS.md 硬约 #1）**：TDD 先行 — 先写**失败的**测试用例再补实现代码；禁止在最终源码中留 TODO/TBD 占位符（可写分支说明，禁止合入 main）。

### 12.1 分支模型

```
main（生产，受保护：PR + quality/smoke/e2e 三检查必须通过；合并触发：images 打镜像 + changesets 版本发布）
  ↑
dev（集成，同 main 保护配置）— PR 合并目标
  ↑
feat-<project>-<taskId>-<desc>（开发分支：绑任务不绑对话，多会话可复用）
```

### 12.2 并行开发：Git Worktree

一个任务一个 worktree，主仓库保持干净：

```bash
pnpm ws:create applicant 20260827-resume-rewrite-fix
# → 新建分支 feat-applicant-20260827-resume-rewrite-fix
# → 在 ../worktrees/applicant-20260827-resume-rewrite-fix/ 下 checkout
# → 可独立 pnpm install / dev / test

pnpm ws:cleanup applicant 20260827-resume-rewrite-fix
# → 删除 worktree + 本地分支（PR 合并后远程分支已被 GitHub 自动删除）
```

### 12.3 四层分支清理

1. **GitHub 自动**：设置 → Automatically delete head branches（PR 合并删远程）
2. **CI 定时**：branch-gc.yml（每周比对 open PR + Manager 任务状态，清理孤儿分支）
3. **会话收尾**：每个开发任务完成后执行 ws:cleanup
4. **任务联动**：分支名携带任务 ID，Manager 任务关闭时联动检查

### 12.4 会话收尾协议（AGENTS.md 强制）

```
✅ 代码已提交（pnpm qa:gate 全绿）
✅ 已推送并创建 PR
✅ PR 合并 → worktree 已清理
✅ docs/memory/state.md 即时追加
✅ pnpm changeset 添加变更日志
```

### 12.5 Conventional Commits 中文规范

```
动词开头，中文 subject，≤ 50 字
feat: 新增 applicant 简历改写对接 ClawCV
fix: 修复 outbox dead 终态未入库导致的永久重试
docs: 更新前后台双外壳主题对照表
test: 补齐 assistant 6 意图 E2E 覆盖
chore: 升级 turbo 至 2.1
```

---

## 13. 环境与配置

### 13.1 .env.template（22 项配置，.env 放仓库根，.gitignore 忽略）

| 变量 | 用途 | 子项目 |
|---|---|---|
| GATEWAY_TOKEN | 网关 X-Access-Token 鉴权（留空不鉴权） | gateway |
| DEEPSEEK_API_KEY | DeepSeek LLM 密钥 | 全部 LLM 服务 |
| ZHIPU_API_KEY | 智谱 LLM 密钥（过期→桩模式） | 全部 LLM 服务 |
| DATABASE_URL | 单项目本地默认库 | 各子项目 server 启动时覆盖 |
| FEISHU_APP_ID / APP_SECRET / BOT_WEBHOOK / BOT_SECRET | 飞书开放平台 | investigator |
| CLAWCV_API_KEY + BACKEND_URL | 超级简历 API | applicant |
| CYBERCLOUD_BASE_URL / API_KEY / AGENT_ID / USERNAME / PASSWORD / JWT | cybercloud 智能体平台 | assistant |
| MT_LLM_STUB / FEISHU_STUB / GITHUB_STUB / CYBERCLOUD_STUB / FEED_STUB / ACTION_STUB | **桩模式开关（CI 用，=1 跳过真实外部调用）** | CI/smoke/e2e |
| MT_PROD | 生产网关 host 解析（=1 时用 Docker Compose 服务名） | gateway |
| <NAME>_DATABASE_URL | 跨库直连上游 outbox（INVESTIGATOR_/ASSESSOR_/GATHERER_/SCHOLAR_） | assessor/manager/scholar/assistant |

### 13.2 数据库连接约定（本地单实例多库）

```bash
# 本地默认（docker-compose.dev.yml 启动 postgres 5432）
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/<dbname>
# 每个子项目启动时覆盖：applicant 用 applicant 库，scholar 用 scholar 库...
# 跨库消费额外配置：如 assessor 需要连接 investigator 的 outbox
INVESTIGATOR_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/investigator
```

---

## 14. 项目运行方式

> 📎 **本节为 [README.md](file:///d:/MagicTools/README.md) §快速开始的扩展完整版：包含 worktree 模式、全栈联调步骤、E2E 运行、new:app 新建子项目等细分命令。通用命令变更请同步 README.md。**

### 14.1 前置条件

| 依赖 | 版本 | 验证命令 |
|---|---|---|
| Node.js | >= 20（LTS） | `node -v` |
| pnpm | 9.12.0（packageManager 指定） | `pnpm -v` |
| Docker Desktop | 任意支持 compose 的版本 | `docker --version` + `docker compose version` |
| PostgreSQL 客户端 | （可选，调试用） | `psql --version` |

> ⚠️ **Windows PowerShell 限制**：pnpm 命令一律用 `pnpm.cmd`（否则被 ExecutionPolicy 拦住）。本 Wiki 示例用 pnpm，Windows 下替换。

### 14.2 本地从零开始

```bash
# 1. 克隆仓库
git clone <MagicTools repo>
cd MagicTools

# 2. 安装依赖
pnpm install          # Windows: pnpm.cmd install

# 3. 复制环境变量（从模板，LLM Key 按需填真实值或留空用桩）
copy .env.template .env
# 编辑 .env：本地 DATABASE_URL 默认 postgres://postgres:postgres@127.0.0.1:5432/<各子项目自己的名>

# 4. 启动 PostgreSQL（pgvector 扩展）
docker compose -f infra/docker-compose.dev.yml up -d
# 5432 端口暴露，自动挂载持久卷 pgdata
# 如需自动建库，执行 infra/postgres-init.sql（内含 9 CREATE DATABASE）

# 5. 跑一次全量构建 + 测试（验证环境）
pnpm build
pnpm test      # 桩模式无需真实 LLM Key（MT_LLM_STUB=1）

# 6. 跑质量门禁（合入前必过）
pnpm qa:gate
```

### 14.3 单项目开发（推荐用 worktree）

```bash
# 方法 A：worktree 隔离
pnpm ws:create scholar 20260827-graph-ui-fix
cd ../worktrees/scholar-20260827-graph-ui-fix
pnpm install    # worktree 需要首次装依赖

# 前端：Vite HMR 热更新
pnpm --filter @mt/scholar-web dev
# → http://127.0.0.1:4006/scholar/ （Vite 严格端口，与 ports.yaml 一致）

# 后端：tsx watch 热重载
pnpm --filter @mt/scholar-server dev
# → NestJS 监听 5006，全局前缀 /api/scholar

# 方法 B：主仓库单子项目
pnpm --filter @mt/applicant-web dev
pnpm --filter @mt/applicant-server dev
```

### 14.4 全栈联调（所有服务 + gateway）

```bash
# 1. 先 build 所有包
pnpm build

# 2. 逐个启动（Windows 用多个 PowerShell 窗口）：
# gateway
node apps/gateway/dist/index.js &

# applicant
PORT=5008 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/applicant MT_LLM_STUB=1 node apps/applicant/server/dist/main.js &
(cd apps/applicant/web && node node_modules/vite/bin/vite.js preview --port 4008 --strictPort) &
# （其余 7 服务参照 .github/workflows/ci.yml smoke job 的完整启动命令）

# 3. 冒烟检查
pnpm.cmd smoke
# → PASS applicant-server (200ms) / applicant-web / ... 共 17 项

# 4. 访问
open http://127.0.0.1:3000/       # 网关首页（8 应用卡片导航）
open http://127.0.0.1:3000/scholar/  # 直接访问某子项目
```

### 14.5 E2E 测试

```bash
pnpm install
pnpm build
pnpm --filter @mt/e2e exec playwright install chromium   # 首次装浏览器
# 启动全服务（见 14.4 步骤 2）
pnpm --filter @mt/e2e exec playwright test
```

### 14.6 新建子项目（pnpm new:app）

```bash
pnpm new:app translator
# 效果：
# 1. 复制 infra/templates/server + web → apps/translator/{server,web}
# 2. ports-lib allocPorts 分配下一组空闲端口 web 4009 / server 5009（预注册的 8 个已占用）
# 3. 写入 infra/ports.yaml → translator: { web: 4009, server: 5009 }
# 4. 提示接下来：重命名包名、补 AppModule controllers、写迁移、加路由
```

---

## 15. 依赖关系全景图

### 15.1 Workspace 包依赖 DAG

```
@mt/types ○─── 无内部依赖（原子）
    ↑
@mt/utils (depends on: types? No，无内部依赖)
    ↑
@mt/db  (depends on: @mt/types)
    ↑
@mt/config  (无内部依赖，dotenv + yaml + zod)
    ↑
@mt/model-client  (无内部依赖，纯 fetch)
    ↑
@mt/ui  (peer react + antd，无 workspace 依赖)
    ↑
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8 子项目 server 统一依赖：
  @mt/config + @mt/types + @mt/db + @mt/model-client
  (+ 可选 @mt/utils，gatherer/investigator/assessor/manager 用)

8 子项目 web 统一依赖：
  @mt/ui (peer: antd + react)
  (+ react-router-dom 路由)

Designer server 额外依赖 @mt/ui（后端用 esbuild 预览组件）
```

### 15.2 子项目跨库依赖（DATABASE_URL 直连）

```
investigator.outbox
    ↓ (INVESTIGATOR_DATABASE_URL)
assessor → assessor.outbox
    ↓ (ASSESSOR_DATABASE_URL)
manager

gatherer.outbox
    ↓ (GATHERER_DATABASE_URL)
scholar.entry + scholar.search
    ↓ (SCHOLAR_DATABASE_URL)
assistant.knowledge
```

### 15.3 外部系统集成矩阵

| 外部系统 | 对接子项目 | 集成文件 | 凭证来源 | 桩模式 |
|---|---|---|---|---|
| 飞书开放平台（Bitable + Bot） | investigator | feishu/client.ts | FEISHU_APP_ID/SECRET/BOT | FEISHU_STUB=1 |
| ClawCV 超级简历 API | applicant | clawcv/client.ts + fallback.ts | CLAWCV_API_KEY/BACKEND_URL | 无 Key 自动 fallback LLM → 桩 |
| cybercloud 智能体平台 | assistant | cybercloud.service.ts | CYBERCLOUD_BASE/API_KEY/AGENT_ID/CREDENTIALS | CYBERCLOUD_STUB=1 |
| GitHub REST API（README / 目录 / Issues） | assessor + manager | github/client.ts（两处） | 无 Key（匿名限流） | GITHUB_STUB=1 |
| Docker Hub（pgvector 镜像） | 全平台 | infra/docker-compose.dev.yml | 无 | — |
| 阿里云 ACR（镜像仓库） | 部署 | CI images job + deploy.ps1 | REGISTRY_HOST/USERNAME/PASSWORD（Secrets） | 未配置自动跳过 |
| Obsidian Vault 本地目录 | scholar | obsidian.service.ts | 本地文件系统权限（Vault 路径配置） | — |
| DeepSeek + 智谱 LLM | 8 子项目 llm.ts | model-client client.ts | DEEPSEEK_API_KEY + ZHIPU_API_KEY | MT_LLM_STUB=1 |

---

## 16. 关键决策记录与已知问题

> 📎 **本节主文档为 [docs/memory/state.md](file:///d:/MagicTools/docs/memory/state.md)（AI 即时记忆，每次合入都会追加）。本节是当前版本发布时的**精选快照**，实时性较弱。做新开发前请务必先读 state.md 获取最新状态/进行中任务/新发现的 Bug。**

### 16.1 工程决策（已写入 docs/memory/state.md）

| # | 决策 | 理由 |
|---|---|---|
| 1 | 全栈 TypeScript + 单语言 Monorepo | 降低心智负担、AI 生成代码质量高、包共享便捷 |
| 2 | PostgreSQL 单实例多库（不拆容器） | 个人使用成本最低，outbox 跨库直连无网络开销 |
| 3 | outbox + 轮询（不上 MQ） | 复杂度 0 上线，`SKIP LOCKED` 并发安全，dead 终态防无限重试；量大后可平滑升级 Kafka |
| 4 | 原生 SQL + Zod（不 ORM） | 零黑盒、pgvector/FTS 支持最直接、迁移可控 |
| 5 | LLM 供应商双活（DeepSeek + 智谱） | 一家挂了另一家顶上；统一 client 屏蔽差异 |
| 6 | `parseJson` 四级降级（子项目禁裸 JSON.parse） | LLM 脏输出是常态，集中容错避免 5 处重复修 |
| 7 | 前后台双外壳（UserShell vs AdminShell） | 工具类前台不能长得像后台表格；终端用户体验与管理效率解耦 |
| 8 | Turbo 缓存 + CI 合并重复 build | 32 步 build → 1 步，节省 70%+ 时间 |
| 9 | 四层测试（单元→冒烟→回归→E2E） | 每一层成本/覆盖/反馈速度合理分工；回归层用 turbo --affected 不造轮子 |
| 10 | 0 bug loop（开发 vs 测试分智能体） | 对抗性验收发现隐蔽 Bug；流程纪律仍需加强（目前无落地产物） |
| 11 | 端口唯一来源 infra/ports.yaml | 网关路由、新建子项目、smoke 启动 统一读取；禁止业务代码硬编码端口号 |
| 12 | 部署：单台阿里云 ECS + Docker Compose | 个人使用成本最优；images job 推送 ACR + deploy.ps1 脚本闭环 |

### 16.2 已知问题（docs/memory/state.md 持续更新）

1. **PowerShell 执行策略**：Windows 下 pnpm/npx 必须用 `pnpm.cmd` / `npx.cmd`
2. **网络代理不稳定**：git 推送偶尔失败。**操作要点**：① 必须**同时设置** `http.proxy` **与** `https.proxy`（只配 http 会卡死）；② 完全断网时切换 GitHub API（MCP push_files 分批推送）；③ 本地未装 gh CLI 时，CI check 走 GitHub App pull_request_read(get_check_runs)，日志经 REST 下载。
3. **智谱 API Key 偶发 401**：过期时自动退回 MT_LLM_STUB=1，真实 LLM 功能降级
4. **Node 20 OpenSSL3 PKCS1 限制**：测试避免依赖私钥解密（cybercloud 集成已走 SPKI DER 公钥方案）
5. **子智能体委托不可用**：本地沙箱不支持 subagent_fork，0 bug loop 对抗性验收需外部 CLI 环境
6. **镜像推送需 Secrets**：未配置 REGISTRY_HOST 时 images job 自动跳过（有守卫），首次上线前需手工配置
7. **环境变量加载约定**：本地 `.env` 位于**仓库根**（从 `.env.template` 复制，已 `.gitignore`）；各子项目通过 `@mt/config` 的 `loadRootEnv` 自动向上最多 10 层查找加载，无需手工 export。
8. **Docker 本地说明**：Docker Desktop 引擎需手动启动；本地已验证通过 `pgvector/pgvector:pg16` 容器方案，单实例内含 9 个数据库（8 业务 + mt_test），支持跑全量测试与 smoke，不再是无 DB 环境。
9. **0 bug loop 流程纪律**：开发/测试分拆不同智能体的对抗性验收机制**目前无落地的"测试验收记录"产物**；流程纪律问题非代码可修，需在 Manager 中以任务状态 + PR comment 形式补可追溯证据。

---

## 17. 参考文档索引

> 📎 **本节与 [README.md](file:///d:/MagicTools/README.md) §文档导航 有重合，此处为更细粒度的章节级索引（含外部官方文档）。新增主文档时请两侧同步。**

### 仓库内必读文档

| 文档 | 路径 | 适合场景 |
|---|---|---|
| ✅ AI 入口指令（新会话第一读） | [AGENTS.md](file:///d:/MagicTools/AGENTS.md) | 每次 AI 协作开发启动 |
| ✅ 即时记忆（当前状态/决策/进行中/已知问题） | [docs/memory/state.md](file:///d:/MagicTools/docs/memory/state.md) | 续做任务/了解项目最新进展 |
| 平台顶层设计（MVP 架构 + 子项目边界 + Roadmap） | [docs/superpowers/specs/2026-08-18-magictools-platform-design.md](file:///d:/MagicTools/docs/superpowers/specs/2026-08-18-magictools-platform-design.md) | 新人上手 / 架构评审 |
| 各子项目独立设计文档（共 10 份） | [docs/superpowers/specs/*.md](file:///d:/MagicTools/docs/superpowers/specs/) | 进入具体子项目开发前 |
| 对应实施计划（共 10 份） | [docs/superpowers/plans/*.md](file:///d:/MagicTools/docs/superpowers/plans/) | 开发任务拆解参考 |
| 平台级迭代日志（里程碑级） | [docs/CHANGELOG.md](file:///d:/MagicTools/docs/CHANGELOG.md) | 版本演进 / 回溯决策 |
| UI 规范（设计令牌 + 双外壳 + 8 主题表） | [docs/ui-spec.md](file:///d:/MagicTools/docs/ui-spec.md) | 前端开发必读 |
| Git 工作流 + 分支管理 + 仓库配置 | [docs/git-workflow.md](file:///d:/MagicTools/docs/git-workflow.md) | 新建分支 / 配置 GitHub / PR 前 |
| 端口注册表（唯一来源） | [infra/ports.yaml](file:///d:/MagicTools/infra/ports.yaml) | 启动服务 / 排查连接问题 |
| 外部集成手册（三份） | [docs/integrations/](file:///d:/MagicTools/docs/integrations/) | 配置飞书 / ClawCV / cybercloud |
| Changesets 变更历史（包版本级） | [.changeset/](file:///d:/MagicTools/.changeset/) | 查某次改动具体内容 |
| 精简版项目说明（对外展示） | [README.md](file:///d:/MagicTools/README.md) | 新人快速了解 |

### 外部官方文档

| 组件 | 文档链接 |
|---|---|
| NestJS 10 | https://docs.nestjs.com/ |
| React 18 | https://react.dev/ |
| Ant Design 5 | https://ant.design/docs/react/introduce-cn |
| Vite 5 | https://vitejs.dev/ |
| Turborepo 2 | https://turbo.build/repo/docs |
| Vitest 2 | https://vitest.dev/ |
| Playwright | https://playwright.dev/ |
| PostgreSQL 16 + pgvector | https://www.postgresql.org/docs/16/ + https://github.com/pgvector/pgvector |
| pnpm workspace | https://pnpm.io/workspaces |
| OpenAI Chat Completions（@mt/model-client 协议） | https://platform.openai.com/docs/api-reference/chat |

---

> 📌 本 Code Wiki 为活文档，随代码迭代同步更新。每次合入 main 时，如文档涉及范围有变动（新增公共包/接口/配置项/子项目），请在 PR 中同步修改本文件对应章节，由 review 环节把关一致性。
