# D-01/D-02/D-09 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Designer 画布工坊（D-01 拖拽编辑 + D-02 双向同步）落地；Assistant LoRA 微调编排层就绪（D-09）。

**Architecture:** Designer web 新增 canvas 纯函数层（schema/codegen）+ StudioPage 三栏画布（dnd-kit）+ CodePanel；designer-server 新增 /parse（@babel/parser 逆向）与 components/generations schema 列。model-client 新增 finetune 客户端（智谱 v4 微调端点，FT_STUB 桩）；assistant-server 新增 finetune.service（门禁 500 样本 + FT_LAUNCH_ENABLED 开关 + finetune_jobs 表）与 IntentLogPage 微调卡。specs：`docs/superpowers/specs/2026-09-10-designer-canvas-design.md`、`2026-09-10-assistant-lora-finetune-design.md`。

**Tech Stack:** React 18 + AntD 5 + @dnd-kit/core/sortable（web）；NestJS 10 + @babel/parser（server）；@mt/model-client + 原生 fetch（finetune）；vitest + Playwright。

**全局约定：**

- 本机 PowerShell：pnpm 一律 `pnpm.cmd`；
- 每任务完成即提交（Conventional Commits 中文 subject 动词开头 ≤50 字）；
- designer web 已装 @dnd-kit/core@6 @dnd-kit/sortable@10（主仓分支）；
- e2e 锚点全部对照组件源码实证（AGENTS.md 硬性约定 8）。

---

## Task 1: canvas schema 纯函数层（web）

**Files:**

- Create: `apps/designer/web/src/canvas/schema.ts`
- Test: `apps/designer/web/src/canvas/schema.test.ts`

- [ ] **Step 1: 写失败测试**：CanvasNode/CanvasDoc 类型 + createNode/findNode/addNode/removeNode/moveNode/updateNodeProps/renameComponent 全行为（嵌套查找、容器限定、不可变性、根不可删/移）。
- [ ] **Step 2: 跑测确认红** → `pnpm.cmd --filter @mt/designer-web test`
- [ ] **Step 3: 实现 schema.ts（纯函数、crypto.randomUUID、不可变更新）**
- [ ] **Step 4: 跑测绿后提交** `feat: 新增画布 schema 纯函数层`

## Task 2: 组件注册表 + codegen（web）

**Files:**

- Create: `apps/designer/web/src/canvas/registry.ts`（纯数据：meta + propFields，8 组件）
- Create: `apps/designer/web/src/canvas/codegen.ts`
- Test: `apps/designer/web/src/canvas/codegen.test.ts`

- [ ] **Step 1: 失败测试**：schemaToCode 三形态（空画布/嵌套容器/全组件）——断言 import 行、export default function、JSX 缩进、tokens.spacing 引用、水平容器 flexDirection row、children 文本转 JSX 文本子。
- [ ] **Step 2: 红 → 实现 registry + codegen → 绿**
- [ ] **Step 3: 提交** `feat: 新增组件注册表与代码生成器`

## Task 3: server /parse 逆向解析（D-02 核心）

**Files:**

- Modify: `apps/designer/server/package.json`（+@babel/parser）
- Create: `apps/designer/server/src/parse.service.ts`、`parse.controller.ts`
- Test: `apps/designer/server/src/parse.service.spec.ts`
- Modify: `apps/designer/server/src/app.module.ts`

- [ ] **Step 1: 失败测试**：合法白名单代码 → doc（组件/props/嵌套/容器 style 枚举还原/children）；未知组件 400、任意 style 键 400、非字面量 prop 400、非 default export 函数 400、语法错误 400（含 line）。
- [ ] **Step 2: 红 → 装 @babel/parser → 实现 parse.service（AST 遍历 + 白名单校验，错误带 reason/line）→ controller POST /parse → app.module 注册**
- [ ] **Step 3: round-trip 断言测试**（server 侧：parse(codegen 形态字符串) 再生成幂等）→ 绿后提交 `feat: 新增代码逆向解析接口`

## Task 4: server schema 列 + repo 扩展

**Files:**

- Create: `apps/designer/server/migrations/002_canvas_schema.sql`
- Modify: `apps/designer/server/src/component.repo.ts`、`generation.repo.ts`、`component.service.ts`、`generate.service.ts`、`schemas.ts`

- [ ] **Step 1: 失败测试**：POST /components 带 schema → GET 回读 schema；GET /generations 带 schema 可空。
- [ ] **Step 2: migration（jsonb 两列 IF NOT EXISTS）→ repo/service/zod 扩展（schema 可选，透传 JSON）→ 绿**
- [ ] **Step 3: 提交** `feat: 组件与生成记录落库画布 schema`

## Task 5: CodePanel + StudioPage 三栏画布（D-01 核心）

**Files:**

