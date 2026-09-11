# D-01/D-02 Designer 画布工坊设计（拖拽编辑 + 双向同步）

> 来源：docs/memory/mvp-deferred.md D-01（可视化拖拽编辑器，P2）/ D-02（实时双向编辑，P2）——MVP 仅交付「自然语言 → 代码 → 预览」单向流水线。
> 状态：已评审（2026-09-10，技术栈 dnd-kit + textarea 用户拍板；双向同步边界 = 生成器确定性单向 + 显式「应用代码」逆向）。

## 1. 背景与目标

### 1.1 现状缺口

- 组件以纯 TSX 字符串（components.code）存储，无结构化 Schema——拖拽编辑无从下手（mvp-deferred D-01 依赖条件明示此缺口）；
- GeneratePage 生成结果只能「重新生成」或手动复制源码修改，无预览↔源码双向编辑（D-02）；
- 全仓零 dnd/编辑器依赖（已实证）。

### 1.2 目标

1. **D-01 拖拽画布**：新页 `/studio` 三栏画布（组件面板 → 拖拽画布 → 属性面板），拖入/选中/改属性/排序/删除，所见即所得；
2. **D-02 双向编辑**：schema→code 生成器实时单向同步 + textarea 编辑源码后显式「应用代码」逆向解析（服务端 @babel/parser）回画布；
3. **闭环衔接**：画布成品可预览（复用 esbuild/iframe 链）、下载、收入馆藏（components 表新增 schema 列）；GeneratePage 生成结果可「送入画布」继续编辑。

### 1.3 非目标（本期不做，见 §9 Backlog）

任意 style 编辑（本期样式收敛为容器 gap/padding/direction 枚举，保 tokens 合规）、撤销/重做、多选、MtKpiRow 等复杂 props 组件、组件树拖拽跨容器移动（v1 仅容器内排序）、协作编辑。

## 2. 核心：Component Schema 抽象

### 2.1 类型定义（`apps/designer/web/src/canvas/schema.ts`）

```ts
export type PropValue = string | number | boolean;

export interface CanvasNode {
  id: string;                          // crypto.randomUUID()
  type: "container" | "antd" | "mtui";
  component: string;                   // "div" | "Typography.Title" | "Button" | "MtStatusTag" ...
  props: Record<string, PropValue>;    // children 为特殊键（文本内容）
  children: CanvasNode[];              // 仅 type=container 可有子节点
}

export interface CanvasDoc {
  componentName: string;               // PascalCase，导出函数名
  description?: string;
  root: CanvasNode;                    // type=container, component="div"
}
```

### 2.2 纯函数集（同文件，全部可单测）

`createNode(type/component)`、`findNode(doc, id)`、`addNode(doc, containerId, node, index?)`、`removeNode(doc, id)`、`moveNode(doc, id, direction: -1|1)`（容器内上下移）、`updateNodeProps(doc, id, patch)`、`renameComponent(doc, name)`——全部返回新 doc（不可变更新）。

### 2.3 组件注册表（`canvas/registry.ts` 纯数据，palette 与渲染单源）

```ts
export interface PropField {
  name: string; label: string;
  type: "text" | "number" | "boolean" | "select";
  options?: { label: string; value: string }[];
}
export interface ComponentMeta {
  key: string; label: string; group: "布局" | "展示" | "交互" | "@mt/ui";
  container?: boolean;                 // 容器型可嵌套 drop
  defaultProps: Record<string, PropValue>;
  propFields: PropField[];
}
```

v1 组件清单（8 项）：

| key | component | 容器 | 关键 props |
|---|---|---|---|
| div | div | ✓ | direction(vertical/horizontal), gap(none/sm/md/lg), padding(none/sm/md/lg) |
| title | Typography.Title | | children, level(1-4) |
| text | Typography.Text | | children, strong |
| button | Button | | children, type(primary/default/dashed/text), block |
| card | Card | ✓ | title |
| statusTag | MtStatusTag | | children, tone(6 语义), emphasis(soft/solid), mono |
| empty | MtEmptyState | | title, description |
| paragraph | Typography.Paragraph | | children |

样式枚举 codegen 时映射 tokens.spacing（gap/padding sm→8 md→16 lg→24；horizontal→flex row），**不开放任意色值/任意 style**——no-hardcoded-colors 门禁天然合规。

