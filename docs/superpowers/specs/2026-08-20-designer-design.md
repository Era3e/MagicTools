# Designer（设计师）子系统设计（MVP · 降级版）

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-20
- 状态：🟡 待确认（D1~D4 设计假设待用户确认后改为 ✅）
- 上游：docs/superpowers/specs/2026-08-18-magictools-platform-design.md（5.5 节）；@mt/ui 设计令牌

## 1. 定位

Phase 4 设计师（降级版）：自然语言描述/设计稿图片 → LLM 生成基于 @mt/ui 设计令牌的 React 函数组件源码 → 沙箱预览 → 下载 .tsx → 人工审核「沉淀为组件库」。**不做**：可视化编辑器、拖拽、实时编辑、多页面项目管理（平台设计 Q4 已确认）。

## 2. 功能模块

### 2.1 组件生成
- 输入：自然语言描述（必填）+ 可选设计稿图片（视觉模型识别）
- 输出：完整 React 函数组件源码（使用 @mt/ui tokens，禁止硬编码颜色；可组合 antd 组件）
- LLM 结构化输出：{componentName, description, code}

### 2.2 沙箱预览
- 服务端 esbuild 编译组件源码为浏览器可执行产物 → iframe sandbox 渲染（离线可靠，无 CDN 依赖）
- 预览失败显示编译错误信息

### 2.3 下载
- 导出 .tsx 源码文件下载

### 2.4 沉淀入库
- 「沉淀为组件库」→ 存 components 表（名称/描述/源码/预览快照）→ 组件列表页（查看/下载/删除）
- MVP 不自动写入 @mt/ui 共享包，人工审核后手动迁移（避免污染共享包）

### 2.5 生成历史
- generations 表记录每次生成（输入/输出/状态），支持回看

## 3. 数据模型（PostgreSQL，designer 库）

| 表 | 关键字段 |
|---|---|
| generations | id, prompt, image_url, component_name, code, status(ok/failed), error, created_at |
| components | id, name, description, code, created_at, UNIQUE(name) |

- 数据库自举；designer 库加入 postgres-init.sql

## 4. API 设计（NestJS，前缀 /api/designer）

| 方法/路径 | 说明 |
|---|---|
| POST /generate | 生成组件（{prompt, imageUrl?}）→ {generationId, componentName, code, previewUrl?} |
| POST /preview | 编译预览（{code}）→ {previewId, html} 或编译错误 |
| GET /preview/:id | 取编译产物（供 iframe 加载） |
| GET /generations | 生成历史列表 |
| GET/POST /components | 组件库列表 / 沉淀入库 |
| GET /components/:id/code | 组件源码 |
| DELETE /components/:id | 删除沉淀组件 |

## 5. 技术要点

1. **生成**：@mt/model-client chat + 视觉模型路由（imageUrl 存在时走 visionModel glm-4v-flash）；桩模式返回固定示例组件（MT_LLM_STUB）
2. **编译**：服务端 esbuild（transform API）编译 TSX → IIFE JS + 生成 HTML 壳（内嵌 React/ReactDOM/antd/@mt/ui 的 esm 依赖 → 用 esbuild 一并打包）；产物内存缓存 + 落库 generation
3. **预览隔离**：iframe sandbox="allow-scripts"（禁止同源访问），只加载编译产物
4. **端口**：designer web 4005 / server 5005（已登记）；compose 中 DATABASE_URL 改为 designer 库
5. **CI**：smoke/e2e 接入 designer（MT_LLM_STUB=1）；E2E 全流程（生成→预览→沉淀→列表→删除）

## 6. 待确认设计假设（用户确认后本节改为 ✅）

- **D1（输入形态）**：自然语言 + 可选图片（视觉识别设计稿）都做（推荐）｜备选：MVP 只做自然语言
- **D2（预览方案）**：服务端 esbuild 打包（React+antd+tokens 一并编译成单文件，iframe sandbox 渲染，离线稳定）（推荐）｜备选：iframe 内 CDN React + Babel 浏览器端转译（实现更简但依赖外网）
- **D3（沉淀范围）**：存 designer 库组件表 + 列表页管理，不自动写 @mt/ui 包（推荐）｜备选：直接生成到 @mt/ui 包源码目录
- **D4（生成历史）**：generations 表记录每次生成可回看（推荐）｜备选：不落历史，只保留沉淀组件
