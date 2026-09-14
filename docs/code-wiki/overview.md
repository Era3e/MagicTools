# 项目与架构总览

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 1. 项目概述

> 📎 **本节与 [README.md](../../README.md) 内容重合，为速查摘要版。若子项目列表/技术栈版本变更，请优先修改 README.md，再同步回本节。**

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
2. **唯一入口**：所有外部访问经 gateway 路由，端口唯一来源 [infra/ports.yaml](../../infra/ports.yaml)
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
│  ├─ backup.ps1                             # Node备份CLI薄包装，保留参数与退出码
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