## 3. D-01 拖拽画布（StudioPage）

### 3.1 路由与导航

- 前台新页 `/studio`，USER_NAV 增 `{ key: "/studio", label: "画布工坊" }`（置于「定制生成」后）。

### 3.2 布局（三栏，遵循 ui-spec / GALLERY_THEME 墨黑主题）

```
┌ toolbar: 组件名 Input · 描述 Input · [预览] [查看代码] [下载源码] [收入馆藏]
├ palette 232px │ 画布 flex（droppable，点阵底） │ 属性面板 288px
```

- **palette**：分组组件卡（useDraggable，data={meta.key}），拖起显示 DragOverlay 占位卡；双击卡片 = 快捷添加到选中容器（或根）；
- **画布**：CanvasRenderer 递归渲染 doc（React 真渲染即预览）；容器节点套 SortableContext（@dnd-kit/sortable 横/纵排序，direction 感知）；节点 hover 描边 + 选中态 accent 边框 + 悬浮操作条（上移/下移/复制/删除）；palette 拖入容器时 DragOver 判定目标容器与插入位（末位追加）；
- **属性面板**：选中节点渲染 propFields 表单（AntD Form 受控，值 onChange → updateNodeProps → 画布即时重渲）；未选中显示画布说明；
- onDragEnd 全部走 §2.2 纯函数（jsdom 不模拟指针，直接断言状态迁移函数被调用后的 doc 变化）。

### 3.3 响应式

- ≥920px 三栏；<920px palette 变顶部横向滚动条、属性面板折叠为底部区块（同页内 stack，不引 AntD Drawer 保 v1 简单）；画布始终在流内。

## 4. D-02 双向编辑

### 4.1 schema → code（`canvas/codegen.ts`，确定性生成器）

- `schemaToCode(doc): string`——imports 收集（按用到的组件）+ `export default function <componentName>()` + JSX 递归缩进输出；
- 画布任何操作后代码面板同步重生成（单向、无冲突）；
- 容器 style 输出 `{ display: "flex", flexDirection: "column"|"row", gap: tokens.spacing.m, padding: tokens.spacing.m }`（tokens from @mt/ui）。

### 4.2 code → schema（服务端解析，`POST /api/designer/parse`）

- designer-server 新增 parse.controller/service：`@babel/parser` parse(code, { sourceType: "module", plugins: ["jsx", "typescript"] }) → 遍历 JSX tree → 逆向 CanvasDoc；
- **解析白名单**：仅接受注册表组件（§2.3 清单）+ 容器 style 枚举值 + props 值为字面量（StringLiteral/NumericLiteral/JSXExpressionContainer 中的 Boolean/枚举标识符）；越界（未知组件/任意 style/嵌套表达式）返回 400 `{ error, reason, line }` 指明首个不支持点；
- componentName 取 default export 的函数声明名；非函数组件结构（HOC/变量间接导出）→ 400；
- `@babel/parser` 为 designer-server 新增 dependency（纯解析无 transform，体积可控）。

### 4.3 前端代码面板（GeneratePage 与 StudioPage 共用组件 CodePanel）

- 等宽 textarea（JetBrains Mono 栈）+ 行数读数；只读态显示生成器输出，可编辑；
- 编辑过未应用 → 「未应用」徽标 + 「应用代码」按钮高亮；点击 POST /parse：成功 → doc 更新 + 画布刷新 + 徽标清除；失败 → 错误提示（reason/line）且保留编辑内容；
- round-trip 保证：schemaToCode(parse(schemaToCode(doc))) === schemaToCode(doc)（幂等测试锚点）。

### 4.4 GeneratePage 衔接

- 成品区新增「送入画布」按钮：POST /parse 生成结果代码 → 成功携带 doc 跳 `/studio`（state 传递）；失败 message.warning「该组件含画布不支持的语法，请手动修改源码」。

## 5. 数据模型与 API

### 5.1 migration `apps/designer/server/migrations/002_canvas_schema.sql`

```sql
ALTER TABLE components ADD COLUMN IF NOT EXISTS schema jsonb;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS schema jsonb;
```

存量行 schema=NULL 兼容：ComponentList 查看回放时 NULL 走纯代码态；「送入画布」入口对存量组件同样生效（parse 服务端无状态）。