- Create: `apps/designer/web/src/pages/studio/CodePanel.tsx`、`CanvasRenderer.tsx`、`Palette.tsx`、`PropForm.tsx`、`StudioPage.tsx`
- Modify: `apps/designer/web/src/App.tsx`（/studio 路由 + USER_NAV「画布工坊」）、`src/api.ts`（parse/addComponent schema）
- Test: `apps/designer/web/src/pages/studio/StudioPage.test.tsx`、`CodePanel.test.tsx`

- [ ] **Step 1: 失败测试（StudioPage）**：palette 分组渲染、双击添加（画布现节点 + 代码面板同步）、选中属性联动（改 children 文本即变）、删除、应用代码流（mock api.parse 成功/失败两态）；CodePanel：未应用徽标、失败保留内容。
- [ ] **Step 2: 红 → 实现五组件**（dnd-kit DndContext/SortableContext/DragOverlay；样式 useTheme+tokens 零硬编码；<920px 响应式折叠）
- [ ] **Step 3: 绿后提交** `feat: 新增画布工坊三栏拖拽编辑页`

## Task 6: GeneratePage 衔接「送入画布」

**Files:**

- Modify: `apps/designer/web/src/pages/GeneratePage.tsx`
- Test: 扩展 `apps/designer/web/src/pages/GeneratePage.test.tsx`（若无则建）

- [ ] **Step 1: 失败测试**：成品区「送入画布」按钮存在；点击 mock parse 成功 → navigate /studio 携 doc；失败 → warning 且不跳转。
- [ ] **Step 2: 实现 → 绿 → 提交** `feat: 生成结果送入画布衔接`

## Task 7: model-client finetune 客户端（D-09）

**Files:**

- Create: `packages/model-client/src/finetune.ts`
- Modify: `packages/model-client/src/index.ts`
- Test: `packages/model-client/src/finetune.test.ts`

- [ ] **Step 1: 失败测试**：FT_STUB 四端点行为；fetch 形态（URL/method/Authorization/multipart 字段/响应解析/非 2xx 抛错含 status）。
- [ ] **Step 2: 红 → 实现（createFinetuneClient + FT_STUB + FT_STUB_STATUS）→ 绿**
- [ ] **Step 3: 提交** `feat: model-client 新增智谱微调客户端`

## Task 8: assistant-server finetune.service + migration 006

**Files:**

- Create: `apps/assistant/server/migrations/006_finetune_jobs.sql`、`src/finetune.repo.ts`、`src/finetune.service.ts`
- Modify: `src/intent-log.controller.ts`、`app.module.ts`
- Test: `src/finetune.service.spec.ts`

- [ ] **Step 1: 失败测试**：launch 全链路（FT_STUB：exportDataset → upload → createJob → 落库 → status 联查刷新）；FT_LAUNCH_ENABLED=0 → 403；真跑 <500 → 409；远端挂 → status 降级 degraded。
- [ ] **Step 2: 红 → 实现（门禁/开关/降级三态）→ controller 两端点 → 绿**
- [ ] **Step 3: 提交** `feat: 意图微调编排服务与任务表`

## Task 9: IntentLogPage 微调卡

**Files:**

- Modify: `apps/assistant/web/src/api.ts`、`src/pages/IntentLogPage.tsx`
- Test: `apps/assistant/web/src/pages/IntentLogPage.finetune.test.tsx`

- [ ] **Step 1: 失败测试**：未就绪态（进度条+disabled）/就绪态/发起调用/任务轮询启停（fake timers）。
- [ ] **Step 2: 实现（MtKpiRow + Progress + 5s 轮询终态停）→ 绿 → 提交** `feat: 意图日志页微调编排卡`

## Task 10: e2e + 视觉基线 + 门禁 + 文档收尾

**Files:**

- Modify: `e2e/tests/designer.spec.ts`、`e2e/fixtures/pages.ts`、`e2e/tests/_visual.spec.ts`（如需 settleMs）
- Modify: docs 收尾五件套 + changeset

- [ ] **Step 1: designer.spec 新用例**（/studio 渲染 / 双击添加副作用 / 属性改文本 / 应用代码流——锚点源码实证）。
- [ ] **Step 2: pages.ts 增 /studio → 清库（TRUNCATE designer 库 components/generations）→ e2e:visual:update 重生成 win32 18 张 → e2e 全量 + responsive 验证。**
- [ ] **Step 3: pnpm.cmd qa:gate 全绿 + smoke 17/17。**
- [ ] **Step 4: 文档收尾**：coverage-matrix 两行（designer canvas 全路径 / assistant finetune 全路径）、mvp-deferred D-01/D-02/D-09 LoRA → ✅（真跑条件写入降级说明）、CHANGELOG 条目、CODE_WIKI §6.5/§6.7 核对补行、changeset（@mt/model-client minor）、state.md 记录。
- [ ] **Step 5: 提交 + 0 bug loop 独立验收 + PR（body 双勾选）。**