### 5.2 API 变更（designer-server）

| 方法/路径 | 说明 |
|---|---|
| POST /parse（新增） | body `{ code }` → `{ doc }` 或 400 `{ error, reason, line }` |
| POST /components（扩展） | body 增可选 `schema`；repo insert 落 schema 列 |
| GET /components / generations（扩展） | 响应带 schema（可 null） |

预览/下载复用现有 /preview 与前端 blob 下载，零改动。

## 6. 测试策略

### 6.1 web 单测（vitest + RTL）

- `canvas/schema.test.ts`：8 纯函数全行为（增删改移/不可变/children 越界）；
- `canvas/codegen.test.ts`：三形态快照（空画布/嵌套容器/全组件）+ tokens 引用断言；
- `canvas/roundtrip.test.ts`：§4.3 幂等恒等式（对 server parse 的纯前端替代桩：与 server parse.service 同构的 ts 复制不可取——改为 server 测试内嵌同断言，前端 roundtrip 用 mock）；
- `StudioPage.test.tsx`：palette 渲染、双击添加、选中节点属性面板联动（改 children 画布文本即变）、删除节点、代码面板同步（操作后 textarea.value 更新）、应用代码成功流（mock api.parse）；
- `CodePanel.test.tsx`：未应用徽标/失败保留编辑内容。

### 6.2 server 测试（parse.service.spec + component 扩展 e2e）

- parse：白名单全组件 round-trip、未知组件 400、任意 style 400、非字面量 props 400、非函数组件 400、含 tokens 引用的容器 style 正确还原；
- POST /components 带 schema 落库 + GET 回读。

### 6.3 Playwright e2e（designer.spec.ts 增用例，锚点对照源码实证）

- `/studio` 渲染（palette 分组 + 画布空态）；
- 双击 palette 卡片添加 → 副作用：画布出现节点 + 代码面板同步出现 JSX（双击为拖拽的同源兜底路径，v1 同时支持）；
- 属性面板改文本 → 画布文本更新；
- 「应用代码」流：textarea 重输合法代码 → 应用 → 画布更新。

### 6.4 视觉基线与响应式

- pages.ts 增 `/studio`（anchor 定 toolbar 报头文案，实证定稿）→ 基线 17→18 张，本地清库态重生成 win32，合入后 dispatch visual-baseline 重生成 linux；USER_NAV 加项致 front-designer-generate 基线漂移同批重生成；
- responsive.spec 自动纳管。

## 7. 文档与流程收尾

coverage-matrix 补行（StudioPage/canvas/parse 全路径）；mvp-deferred D-01/D-02 → ✅；changeset；CHANGELOG 条目；CODE_WIKI §6.5 Designer 章节核对（页面清单/路由表/API 表补 /studio 与 /parse）；PR body 双勾选。

## 8. 实施边界备注

- dnd-kit 指针交互在 Playwright 有头模式真实可用（dragTo），但画布核心逻辑全部收敛于纯函数 + onDragEnd 适配层——e2e 不依赖指针轨迹；
- palette 卡「双击添加」与拖拽同源（同一 addNode 路径），既是可达性兜底也是测试锚点。

## 9. Backlog（触发条件留档）

| 项 | 说明 | 重启触发 |
|----|------|---------|
| 撤销/重做 | doc 历史栈 | 画布编辑高频使用反馈 |
| 任意 style 编辑 | tokens 白名单外的自定义样式 | ui-spec 开放自定义样式协议时 |
| 跨容器拖拽移动 | 节点 A 容器 → B 容器 | 排序按钮不足时 |
| MtKpiRow 等复杂 props 组件 | 数组型 props 面板 | 注册表 propFields 支持数组类型时 |
| CodeMirror 6 升级 | 语法高亮/折叠 | textarea 编辑体验成为瓶颈时 |

## 10. 验收标准

1. web/server 单测与 e2e 全绿（新用例零静默 skip）；
2. round-trip 幂等恒等式测试通过（双向闭环的数学保证）；
3. qa:gate 全绿；视觉基线 18 张重生成通过；responsive 巡检含新页全绿；
4. smoke 17 服务 PASS；
5. 文档收尾五项完成（§7）。
