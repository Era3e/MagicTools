# MagicTools 后台交互说明 · 业务分册

> 适用范围：求职 / 书库 / 助手 / 交付四业务后台（AdminShell 暗色控制台）
> 令牌体系：墨蓝石墨·工房感 v2.2 · AdminPageHead 七槽位契约
> 依据文件：`pages/applicant-admin.html`、`pages/scholar-admin.html`、`pages/assistant-admin.html`、`pages/manager-admin.html`（以下全部交互元素、KPI 数值、表格列、badge tone 映射均提取自实际 HTML 源码）

## 目录

1. [求职后台 · 岗位管理（applicant-admin.html）](#1-求职后台--岗位管理applicant-adminhtml)
2. [书库后台 · 馆藏管理（scholar-admin.html）](#2-书库后台--馆藏管理scholar-adminhtml)
3. [助手后台 · 意图日志（assistant-admin.html）](#3-助手后台--意图日志assistant-adminhtml)
4. [交付后台 · 需求驾驶舱（manager-admin.html）](#4-交付后台--需求驾驶舱manager-adminhtml)
5. [AdminShell 共性交互契约](#adminshell-共性交互契约)
6. [错误态共性规范（AdminShell）](#错误态共性规范adminshell)

---

## 1. 求职后台 · 岗位管理（applicant-admin.html）

### 1.1 页面定位

- 页面角色：招聘管理员的岗位运营控制台，管理在招岗位、投递流水与面试排期。
- 场景：筛选岗位 → 查看投递/面试数量 → 编辑、暂停/启用/重启岗位。
- 导航激活项：`data-nav-key="jobs"`（业务组「岗位管理」），同时控制台组 `overview` 亦带 `data-active="true"`。
- 面包屑：`求职后台 / 岗位管理`。

### 1.2 页面结构

按实际 DOM 顺序：

| 区块 | 选择器 | 说明 |
| --- | --- | --- |
| 布局骨架 | `.as-layout` | flex 双列，左 240px 侧栏 + 右内容列 |
| 侧栏 | `aside.as-sider` | 品牌区 + 导航（`nav.as-nav`）+ 底部快捷出口（`.as-sider-foot`） |
| 顶栏 | `header.as-topbar` | 52px 玻璃拟态（`--mt-header-glass` + `backdrop-blur(8px)`），左面包屑右版本/环境徽标 |
| 页头 | `.as-pagehead` | AdminPageHead 七槽位（eyebrow / title / badges / desc / actions / row 容器 / kpirow） |
| 内容注入位 | `.as-content-body` | 筛选工具栏 `.pg-toolbar` → 岗位表格 `.pg-table-wrap` → 分页条 `.pg-pagination` |

### 1.3 侧栏导航

品牌区：eyebrow `MAGICTOOLS · APPLICANT · CONTROL`，名称 `求职后台`。

| 导航项 | data-nav-key | 激活态 | 分组 | 图标 data-lucide |
| --- | --- | --- | --- | --- |
| 总览 | `overview` | `data-active="true"` | 控制台 | layout-dashboard |
| 系统设置 | `settings` | — | 控制台 | settings |
| 访问日志 | `audit` | — | 控制台 | scroll-text |
| 岗位管理 | `jobs` | `data-active="true"` | 业务 | briefcase |
| 简历池 | `pool` | — | 业务 | file-text |
| 面试日程 | `interview` | — | 业务 | calendar-days |

激活态视觉：`.as-nav-item[data-active="true"]` → 文字提亮至 `--text-strong` + 左侧 2px 琥珀指示条（`box-shadow: inset 2px 0 0 var(--mt-amber-400)`）。悬停：文字 `--text-body` + 背景 `--surface-2`。

### 1.4 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
| --- | --- | --- | --- | --- | --- |
| 1 | 导出 | `.as-page-actions .as-btn-ghost`（icon: download） | 页头次按钮 | 点击导出岗位数据 | 幽灵按钮 hover：背景 surface-2、文字提亮 |
| 2 | 新建岗位 | `.as-page-actions .as-btn-primary`（icon: plus） | 页头主按钮 | 点击打开新建岗位表单 | ink-400 实心，hover 变 ink-300 |
| 3 | 搜索框 | `.pg-search input`（placeholder「搜索岗位名称、负责人…」，icon: search） | 文本输入 | 输入关键词过滤表格 | `:focus-within` 时容器边框变 `--mt-ink-400` |
| 4 | 状态筛选 | `.pg-filter select[aria-label="状态筛选"]`（icon: circle-dot） | 下拉选择 | 选项：全部/在招/暂停/已关闭，按状态过滤 | 原生 select 隐藏箭头（`appearance:none`），option 背景 surface-2 |
| 5 | 部门筛选 | `.pg-filter select[aria-label="部门筛选"]`（icon: building-2） | 下拉选择 | 选项：全部/技术部/产品部/设计部/数据部/运营部 | 同上 |
| 6 | 排序 | `.pg-filter select[aria-label="排序"]`（icon: arrow-down-up） | 下拉选择 | 选项：投递数/发布日期/面试数，重排表格 | 同上 |
| 7 | 行内·编辑 | `tr .pg-action-link`（icon: pencil，文字「编辑」） | 表格操作链接 | 打开岗位编辑 | 链接色 ink-300，hover 提至 ink-400 |
| 8 | 行内·暂停 | `.pg-action-link`（icon: pause，文字「暂停」，仅「在招」行出现） | 表格操作链接 | 暂停该岗位 → 状态徽标转 warning「暂停」 | 同上 |
| 9 | 行内·启用 | `.pg-action-link`（icon: play，文字「启用」，仅「暂停」行出现） | 表格操作链接 | 恢复招聘 → 状态徽标转 success「在招」 | 同上 |
| 10 | 行内·重启 | `.pg-action-link`（icon: rotate-ccw，文字「重启」，仅「已关闭」行出现） | 表格操作链接 | 重启已关闭岗位 | 同上 |
| 11 | 上一页 | `.pg-page--nav[aria-label="上一页"]`（icon: chevron-left） | 分页导航 | 跳转上一页 | hover 背景 surface-2 |
| 12 | 页码 1–5 | `.pg-page`（当前页 `data-active="true"`） | 分页链接 | 切换页码 | 激活页：背景 surface-3 + hairline-strong 描边 + 文字提亮 |
| 13 | 下一页 | `.pg-page--nav[aria-label="下一页"]`（icon: chevron-right） | 分页导航 | 跳转下一页 | 同上一页 |
| 14 | 返回前台 / 返回总览 | `.as-foot-link[data-dom-id="back-front"]` / `[data-dom-id="back-platform"]` | 侧栏底部按钮 | 退出后台 | 见 1.6 |

补充交互态：表格行 `tbody tr:hover` 背景 `--surface-2`（120ms 过渡）；表格容器 `overflow-x:auto`、`min-width:760px` 保证窄屏横向滚动。

### 1.5 数据状态组件

**KPI 读数（.as-kpirow，4 槽）**

| label | 数值 |
| --- | --- |
| 在招岗位 | 42 |
| 今日投递 | 156 |
| 面试安排 | 12 |
| 待筛选简历 | 89 |

数值样式：JetBrains Mono 22px/600、`tabular-nums`；单格 hover 背景 surface-2；格间左发丝线分隔。

**状态徽标 data-tone 语义映射（实际表格行提取）**

| data-tone | 出现文案 | 业务含义 | 暗色呈现 |
| --- | --- | --- | --- |
| success | 服务正常（页头）/ 在招 | 岗位正常招聘 | `--state-success`（success-400）文字 + 同色描边、透明底 |
| warning | 暂停 | 岗位暂停招聘，可「启用」 | `--state-warning`（warning-400） |
| error | 已关闭 | 岗位关闭，仅可「重启」 | `--state-error`（error-400） |

**表格列定义（thead 实际提取，7 列）**：岗位名称 / 部门 / 状态 / 投递数 / 面试数 / 发布日期 / 操作。
列样式：名称列 `.pg-col-name` 加粗提亮；数值列 `.pg-col-num` mono 右对齐；日期列 `.pg-col-mono` mono。

**示例行**：8 行（高级前端工程师、全栈开发工程师、产品经理、用户研究员、数据分析师、UI 设计师、后端架构师、内容运营专员），操作列按状态呈现 编辑+暂停 / 编辑+启用 / 编辑+重启。

**分页信息**：`共 42 条岗位 · 第 1 / 5 页`，页码 1（激活）/ 2 / 3 / 4 / 5。

### 1.6 页面互跳

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
| --- | --- | --- | --- |
| 返回前台 | `data-dom-id="back-front"` | `./applicant-front.html`（求职前台） | `<button>` + JS `location.href` 注入（非 `<a href>`） |
| 返回总览 | `data-dom-id="back-platform"` | `./index.html`（平台应用总览） | `<button>` + JS `location.href` 注入（非 `<a href>`） |

两按钮均为 `<button type="button">`（无 href），跳转由页面末尾 `<script>` 注入：`querySelector('[data-dom-id="back-front"]')` 绑定 click → `location.href = './applicant-front.html'`；`back-platform` 同法指向 `./index.html`。视觉沿用 `.as-foot-link`（mono 11px），hover 文字提亮 + surface-2 背景。

对应求职前台页的「后台管理」按钮（`link-admin` → `./applicant-admin.html`）现指向本页，形成前台 ⇄ 后台双向闭环——详见前台分册对应章节。

### 1.7 可访问性与降级

- `focus-visible`：`.as-nav-item / .as-foot-link / .as-btn` → `outline: 1px solid var(--mt-ink-300); outline-offset: 2px`。
- `prefers-reduced-motion: reduce`：`.as-nav-item, .as-foot-link, .as-btn, .as-badge, .as-kpi` 全部 `transition: none`。
- aria：`nav[aria-label="后台主导航"]`；搜索/筛选图标 `aria-hidden="true"`；三个 select 带 `aria-label`（状态筛选/部门筛选/排序）；分页前后页带 `aria-label`（上一页/下一页）。

### 1.8 响应式行为

- `@media (max-width: 960px)`：KPI 行由 4 列降为 2 列（`grid-template-columns: repeat(2,1fr)`），分隔线改为偶数列左线 + 第 3 项起上边线。
- `@media (max-width: 720px)`：筛选工具栏 padding 收窄至 12px；分页条改纵向排列（`flex-direction: column; align-items: flex-start`）。
- 表格恒定 `min-width: 760px` + 容器横向滚动兜底。

### 1.9 空态与加载态

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 筛选无结果（关键词/状态/部门筛选后命中 0 行） | 岗位表格 `.pg-table-wrap` | 图标 search-x + 标题「没有匹配的岗位」+ 描述「当前筛选条件下没有岗位，试试调整关键词或状态」 | ghost 链接「清除筛选」（与工具栏三组筛选联动重置） |
| 全部岗位已关闭（库内存在数据但无在招岗位，KPI「在招岗位」= 0） | 岗位表格 `.pg-table-wrap` | 图标 briefcase + 标题「当前没有在招岗位」+ 描述「全部岗位均已关闭或暂停，重启岗位后自动恢复展示」 | ghost 按钮「重启已关闭岗位」（icon: rotate-ccw，触发首条已关闭行重启流程） |
| 新系统无岗位数据（首次启用，接口返回空数组） | 岗位表格 `.pg-table-wrap` | 图标 inbox + 标题「还没有任何岗位」+ 描述「创建第一个岗位后，投递与面试数据将在此汇总」 | primary 按钮「新建岗位」（icon: plus，与页头主按钮同构） |

空态行结构（三种通用）：空态行横跨表格全宽，`td colspan="7"`（该页 thead 实际 7 列：岗位名称/部门/状态/投递数/面试数/发布日期/操作），行内水平居中，垂直构成自上而下：

- 图标：data-lucide 图标置于 40px 见方容器内（图标 18px，颜色 `--text-faint`；容器 `--surface-2` 底 + `--mt-hairline` 描边 + `--radius-md`）；
- 标题：`--font-body` 14px / 600 / `--text-strong`，与图标间距 `--space-3`（12px）；
- 描述：`--font-body` 12.5px / `--text-muted`，max-width 320px 居中换行；
- 动作：`as-btn as-btn-ghost` 或 `as-btn as-btn-primary`，与页头「导出 / 新建岗位」按钮语言一致（36px 高、radius-md、13.5px/500）；
- 行内留白：上下 `--space-7`（48px）。

「筛选无结果」与「无数据」两种空态必须区分文案与动作：前者不引导创建（给「清除筛选」链接，链接色 ink-300、hover ink-400），后者才给「新建岗位」primary 按钮；「全部已关闭」为中间态，引导重启而非新建。

#### 加载态（Loading State）

- **表格骨架**：行数与真实示例一致（8 行），每行按 7 列实际结构给骨架块——岗位名称列（文字列）40–70% 宽度块（如 55%），部门列 40% 块，状态列（badge 列）48×22px 圆角块（`--radius-sm`），投递数/面试数（mono 数值列）64px 块右对齐，发布日期（mono 列）64px 块，操作列两个 44×18px 块模拟「编辑 + 暂停」链接位。骨架块统一 `--surface-2` 底 + `--radius-sm`。
- **KPI 骨架**：`.as-kpi-value` 位置放 22px 高、72px 宽骨架块（对齐 mono 22px/600 数字行高），`.as-kpi-label` 位置放 12px 高、56px 宽块；四格等宽、左发丝线分隔保持不变（禁止只骨架其中一格）。KPI 亦可退化为 mono 数字占位「—」（`--text-faint`），二选一，不得混用。
- **shimmer 扫光**：所有骨架块叠加 320ms（`--duration-slow`）`--ease-standard` linear-gradient 扫光（surface-2 → surface-3 → surface-2），同一表格内所有块共享同一相位（用一个覆盖层实现，避免逐块错峰）；**禁止 spinner**。
- **分页条加载中文案**：`.pg-pagination-total` 显示 mono「载入中 · 共 — 条」，页码按钮禁用（opacity .4 + not-allowed）。
- **prefers-reduced-motion**：shimmer 停为静态 surface-2 块，不位移不闪烁；骨架布局保持不变。

#### 文案规范

| 场景 | 标题 | 描述 | 按钮 |
| --- | --- | --- | --- |
| 筛选无结果 | 没有匹配的岗位 | 当前筛选条件下没有岗位，试试调整关键词或状态 | 清除筛选（ghost 链接） |
| 全部岗位已关闭 | 当前没有在招岗位 | 全部岗位均已关闭或暂停，重启岗位后自动恢复展示 | 重启已关闭岗位（ghost） |
| 新系统无岗位数据 | 还没有任何岗位 | 创建第一个岗位后，投递与面试数据将在此汇总 | 新建岗位（primary） |

### 1.10 错误态（Error State）

#### 区域级错误（表格/图表拉取失败）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 岗位表格拉取失败（列表接口 5xx / 网络中断，KPI 接口正常或一并失败） | 岗位表格 `.pg-table-wrap`，整块替换为错误面板（置于 `.as-panel` 内） | 暗色错误面板：`--state-error-bg`（#2f1f1d）底 + 1px `--state-error`（--mt-error-400）描边 + `--radius-md`；内含 cloud-off 图标（18px，色 `--state-error-text`）、标题「岗位列表加载失败」14px/600 `--text-strong`、描述 12.5px `--text-muted` 含 mono 错误码（如 `ERR-API-500`） | `as-btn as-btn-ghost`「重试」（icon: rotate-ccw） |
| 页头 KPI 接口失败（读数接口 5xx / 超时） | 页头 `.as-kpirow` 四格 `.as-kpi-value` | KPI 降级：`.as-kpi-value` 显示 mono「—」（`--text-faint`），不用骨架块（错误期骨架与占位二选一时，错误必选「—」，与 1.9 的 KPI 备选形态同构）；label 保留原文 | 随表格重试联动重拉，KPI 单格不单独给按钮 |

- **表格失败面板策略：整块替换**。失败时 `.pg-table-wrap` 内 thead（7 列表头）与 tbody 一并移除，替换为错误面板（AdminPageHead、`.pg-toolbar` 筛选工具栏与分页条外壳保留但禁用）；不复用空态行结构（`td colspan="7"`），因为错误不是数据语义而是请求语义，空态行会误导屏幕阅读器读出「表内无匹配行」。
- **AdminPageHead 保留**：eyebrow / 标题 / badges（「服务正常」徽标此时应转 error「服务异常」）/ 描述 / 按钮组全部原样保留；页头「导出 / 新建岗位」按钮保持可用（新建不受列表失败影响，导出在列表失败时点击走导出自己的错误路径，见下）。
- **面板内布局**：图标左、文案右（或垂直居中堆叠，与空态行结构同构：40px 图标容器 + 标题 + 描述 + 按钮），行内留白上下 `--space-7`（48px）。

#### 行内/轻量错误

- **行操作失败（暂停/启用/重启）toast**：操作链接点击后接口失败，不弹区域面板、不阻塞表格，反馈走 toast——暗色 toast 规格：`--surface-2` 底 + 左 3px `--state-error` 竖条 + `--radius-md` + `--shadow-2`；文案「岗位暂停失败，请稍后重试」+ mono 错误码（`ERR-API-500`）+ mono 时间戳（如 `14:32:18`）；3s 自动消失。表格该行状态徽标保持原样（warning「暂停」不因失败变已暂停）。
- **导出失败 toast**：页头「导出」点击后导出接口失败/超时，同样走 toast（规格同上），文案「导出任务创建失败」+ 错误码；导出为异步任务创建场景，失败即一次性 toast，不给重试按钮（用户重按导出即重试）。
- **操作列重试链接出现规则**：本页行操作失败不改变操作列内容（失败 toast + 原链接保持可点即天然重试入口）；仅当暂停/启用操作连续失败且服务端返回该行数据冲突（`ERR-CONFLICT-409`）时，操作链接禁用（opacity .4 + not-allowed）并在 toast 文案注明「该岗位已被他人变更，刷新后重试」。

#### 降级与重试策略

- **错误文案三分**：服务端 5xx → 「服务暂时不可用」类文案 + `ERR-API-500`；网络中断/超时 → 「网络连接中断或超时」类文案 + `ERR-NET-TIMEOUT`，可重试；权限 403 → 「没有该操作的访问权限」类文案 + `ERR-AUTH-403`，隐藏「重试」按钮（重试无意义），改为 ghost 链接「联系管理员」。
- **自动重试**：区域级拉取失败自动静默重试 1 次（间隔 800ms）；两次均失败才落错误面板。行操作与导出失败不自动重试（写操作幂等性不保证），只给手动入口。
- **判断顺序：错误 > 空 > 数据**。同一数据区域渲染决策链为：请求失败（且重试耗尽）→ 错误面板；请求成功且返回空 → 空态（1.9）；请求成功有数据 → 数据。禁止把失败结果渲染成空态（共性规范第 6 条的「首次请求失败按空态渲染」仅指无错误面板组件的场景，本节错误面板落地后以错误面板为准）。

#### 文案规范

| 场景 | 标题 | 描述（含错误码） | 按钮 |
| --- | --- | --- | --- |
| 表格拉取失败 | 岗位列表加载失败 | 服务暂时不可用，请稍后重试 · `ERR-API-500` | 重试（ghost，icon: rotate-ccw） |
| 网络中断 | 岗位列表加载失败 | 网络连接中断，请检查网络后重试 · `ERR-NET-TIMEOUT` | 重试（ghost） |
| 行操作失败 toast | —（toast 文案） | 岗位暂停失败，请稍后重试 · `ERR-API-500` · 14:32:18 | —（3s 自动消失） |
| 导出失败 toast | —（toast 文案） | 导出任务创建失败 · `ERR-EXPORT-500` · 14:32:18 | —（3s 自动消失） |

---

## 2. 书库后台 · 馆藏管理（scholar-admin.html）

### 2.1 页面定位

- 页面角色：书库管理员的馆藏运营控制台，管理在册馆藏、来源标签与摘要生成任务。
- 场景：筛选馆藏 → 追踪摘要状态 → 编辑、发起摘要/重摘。
- 导航激活项：`data-nav-key="collection"`（业务组「馆藏管理」），控制台组 `overview` 亦带 `data-active="true"`。
- 面包屑：`书库后台 / 馆藏管理`。

### 2.2 页面结构

与 1.2 同构（`.as-layout` → `.as-sider` / `.as-topbar` / `.as-pagehead` / `.as-content-body`），内容注入位为：筛选工具栏 `.pg-toolbar` → 馆藏表格 `.pg-table-wrap` → 分页条 `.pg-pagination`。

### 2.3 侧栏导航

品牌区：eyebrow `MAGICTOOLS · SCHOLAR · CONTROL`，名称 `书库后台`。

| 导航项 | data-nav-key | 激活态 | 分组 | 图标 data-lucide |
| --- | --- | --- | --- | --- |
| 总览 | `overview` | `data-active="true"` | 控制台 | layout-dashboard |
| 系统设置 | `settings` | — | 控制台 | settings |
| 访问日志 | `audit` | — | 控制台 | scroll-text |
| 馆藏管理 | `collection` | `data-active="true"` | 业务 | book-open |
| 摘要任务 | `summary` | — | 业务 | align-left |
| 图谱节点 | `graph` | — | 业务 | share-2 |

激活态视觉与悬停规则同 1.3（左 2px 琥珀指示条 + 文字提亮）。

### 2.4 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
| --- | --- | --- | --- | --- | --- |
| 1 | 导入 | `.as-page-actions .as-btn-ghost`（icon: upload） | 页头次按钮 | 批量导入馆藏 | 发丝线描边，hover surface-2 |
| 2 | 新建馆藏 | `.as-page-actions .as-btn-primary`（icon: plus） | 页头主按钮 | 新建单条馆藏 | ink-400 实心，hover ink-300 |
| 3 | 搜索框 | `.pg-search input`（placeholder「搜索标题、作者、ISBN…」，icon: search） | 文本输入 | 关键词过滤馆藏表 | `:focus-within` 边框变 ink-400 |
| 4 | 来源筛选 | `.pg-filter select[aria-label="来源筛选"]`（icon: tag） | 下拉选择 | 选项：全部/采集入库/手动录入/API同步 | 原生 select 隐藏箭头 |
| 5 | 类型筛选 | `.pg-filter select[aria-label="类型筛选"]`（icon: layers） | 下拉选择 | 选项：全部/图书/文章/文档/报告 | 同上 |
| 6 | 排序 | `.pg-filter select[aria-label="排序"]`（icon: arrow-down-up） | 下拉选择 | 选项：入库日期/标题/作者 | 同上 |
| 7 | 行内·编辑 | `tr .pg-action-link`（icon: pencil，文字「编辑」） | 表格操作链接 | 打开馆藏编辑 | 链接色 ink-300，hover ink-400 |
| 8 | 行内·摘要 | `.pg-action-link`（icon: sparkles，文字「摘要」，仅「待审摘要」行出现） | 表格操作链接 | 发起摘要生成 → 状态转「已摘要」 | 同上 |
| 9 | 行内·重摘 | `.pg-action-link`（icon: refresh-cw，文字「重摘」，仅「已摘要」行出现） | 表格操作链接 | 重新生成摘要 | 同上 |
| 10 | 上一页 | `.pg-page--nav[aria-label="上一页"]`（icon: chevron-left） | 分页导航 | 跳转上一页 | hover surface-2 |
| 11 | 页码 1–5 | `.pg-page`（当前页 `data-active="true"`） | 分页链接 | 切换页码 | 激活页 surface-3 + 描边提亮 |
| 12 | 下一页 | `.pg-page--nav[aria-label="下一页"]`（icon: chevron-right） | 分页导航 | 跳转下一页 | 同上一页 |
| 13 | 返回前台 / 返回总览 | `.as-foot-link[data-dom-id="back-front"]` / `[data-dom-id="back-platform"]` | 侧栏底部按钮 | 退出后台 | 见 2.6 |

表格行 hover 背景 surface-2；表格 `min-width: 760px` 横向滚动兜底。

### 2.5 数据状态组件

**KPI 读数（.as-kpirow，4 槽）**

| label | 数值 |
| --- | --- |
| 在册馆藏 | 3,284 |
| 今日入库 | 47 |
| 待审摘要 | 23 |
| 图谱节点 | 12,560 |

**状态徽标 data-tone 语义映射（实际表格行提取，本页双徽标列）**

| 列 | data-tone | 出现文案 | 业务含义 |
| --- | --- | --- | --- |
| 来源 | info | 采集入库 / API同步 | 系统自动来源 |
| 来源 | success | 手动录入 | 人工录入来源 |
| 状态 | warning | 待审摘要 | 摘要待生成/待审，操作列给「摘要」 |
| 状态 | success | 已摘要 | 摘要完成，操作列给「重摘」 |
| 页头 | success | 服务正常 | 服务健康 |

**表格列定义（thead 实际提取，7 列）**：标题 / 作者 / 来源 / 类型 / 状态 / 入库日期 / 操作。
列样式：标题列 `.pg-col-name` 加粗；作者列 `.pg-col-author` 静默色不换行；日期列 `.pg-col-mono`。

**示例行**：8 行（设计中的系统方法、用户体验度量、React 并发渲染原理解析、服务端渲染实践指南、设计系统 Token 落地经验、信息架构基础、图数据库与知识图谱、字体排印的微观美学）。

**分页信息**：`共 3,284 条馆藏 · 第 1 / 329 页`，页码 1（激活）/ 2 / 3 / 4 / 5。

### 2.6 页面互跳

| 按钮 | data-dom-id | 图标 | 行为 |
| --- | --- | --- | --- |
| 返回前台 | `back-front` | arrow-left | 回到书库前台应用 |
| 返回总览 | `back-platform` | layout-grid | 回到平台应用总览页 |

### 2.7 可访问性与降级

与 1.7 完全一致（focus-visible outline ink-300 / offset 2px；reduced-motion 禁过渡；nav aria-label、图标 aria-hidden、select aria-label、分页 aria-label）。

### 2.8 响应式行为

与 1.8 一致：960px KPI 4 列 → 2 列；720px 工具栏收窄 + 分页条纵排；表格 min-width 760px 横向滚动。

### 2.9 空态与加载态

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 筛选无结果（关键词/来源/类型筛选后命中 0 行） | 馆藏表格 `.pg-table-wrap` | 图标 search-x + 标题「没有匹配的馆藏」+ 描述「换个关键词，或放宽来源与类型条件再试」 | ghost 链接「清除筛选」（重置搜索框 + 来源/类型/排序三组下拉） |
| 新系统无馆藏数据（接口返回空数组） | 馆藏表格 `.pg-table-wrap` | 图标 book-open + 标题「书库还是空的」+ 描述「手动新建一条馆藏，或从采集源批量导入第一批资料」 | 并排双动作：primary「新建馆藏」（icon: plus）+ ghost「导入」（icon: upload），与页头按钮一一对应 |

空态行结构：空态行横跨表格全宽，`td colspan="7"`（该页 thead 实际 7 列：标题/作者/来源/类型/状态/入库日期/操作），行内水平居中，垂直构成自上而下：

- 图标：data-lucide 图标置于 40px 见方容器内（图标 18px，颜色 `--text-faint`；容器 `--surface-2` 底 + `--mt-hairline` 描边 + `--radius-md`）；
- 标题：`--font-body` 14px / 600 / `--text-strong`；
- 描述：`--font-body` 12.5px / `--text-muted`，max-width 320px 居中换行；
- 动作：`as-btn as-btn-primary`（新建馆藏）与 `as-btn as-btn-ghost`（导入 / 清除筛选），与页头「导入 / 新建馆藏」按钮语言一致；
- 行内留白：上下 `--space-7`（48px）。

「筛选无结果」与「无数据」必须区分：筛空态只给「清除筛选」链接（不引导创建，因数据本就存在）；无数据态给「新建馆藏」primary 按钮 +「导入」ghost 按钮（本页页头恰好双按钮，空态沿用同一对语言）。

#### 加载态（Loading State）

- **表格骨架**：行数与真实示例一致（8 行），每行按 7 列实际结构给骨架块——标题列（文字列）40–70% 宽度块（如 62%），作者列（文字列）45% 块，来源列（badge 列）56×22px 圆角块（`--radius-sm`），类型列 40% 块，状态列（badge 列）64×22px 圆角块（对齐「待审摘要」四字徽标宽度），入库日期（mono 列）64px 块，操作列两个 44×18px 块模拟「编辑 + 摘要/重摘」链接位。骨架块统一 `--surface-2` 底 + `--radius-sm`。
- **摘要任务行内生成中状态**：某行摘要任务运行时，该行状态列徽标由 warning「待审摘要」转为中性加载徽标「摘要生成中…」（badge 结构不变、无 data-tone），操作列「摘要」链接禁用（opacity .4 + not-allowed），并在状态徽标左侧叠加 12px 行内加载指示：一枚 10px 圆环以 320ms（`--duration-slow`）`--ease-standard` 旋转描边（颜色 `--text-muted`）——此为全分册唯一允许的行内微型指示（非整页 spinner）；任务完成后徽标转 success「已摘要」，操作列换「重摘」，行内指示移除。
- **KPI 骨架**：`.as-kpi-value` 位置 22px 高、72px 宽骨架块（对齐「3,284」mono 22px/600 行高），label 位置 12px 高、56px 宽块；「图谱节点 12,560」等长数值格宽度可放宽至 88px。
- **shimmer 扫光**：骨架块统一 320ms（`--duration-slow`）linear-gradient 扫光（surface-2 → surface-3 → surface-2），同相位；**禁止整页 spinner**（行内摘要指示除外）。
- **分页条加载中文案**：`.pg-pagination-total` 显示 mono「载入中 · 共 — 条」，页码链接禁用。
- **prefers-reduced-motion**：shimmer 停为静态 surface-2 块；行内摘要圆环指示降级为静态「…」省略号（badge 文案「摘要生成中」），不旋转。

#### 文案规范

| 场景 | 标题 | 描述 | 按钮 |
| --- | --- | --- | --- |
| 筛选无结果 | 没有匹配的馆藏 | 换个关键词，或放宽来源与类型条件再试 | 清除筛选（ghost 链接） |
| 无馆藏数据 | 书库还是空的 | 手动新建一条馆藏，或从采集源批量导入第一批资料 | 新建馆藏（primary）+ 导入（ghost） |
| 摘要生成中（行内） | —（badge 文案） | 摘要生成中…（徽标内文案，非空态） | —（操作链接禁用） |

### 2.10 错误态（Error State）

#### 区域级错误（表格/图表拉取失败）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 馆藏表格拉取失败（列表接口 5xx / 网络中断） | 馆藏表格 `.pg-table-wrap`，整块替换为错误面板（置于 `.as-panel` 内） | 暗色错误面板：`--state-error-bg`（#2f1f1d）底 + 1px `--state-error`（--mt-error-400）描边 + `--radius-md`；cloud-off 图标（18px，色 `--state-error-text`）、标题「馆藏列表加载失败」14px/600 `--text-strong`、描述 12.5px `--text-muted` 含 mono 错误码（如 `ERR-DB-TIMEOUT`） | `as-btn as-btn-ghost`「重试」（icon: rotate-ccw） |
| KPI 接口失败 | 页头 `.as-kpirow` 四格 `.as-kpi-value` | KPI 降级：mono「—」（`--text-faint`）占位，label 保留（「在册馆藏」「图谱节点」等） | 随表格重试联动重拉 |
| 导入失败（文件级） | 导入流程的文件校验/落库环节，行内错误列表（不弹区域面板） | 文件级错误列表：每条 = alert-triangle 图标（14px，`--state-error`）+ 行号 + 原因（12.5px `--text-muted`），列表整体置于 `--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-md` 的轻量面板内；格式错误给 `ERR-IMPORT-FORMAT`，字段缺失给 `ERR-IMPORT-FIELD`，逐条标 mono 错误码 | ghost 按钮「下载错误报告」+「修正后重新导入」（保持页头「导入」入口不变） |

- **表格失败面板策略：整块替换**（与 1.10 同构）：thead 7 列与 tbody 移除，`.pg-table-wrap` 内渲染错误面板；AdminPageHead、`.pg-toolbar`、分页条外壳保留并禁用。
- **导入失败细分**：文件整体不可读（格式错误，如非 CSV/JSON）→ 单条总错「文件格式不受支持 · `ERR-IMPORT-FORMAT`」；逐行可解析但字段缺失/非法 → 行内列表逐条列「第 N 行：缺少字段『ISBN』· `ERR-IMPORT-FIELD`」，最多展示 10 条，超出部分折叠为「还有 X 条错误，下载报告查看全部」。合法行照常入库，不因部分行失败整批回滚（导入结果 toast 提示「已导入 X 条，失败 Y 条」）。

#### 行内/轻量错误

- **摘要任务失败（badge 行级错误态）**：某行摘要任务生成失败时，该行状态列徽标由 warning「待审摘要」转 error 态——`.as-badge[data-tone="error"]`（描边式：`--state-error` 色边 + 色字 + 透明底），文案「摘要失败」；同时操作列在该行新增「重试」链接（`.pg-action-link`，icon: rotate-ccw，链接色 ink-300、hover ink-400，与「编辑」并排）。重试成功后徽标经「摘要生成中…」行内加载态（2.9）回到 success「已摘要」，「重试」链接随之移除、换回「重摘」。
- **badge error 态规格**：复用共性 `.as-badge[data-tone="error"]`（描边式，透明底），不新增背景填充式变体；「摘要失败」四字徽标宽度与「待审摘要」一致（56–64px），避免列宽跳动。
- **重试链接出现规则**：仅摘要任务失败的行出现「重试」；行内编辑等其他行操作失败一律走 toast（规格同 1.10：`--surface-2` 底 + 左 3px `--state-error` 竖条 + `--radius-md` + `--shadow-2` + mono 时间戳 + 3s 自动消失），不改操作列结构。

#### 降级与重试策略

- **错误文案三分**：服务端 5xx / 数据库超时 → 「服务暂时不可用」+ `ERR-DB-TIMEOUT`；网络中断 → `ERR-NET-TIMEOUT`；权限 403 → `ERR-AUTH-403`，隐藏「重试」、给「联系管理员」ghost 链接（与 1.10 一致）。
- **自动重试**：馆藏列表拉取失败自动静默重试 1 次；摘要任务重试（点「重试」链接）为显式手动动作，不自动重发（LLM 生成任务成本高且需用户确认）。
- **判断顺序：错误 > 空 > 数据**（同 1.10）；注意「摘要生成中…」行内加载态期间发生的失败直接转「摘要失败」badge，不经过空态。

#### 文案规范

| 场景 | 标题/文案 | 描述（含错误码） | 按钮 |
| --- | --- | --- | --- |
| 表格拉取失败 | 馆藏列表加载失败 | 数据库查询超时，请稍后重试 · `ERR-DB-TIMEOUT` | 重试（ghost，icon: rotate-ccw） |
| 摘要任务失败 badge | 摘要失败（badge 文案） | hover title「摘要生成失败 · `ERR-LLM-500`，点击重试重新生成」 | 重试（行内 .pg-action-link） |
| 导入格式错误 | 文件导入失败 | 文件格式不受支持，仅支持 CSV / JSON · `ERR-IMPORT-FORMAT` | 重新选择文件（ghost） |
| 导入字段缺失（行内列表） | 第 3 行：缺少字段「ISBN」 | 第 3 行 · 缺少字段「ISBN」· `ERR-IMPORT-FIELD` | 下载错误报告（ghost 链接） |

---

## 3. 助手后台 · 意图日志（assistant-admin.html）

### 3.1 页面定位

- 页面角色：助手服务的意图质量监控台，观察对话意图分布、模型调用与引用命中。
- 场景：浏览意图分布与混淆矩阵定位误判 → 逐条核查低置信度/拦截日志 → 清理日志。
- 导航激活项：`data-nav-key="intent"`（业务组「意图日志」），控制台组 `overview` 亦带 `data-active="true"`。
- 面包屑：`助手后台 / 意图日志`。

### 3.2 页面结构

| 区块 | 选择器 | 说明 |
| --- | --- | --- |
| 侧栏 / 顶栏 / 页头 | `.as-sider` / `.as-topbar` / `.as-pagehead` | 同共性契约 |
| 双栏分析区 | `.as-grid-2` | `grid-template-columns: 1.15fr 0.85fr`，左意图分布卡、右混淆矩阵卡 |
| 意图分布卡 | `section.as-card[aria-label="意图分布"]` | 卡头（标题 + 副题「今日 · 占比」）+ 堆叠条 + 图例 |
| 混淆矩阵卡 | `section.as-card[aria-label="混淆矩阵"]` | 卡头（副题「行=实际 · 列=预测」）+ 5×5 矩阵 + 注释 |
| 日志区 | `section.as-sec-stack[aria-label="意图日志表"]` | 表格 `.as-table-wrap` + 分页 `.as-pagination` |

本页无筛选工具栏；卡体 `.as-card-body` padding 18px，卡片基类 `.as-card` = surface-1 + 发丝线 + radius-md + shadow-1（单层，禁止嵌套面板）。

### 3.3 侧栏导航

品牌区：eyebrow `MAGICTOOLS · ASSISTANT · CONTROL`，名称 `助手后台`。

| 导航项 | data-nav-key | 激活态 | 分组 | 图标 data-lucide |
| --- | --- | --- | --- | --- |
| 总览 | `overview` | `data-active="true"` | 控制台 | layout-dashboard |
| 系统设置 | `settings` | — | 控制台 | settings |
| 访问日志 | `audit` | — | 控制台 | scroll-text |
| 意图日志 | `intent` | `data-active="true"` | 业务 | git-branch |
| 模型路由 | `routing` | — | 业务 | route |
| 提示词模板 | `prompt` | — | 业务 | file-text |

### 3.4 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
| --- | --- | --- | --- | --- | --- |
| 1 | 导出 | `.as-page-actions .as-btn-ghost`（icon: download） | 页头次按钮 | 导出意图日志 | 发丝线描边，hover surface-2 |
| 2 | 清理日志 | `.as-page-actions .as-btn-primary`（icon: trash-2） | 页头主按钮 | 批量清理过期日志（破坏性动作置于主位） | ink-400 实心，hover ink-300 |
| 3 | 堆叠条分段 ×5 | `.as-bar-track .as-bar-seg`（width 内联控制） | 可悬停数据段 | 悬停查看单项占比 | `filter: brightness(1.15)`；每段带 `title`（如「问答 45%」）原生提示 |
| 4 | 图例项 ×5 | `.as-bar-legend .as-leg-item` | 静态图例 | 色点 + 名称 + mono 数值 | dot 10px radius-sm，数值 `--text-strong` |
| 5 | 矩阵单元 | `.as-matrix .as-mx-cell`（head/rowhead/diad 修饰） | 只读数据格 | 无 | 对角线格 `is-diag`：surface-3 底 + mono 600 提亮 |
| 6 | 日志表格行 | `.as-table tbody tr` | 数据行 | 悬停定位 | hover 背景 surface-2（duration-fast 过渡） |
| 7 | 上一页 | `.as-page-btn`（icon: chevron-left，`disabled`） | 分页按钮 | 跳转上一页 | disabled：opacity .4 + `cursor: not-allowed` |
| 8 | 页码 1/2/3/4/356 | `.as-page-btn`（当前页 `.is-active`） | 分页按钮 | 切换页码；中段以 `…` 省略（`as-page-info` 静态文本） | 激活页 ink-400 实心反白 |
| 9 | 下一页 | `.as-page-btn`（icon: chevron-right） | 分页按钮 | 跳转下一页 | hover 文字提亮 + surface-2 |
| 10 | 返回前台 / 返回总览 | `.as-foot-link[data-dom-id="back-front"]` / `[data-dom-id="back-platform"]` | 侧栏底部按钮 | 退出后台 | 见 3.6 |

本页日志表无行内操作链接（纯监控视图）；分页用 `<button>`（区别于求职/书库的 `<a>` 分页）。

### 3.5 数据状态组件

**KPI 读数（.as-kpirow，4 槽）**

| label | 数值 |
| --- | --- |
| 今日对话 | 2,847 |
| 平均响应 | 1.2s |
| 引用命中率 | 84% |
| 异常拦截 | 23 |

**意图分布堆叠条（.as-bar-track，role="img"，aria-label="意图分布堆叠条"）**
结构：14px 高、radius-sm、surface-3 底轨道，五段 flex 填充；各段百分比与配色（实际提取）：

| 段 | 占比 | 填充色（令牌） |
| --- | --- | --- |
| 问答 | 45% | `--mt-ink-400` |
| 检索 | 28% | `--mt-amber-400` |
| 摘要 | 15% | `--mt-success-400` |
| 翻译 | 8% | `--mt-info-400` |
| 其他 | 4% | `--mt-graphite-400` |

图例（.as-bar-legend，flex-wrap，间距 10px 20px）与上表一一对应：色点 10px + 名称 + `as-leg-val`（mono 600）。

**5×5 混淆矩阵（.as-matrix）**
结构：CSS Grid `96px repeat(5, 1fr)`（720px 断点降为 `70px repeat(5, 1fr)`、字号 11px）；副题「行=实际 · 列=预测」；表头列/行头 surface-2 底、mono 11px；对角线格 `is-diag` 强调。实际数值：

| 实际＼预测 | 问答 | 检索 | 摘要 | 翻译 | 其他 |
| --- | --- | --- | --- | --- | --- |
| 问答 | **1283** | 42 | 18 | 7 | 13 |
| 检索 | 38 | **802** | 25 | 9 | 11 |
| 摘要 | 22 | 31 | **428** | 8 | 6 |
| 翻译 | 9 | 12 | 7 | **228** | 5 |
| 其他 | 15 | 8 | 11 | 6 | **118** |

（加粗为对角线命中格。）矩阵注释（.as-matrix-note）：「对角线为命中样本，整体准确率 **93.2%**（b 标签着 `--state-success`）；主要误判集中在『检索↔摘要』之间。」

**日志表格列定义（thead 实际提取，8 列）**：时间 / 会话 ID / 用户 / 意图 / 置信度 / 模型 / 响应时长 / 状态。
列样式：时间列 `.col-time` mono 静默；会话 ID `.col-mono` mono 提亮（如 `ss-8a3f2c1d`）；置信度 `.col-conf` mono。

**置信度双色规则**：`.as-conf-low`（低置信度，着 `--state-warning`）与 `.as-conf-ok`（正常，着 `--text-strong`）。实际样本：0.94/0.88/0.91/0.96/0.89 为 ok；0.72/0.45/0.51 为 low。

**状态徽标 data-tone 语义映射（实际表格行提取）**

| data-tone | 出现文案 | 业务含义 |
| --- | --- | --- |
| success | 服务正常（页头，带 check-circle-2 图标）/ 完成 | 会话正常应答 |
| warning | 低置信度 / 人工接管 | 置信度不足（<0.75 样本），需人工跟进 |
| error | 拦截 | 异常请求被安全策略拦截 |

**模型字段实际取值**：`deepseek-v3` / `glm-4`（与置信度、时长联动展示）。

**示例行**：8 行（时间 14:32:18 → 14:28:07，会话 ss-8a3f2c1d → ss-1a4d6c8b）。

**分页信息**：`共 2,847 条 · 第 1 / 356 页`；按钮序：上一页(disabled) / 1(active) / 2 / 3 / 4 / … / 356 / 下一页。

### 3.6 页面互跳

| 按钮 | data-dom-id | 图标 | 行为 |
| --- | --- | --- | --- |
| 返回前台 | `back-front` | arrow-left | 回到助手前台应用 |
| 返回总览 | `back-platform` | layout-grid | 回到平台应用总览页 |

### 3.7 可访问性与降级

- 共性 focus-visible / reduced-motion 规则同 1.7。
- 本页补充 aria：堆叠条容器 `role="img" aria-label="意图分布堆叠条"`，各段以 `title` 提供文本替代；意图分布卡 `aria-label="意图分布"`、矩阵卡 `aria-label="混淆矩阵"`、日志区 `aria-label="意图日志表"`。
- 堆叠条降级：段 hover 仅 `brightness` 滤镜变化，无布局位移动画；reduced-motion 下过渡遵循共性禁用规则。

### 3.8 响应式行为

- `@media (max-width: 1100px)`：`.as-grid-2` 双栏并为单栏（`grid-template-columns: 1fr`），两卡纵向堆叠。
- `@media (max-width: 960px)`：KPI 行 4 列 → 2 列（共性规则）。
- `@media (max-width: 720px)`：矩阵行头列 96px → 70px、字号 12.5px → 11px；表格字号 13px → 12px、单元格 padding 收至 9px 10px。

### 3.9 空态与加载态

本页为双卡 + 日志表的三区结构（意图分布卡 / 混淆矩阵卡 / 意图日志表），空态与加载态需分区定义，不得整页一刀切。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 今日无对话数据（聚合接口返回空，堆叠条与矩阵无样本） | 意图分布卡 `.as-card[aria-label="意图分布"]` 卡体 | 图标 message-square-off + 标题「今日暂无意图数据」+ 描述「服务产生对话后，这里会展示意图占比分布」 | ghost 按钮「刷新」（icon: rotate-ccw，重新拉取聚合） |
| 同上（矩阵与分布卡同源） | 混淆矩阵卡 `.as-card[aria-label="混淆矩阵"]` 卡体 | 图标 grid-2x2 + 标题「暂无混淆样本」+ 描述「没有可统计的意图判定记录」 | 无动作（只读卡，依赖左卡刷新） |
| 日志筛选后为空 / 系统无日志 | 日志区 `.as-sec-stack[aria-label="意图日志表"]` 表格 | 图标 scroll-text + 标题「暂无日志记录」/ 描述「当日还没有意图日志，或日志已被清理」 | ghost 链接「清理后请稍候再查」（仅当因「清理日志」动作触发的空态给提示，否则无动作） |

空态行结构（日志表）：空态行横跨表格全宽，`td colspan="8"`（该页 thead 实际 8 列：时间/会话 ID/用户/意图/置信度/模型/响应时长/状态），行内水平居中，垂直构成自上而下：

- 图标：data-lucide 图标置于 40px 见方容器内（图标 18px，颜色 `--text-faint`；容器 `--surface-2` 底 + `--mt-hairline` 描边 + `--radius-md`）；
- 标题：`--font-body` 14px / 600 / `--text-strong`；
- 描述：`--font-body` 12.5px / `--text-muted`，max-width 320px 居中换行；
- 动作：`as-btn as-btn-ghost`，与页头「导出 / 清理日志」按钮语言一致；
- 行内留白：上下 `--space-7`（48px）。

双卡空态不用表格行，改在 `.as-card-body` 内以相同图标/标题/描述垂直居中呈现（卡体高度保持与有数据时一致，min-height 120px），避免两卡塌陷导致 `.as-grid-2` 左右栏错位。

#### 加载态（Loading State）

- **意图分布堆叠条加载态**：无数据期间 `.as-bar-track`（14px 高、radius-sm）整条显示 `--surface-3` 全宽占位（即空轨道本身作为骨架，不另绘分块），`role="img"` 的 `aria-label` 置为「意图分布载入中」；图例区 `.as-bar-legend` 骨架——五个 `.as-leg-item` 位（间距 10px 20px 保持）各放「10px 色点位 + 32×12px 名称块 + 40×12px mono 数值块」，骨架块 `--surface-2` 底 + `--radius-sm`。数据到达后五段按 width 内联渐入（宽度过渡 `--duration-slow` `--ease-standard`），图例色点先于数值块落位。
- **混淆矩阵加载态**：`.as-matrix` 保持 `96px repeat(5, 1fr)` 网格骨架（表头与行头文字可即时渲染，属静态结构），仅 25 个数据格（`.as-mx-cell` 非 head/rowhead）填 100% 宽 × 14px 高骨架块（`--surface-2` 底 + `--radius-sm`）；对角线格 `is-diag` 的 surface-3 强调底在数据落位前不出现，避免误导命中量。矩阵注释 `.as-matrix-note` 放 60% 宽度骨架条。
- **日志表格骨架**：行数与真实示例一致（8 行），每行按 8 列实际结构给骨架块——时间列（`.col-time` mono）56px 块，会话 ID（`.col-mono`）64px 块，用户列（文字列）40% 块，意图列 40% 块，置信度（`.col-conf` mono）40px 块，模型列 56px 块，响应时长（mono）48px 块，状态列（badge 列）48×22px 圆角块。骨架块统一 `--surface-2` 底 + `--radius-sm`。
- **KPI 骨架**：`.as-kpi-value` 位置 22px 高、72px 宽骨架块（对齐「2,847」mono 22px/600 行高，百分比格「84%」可窄至 48px），label 位置 12px 高、56px 宽块；四格左发丝线分隔保持。
- **shimmer 扫光**：全部骨架块统一 320ms（`--duration-slow`）linear-gradient 扫光（surface-2 → surface-3 → surface-2），同相位；**禁止 spinner**（本页监控场景对闪烁敏感，扫光强度低于表格页）。
- **分页条加载中文案**：`.as-page-info` 显示 mono「载入中 · 共 — 条」，页码按钮 `disabled`（opacity .4 + not-allowed）。
- **prefers-reduced-motion**：shimmer 停为静态 surface-2 块；堆叠条占位与矩阵骨架保持静态，分段宽度过渡直接跳变至终值。

#### 文案规范

| 场景 | 标题 | 描述 | 按钮 |
| --- | --- | --- | --- |
| 意图分布空 | 今日暂无意图数据 | 服务产生对话后，这里会展示意图占比分布 | 刷新（ghost） |
| 矩阵空 | 暂无混淆样本 | 没有可统计的意图判定记录 | — |
| 日志空 | 暂无日志记录 | 当日还没有意图日志，或日志已被清理 | 清理后请稍候再查（ghost 链接，条件出现） |

### 3.10 错误态（Error State）

本页为三区结构（意图分布卡 / 混淆矩阵卡 / 日志表），错误态与 3.9 一样分区定义；两卡聚合接口同源，可共用一个失败态也可独立失败，规范按独立失败定义（同源失败时两卡同时落错误占位，视觉一致）。

#### 区域级错误（表格/图表拉取失败）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 意图分布聚合接口失败（5xx / 超时） | 意图分布卡 `section.as-card[aria-label="意图分布"]` 卡体 `.as-card-body` | 错误占位替换堆叠条与图例：`--state-error-bg`（#2f1f1d）底 + 1px `--state-error`（--mt-error-400）描边 + `--radius-md` 的 error 面板；alert-triangle 图标（18px，色 `--state-error-text`）、标题「意图分布加载失败」14px/600 `--text-strong`、描述 12.5px `--text-muted` 含 mono 错误码（`ERR-AGG-500`） | `as-btn as-btn-ghost`「重试」（icon: rotate-ccw，重新拉取聚合） |
| 混淆矩阵聚合接口失败 | 混淆矩阵卡 `section.as-card[aria-label="混淆矩阵"]` 卡体 | 同上规格 error 面板替换矩阵格区域；标题「混淆矩阵加载失败」+ `ERR-AGG-500`；矩阵卡头副题「行=实际 · 列=预测」保留 | 无独立按钮（只读卡，依赖左卡重试联动刷新；两卡同源，左卡重试即双双恢复） |
| 日志查询超时 / 失败 | 日志区 `section.as-sec-stack[aria-label="意图日志表"]` 表格 `.as-table-wrap` | 整块替换为错误面板（置于 `.as-panel` 内）：cloud-off 图标（18px，`--state-error-text`）、标题「日志查询超时」14px/600 `--text-strong`、描述 12.5px `--text-muted` 含 mono 错误码（`ERR-QUERY-TIMEOUT`，mono 呈现）；thead 8 列与 tbody 移除 | `as-btn as-btn-ghost`「重试」（icon: rotate-ccw） |
| KPI 接口失败 | 页头 `.as-kpirow` 四格 `.as-kpi-value` | KPI 降级：mono「—」（`--text-faint`），label 保留（「今日对话」「平均响应」等） | 随卡片/日志重试联动重拉 |

- **双卡错误占位规格**：错误面板置于 `.as-card-body` 内（min-height 与有数据时一致，≥120px，沿用 3.9 双卡防塌陷约束），避免 `.as-grid-2` 左右栏错位；卡头（标题 + 副题）保留不动，只替换卡体内容——与 3.9 空态「双卡不用表格行、卡体内垂直居中」同构。
- **堆叠条区错误面板**：`.as-bar-track` 与 `.as-bar-legend` 一并隐藏，`role="img"` 容器的 `aria-label` 置为「意图分布加载失败」；图例不单独保留残迹。
- **日志表错误面板策略：整块替换**（同 1.10 / 2.10）：thead（8 列）与 tbody 移除，`.as-page-info` 显示 mono「查询失败 · 共 — 条」，页码按钮 disabled。

#### 行内/轻量错误

- **导出失败 toast**：页头「导出」失败走 toast——`--surface-2` 底 + 左 3px `--state-error` 竖条 + `--radius-md` + `--shadow-2`，mono 错误码 + mono 时间戳，3s 自动消失；文案「日志导出失败 · `ERR-EXPORT-500`」。
- **清理日志失败 toast**：页头主按钮「清理日志」（破坏性动作）失败走同规格 toast，文案「清理任务执行失败 · `ERR-CLEAN-500`」；清理成功才触发 3.9 的「清理后请稍候再查」条件空态。
- **badge error 态**：本页日志表状态列已有 `data-tone="error"`「拦截」徽标（安全策略拦截，属业务数据而非请求错误），与错误态共用 `.as-badge[data-tone="error"]` 描边式规格；请求类错误不落日志表行内 badge（行级错误仅在书库摘要场景出现，本页纯监控无行操作）。

#### 降级与重试策略

- **错误文案三分**：聚合 5xx → `ERR-AGG-500`；查询超时 → `ERR-QUERY-TIMEOUT`（本页日志量大、356 页深分页，超时为高频错误，文案给「查询超时，可缩小时间范围后重试」的行动指引）；网络中断 → `ERR-NET-TIMEOUT`；权限 403 → `ERR-AUTH-403` 隐藏重试按钮。
- **自动重试**：双卡聚合与日志查询失败各自动静默重试 1 次（间隔 800ms）；「清理日志」写操作失败不自动重试。
- **判断顺序：错误 > 空 > 数据**（分区独立判定）：左卡失败 + 日志正常时，只左卡落错误占位、日志表照常渲染数据，禁止整页一刀切。

#### 文案规范

| 场景 | 标题 | 描述（含错误码） | 按钮 |
| --- | --- | --- | --- |
| 意图分布失败 | 意图分布加载失败 | 聚合服务暂时不可用，请稍后重试 · `ERR-AGG-500` | 重试（ghost，icon: rotate-ccw） |
| 混淆矩阵失败 | 混淆矩阵加载失败 | 聚合服务暂时不可用，请稍后重试 · `ERR-AGG-500` | —（随左卡重试联动） |
| 日志查询超时 | 日志查询超时 | 查询超时，可缩小时间范围后重试 · `ERR-QUERY-TIMEOUT` | 重试（ghost） |
| 导出失败 toast | —（toast 文案） | 日志导出失败 · `ERR-EXPORT-500` · 14:32:18 | —（3s 自动消失） |

---

## 4. 交付后台 · 需求驾驶舱（manager-admin.html）

### 4.1 页面定位

- 页面角色：交付管理者的需求生命周期驾驶舱，从评审通过跟踪到交付验收。
- 场景：按状态/优先级过滤需求 → 用进度条掌握交付进展 → 编辑/查看详情、处理阻塞。
- 导航激活项：`data-nav-key="requirements"`（业务组「需求管理」），控制台组 `overview` 亦带 `data-active="true"`。
- 面包屑：`交付后台 / 需求管理`（注意：面包屑为「需求管理」，页头标题为「需求驾驶舱」，二者并存于源码）。

### 4.2 页面结构

| 区块 | 选择器 | 说明 |
| --- | --- | --- |
| 侧栏 / 顶栏 / 页头 | `.as-sider` / `.as-topbar` / `.as-pagehead` | 同共性契约 |
| 筛选工具栏 | `.as-toolbar[aria-label="需求筛选"]` | 搜索 + 三组带标签下拉 + 弹性空隙 + 重置按钮 |
| 需求表格 | `.as-table-wrap > table.as-table` | 8 列，含进度条列 |
| 分页条 | `.as-pagination` | button 式分页 |

### 4.3 侧栏导航

品牌区：eyebrow `MAGICTOOLS · MANAGER · CONTROL`，名称 `交付后台`。

| 导航项 | data-nav-key | 激活态 | 分组 | 图标 data-lucide |
| --- | --- | --- | --- | --- |
| 总览 | `overview` | `data-active="true"` | 控制台 | layout-dashboard |
| 系统设置 | `settings` | — | 控制台 | settings |
| 访问日志 | `audit` | — | 控制台 | scroll-text |
| 需求管理 | `requirements` | `data-active="true"` | 业务 | list-checks |
| 迭代排期 | `iteration` | — | 业务 | calendar-range |
| 交付看板 | `board` | — | 业务 | kanban |

### 4.4 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
| --- | --- | --- | --- | --- | --- |
| 1 | 导出 | `.as-page-actions .as-btn-ghost`（icon: download） | 页头次按钮 | 导出需求列表 | 发丝线描边，hover surface-2 |
| 2 | 新建需求 | `.as-page-actions .as-btn-primary`（icon: plus） | 页头主按钮 | 新建需求条目 | ink-400 实心，hover ink-300 |
| 3 | 搜索框 | `.as-search input`（placeholder「搜索需求编号或标题…」，左置 icon: search） | 文本输入 | 按编号/标题过滤 | `:focus` 边框 ink-400 + `--shadow-focus` 外圈（0 0 0 3px rgba(110,139,173,0.4)） |
| 4 | 状态筛选 | `.as-select select`（前置标签 `.as-toolbar-label`「状态」，右置 icon: chevron-down） | 下拉选择 | 选项：全部/待启动/进行中/已交付/已验收 | `:focus` 边框 ink-400 |
| 5 | 优先级筛选 | `.as-select select`（标签「优先级」） | 下拉选择 | 选项：全部/高/中/低 | 同上 |
| 6 | 排序 | `.as-select select`（标签「排序」） | 下拉选择 | 选项：最近更新/优先级/工时 | 同上 |
| 7 | 重置 | `.as-toolbar-gap` 后的 `.as-btn-ghost`（icon: rotate-ccw） | 工具栏次按钮 | 清空全部筛选/排序条件 | hover surface-2 |
| 8 | 行内·编辑 | `tr .as-link-btn`（icon: pencil，文字「编辑」） | 表格操作按钮 | 打开需求编辑 | 描边小按钮：hover 文字提亮 + surface-2 底 + hairline-strong 边框 |
| 9 | 行内·详情 | `tr .as-link-btn`（icon: eye，文字「详情」） | 表格操作按钮 | 查看需求详情页 | 同上 |
| 10 | 进度条（逐行） | `.as-progress`（track + fill + val） | 只读进度指示 | 无点击行为；随数据更新宽度 | fill 宽度过渡 `var(--duration-slow) var(--ease-standard)` |
| 11 | 上一页 | `.as-page-btn`（icon: chevron-left，`disabled`） | 分页按钮 | 跳转上一页 | disabled：opacity .4 + not-allowed |
| 12 | 页码 1/2/3 | `.as-page-btn`（当前页 `.is-active`） | 分页按钮 | 切换页码 | 激活页 ink-400 实心反白 |
| 13 | 下一页 | `.as-page-btn`（icon: chevron-right） | 分页按钮 | 跳转下一页 | hover 文字提亮 + surface-2 |
| 14 | 返回前台 / 返回总览 | `.as-foot-link[data-dom-id="back-front"]` / `[data-dom-id="back-platform"]` | 侧栏底部按钮 | 退出后台 | 见 4.6 |

表格行 hover 背景 surface-2；`.as-link-btn` 为带边框胶囊式操作按钮（padding 4px 8px、radius-sm），比求职/书库的裸链接 `.pg-action-link` 更重一级。

### 4.5 数据状态组件

**KPI 读数（.as-kpirow，4 槽）**

| label | 数值 |
| --- | --- |
| 活跃需求 | 24 |
| 今日交付 | 8 |
| 阻塞项 | 3 |
| 完成率 | 67% |

**优先级 badge 映射（实际表格行提取）**

| data-tone | 出现文案 | 业务含义 |
| --- | --- | --- |
| error | 高 | 高优先级（IT-014 / IT-012 / IT-009） |
| warning | 中 | 中优先级（IT-013 / IT-011 / IT-008） |
| info | 低 | 低优先级（IT-010 / IT-007） |

**状态 badge 映射（实际表格行提取）**

| data-tone | 出现文案 | 业务含义 |
| --- | --- | --- |
| （无 tone，中性） | 待启动 | 尚未开工（IT-011） |
| info | 进行中 | 交付进行中（IT-014 / IT-012 / IT-008） |
| success | 已交付 | 交付完成（IT-013 / IT-007） |
| success | 已验收 | 通过验收（IT-010） |
| error | 阻塞 | 交付受阻（IT-009） |

页头 badges 为双徽标：`success`「服务正常」（check-circle-2 图标）+ 无 tone 中性徽标「IT-014」（hash 图标，定位当前迭代）。

**表格列定义（thead 实际提取，8 列）**：需求编号 / 标题 / 负责人 / 优先级 / 状态 / 工时 / 进度 / 操作。
列样式：编号列 `.col-id` mono 600 着 ink-300（如 `IT-014`）；标题列 `.col-title` 500 提亮；工时列 `.col-hours` mono（如 `32h`）。

**进度条实现（.as-progress，逐行）**
- 结构：`.as-progress`（flex，gap 10px，min-width 120px）= `.as-progress-track`（flex:1、高 6px、radius-sm、背景 `--surface-3`、overflow hidden）+ `.as-progress-fill`（高 100%、radius-sm、背景 `--accent`（暗色即 amber-400）、宽度内联控制、`transition: width var(--duration-slow) var(--ease-standard)`）+ `.as-progress-val`（mono 12px/600、tabular-nums、min-width 34px 右对齐）。
- 实际样本宽度：IT-014 65% / IT-013 100% / IT-012 42% / IT-011 0% / IT-010 100% / IT-009 35% / IT-008 58% / IT-007 100%。

**示例行**：8 行（IT-014 简历解析引擎升级 → IT-007 网关限流策略，负责人覆盖陈思远/林书雅/周明哲/赵雨晴/孙浩然/吴佩玲/郑天佑/王梓涵）。

**分页信息**：`共 24 条 · 第 1 / 3 页`；按钮序：上一页(disabled) / 1(active) / 2 / 3 / 下一页。

### 4.6 页面互跳

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
| --- | --- | --- | --- |
| 返回前台 | `data-dom-id="back-front"` | `./manager-front.html`（交付前台） | `<button>` + JS `location.href` 注入（非 `<a href>`） |
| 返回总览 | `data-dom-id="back-platform"` | `./index.html`（平台应用总览） | `<button>` + JS `location.href` 注入（非 `<a href>`） |

两按钮均为 `<button type="button">`（无 href），跳转由页面末尾 `<script>` 注入：click → `location.href = './manager-front.html'` / `./index.html`。视觉沿用 `.as-foot-link`（mono 11px），hover 文字提亮 + surface-2 背景。

对应交付前台页的「后台管理」按钮（`link-admin` → `./manager-admin.html`）现指向本页，形成前台 ⇄ 后台双向闭环——详见前台分册对应章节。

### 4.7 可访问性与降级

- 共性 focus-visible / reduced-motion 规则同 1.7。
- 本页补充 aria：筛选工具栏容器 `aria-label="需求筛选"`。
- 搜索框 `:focus` 除边框变色外叠加 `--shadow-focus` 聚焦外圈，焦点可见性强于其余三页。
- 进度信息同时以文本呈现（`.as-progress-val` 百分比数字），色觉障碍用户不依赖颜色即可读数。

### 4.8 响应式行为

- `@media (max-width: 960px)`：表格字号 13px → 12px、单元格 padding 收至 9px 10px；进度条 min-width 120px → 80px。
- `@media (max-width: 640px)`：表格容器 `overflow-x: auto`，表格 `min-width: 760px` 横向滚动。
- KPI 行沿用共性 960px 4 列 → 2 列降级。

### 4.9 空态与加载态

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 筛选无结果（编号/标题搜索、状态/优先级筛选后命中 0 行） | 需求表格 `.as-table-wrap` | 图标 search-x + 标题「没有匹配的需求」+ 描述「当前迭代内没有符合条件的需求，调整筛选或点击重置」 | ghost 按钮「重置」（icon: rotate-ccw，与工具栏重置按钮同构同文案，联动清空搜索 + 三组下拉） |
| 当前迭代无需求（IT-014 迭代尚未录入任何条目，接口返回空数组） | 需求表格 `.as-table-wrap` | 图标 list-checks + 标题「本迭代还没有需求」+ 描述「从需求池引入或新建第一条需求，进度将在此跟踪」 | primary 按钮「新建需求」（icon: plus，与页头主按钮同构） |

空态行结构：空态行横跨表格全宽，`td colspan="8"`（该页 thead 实际 8 列：需求编号/标题/负责人/优先级/状态/工时/进度/操作），行内水平居中，垂直构成自上而下：

- 图标：data-lucide 图标置于 40px 见方容器内（图标 18px，颜色 `--text-faint`；容器 `--surface-2` 底 + `--mt-hairline` 描边 + `--radius-md`）；
- 标题：`--font-body` 14px / 600 / `--text-strong`；
- 描述：`--font-body` 12.5px / `--text-muted`，max-width 320px 居中换行；
- 动作：`as-btn as-btn-ghost`（重置）或 `as-btn as-btn-primary`（新建需求），与页头「导出 / 新建需求」按钮语言一致；
- 行内留白：上下 `--space-7`（48px）。

「筛选无结果」与「无数据」必须区分：筛空态复用工具栏既有「重置」语言（ghost 按钮 + rotate-ccw 图标），不引导创建；无数据态才给「新建需求」primary 按钮。

#### 加载态（Loading State）

- **表格骨架**：行数与真实示例一致（8 行），每行按 8 列实际结构给骨架块——需求编号列（`.col-id` mono 600）48px 块，标题列（`.col-title` 文字列）40–70% 宽度块（如 60%），负责人列（文字列）40% 块，优先级列（badge 列）48×22px 圆角块，状态列（badge 列）56×22px 圆角块，工时列（`.col-hours` mono）40px 块，进度列（`.as-progress` 结构位）「flex 轨道位（flex:1）+ 34px 数值位」两个块模拟原有 track+val 结构，操作列两个 48×22px 胶囊块模拟「编辑 / 详情」`.as-link-btn`（radius-sm）。骨架块统一 `--surface-2` 底 + `--radius-sm`。
- **进度条不确定态（进度未知时的加载专用形态）**：当某行需求数据已落位但进度字段未回传（或正在重算）时，`.as-progress-fill` 不渲染百分比宽度，改为 30% 宽流动条纹 pattern——`repeating-linear-gradient(45deg, var(--accent) 0 6px, transparent 6px 12px)` 于 `--accent` 低透明底（opacity .25）之上，以 320ms（`--duration-slow`）`--ease-standard` 无限平移；`.as-progress-val` 显示 mono「…」（`--text-faint`）而非百分比。进度已知后条纹淡出、fill 以 `width var(--duration-slow) var(--ease-standard)` 过渡到实际宽度。该不确定态仅用于加载中的行，禁止用于 0% 需求（0% 仍是确定的：fill 宽 0 + val「0%」，如 IT-011）。
- **KPI 行骨架**：`.as-kpi-value` 位置 22px 高、72px 宽骨架块（「67%」完成率格可窄至 48px），`.as-kpi-label` 位置 12px 高、56px 宽块；四格等宽与左发丝线分隔保持，骨架期间禁用单格 hover 提亮。
- **shimmer 扫光**：骨架块统一 320ms（`--duration-slow`）linear-gradient 扫光（surface-2 → surface-3 → surface-2），同相位；**禁止 spinner**。
- **分页条加载中文案**：`.as-page-info` 显示 mono「载入中 · 共 — 条」，页码按钮 `disabled`（opacity .4 + not-allowed）。
- **prefers-reduced-motion**：shimmer 停为静态 surface-2 块；进度条流动条纹停止平移、定格为静态斜纹（斜纹本身即「进行中、进度未知」的语义载体，无需动画支撑）。

#### 文案规范

| 场景 | 标题 | 描述 | 按钮 |
| --- | --- | --- | --- |
| 筛选无结果 | 没有匹配的需求 | 当前迭代内没有符合条件的需求，调整筛选或点击重置 | 重置（ghost） |
| 本迭代无需求 | 本迭代还没有需求 | 从需求池引入或新建第一条需求，进度将在此跟踪 | 新建需求（primary） |
| 进度未知（行内） | —（val 占位） | …（`.as-progress-val` mono 占位，非空态） | —（行内无操作变化） |

### 4.10 错误态（Error State）

#### 区域级错误（表格/图表拉取失败）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 需求表格拉取失败（列表接口 5xx / 网络中断） | 需求表格 `.as-table-wrap`，整块替换为错误面板（置于 `.as-panel` 内） | 暗色错误面板：`--state-error-bg`（#2f1f1d）底 + 1px `--state-error`（--mt-error-400）描边 + `--radius-md`；cloud-off 图标（18px，色 `--state-error-text`）、标题「需求列表加载失败」14px/600 `--text-strong`、描述 12.5px `--text-muted` 含 mono 错误码（`ERR-API-500`） | `as-btn as-btn-ghost`「重试」（icon: rotate-ccw） |
| KPI 接口失败 | 页头 `.as-kpirow` 四格 `.as-kpi-value` | KPI 降级：mono「—」（`--text-faint`），label 保留（「活跃需求」「完成率」等） | 随表格重试联动重拉 |
| 新建需求提交失败（表单场景错误） | 新建需求表单（页头「新建需求」打开的表单/弹层） | 表单级错误条：`--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-md`，置于表单顶部；alert-triangle 图标（18px，`--state-error-text`）+ 描述含 mono 错误码；字段级错误（如标题缺失）在对应字段下方给 12px `--state-error-text` 行内提示 | 表单不关闭、已填内容保留；错误条内 ghost 链接「重试提交」 |

- **表格失败面板策略：整块替换**（同前三页）：thead（8 列）与 tbody 移除，`.as-table-wrap` 内渲染错误面板；AdminPageHead、`.as-toolbar[aria-label="需求筛选"]`、分页条外壳保留并禁用（重置按钮 disabled，opacity .4 + not-allowed）。
- **表单场景错误细分**：字段校验失败（本地）→ 字段下方行内提示，不发错误码；提交失败（服务端）→ 表单顶部错误条 + `ERR-FORM-500`（5xx）/ `ERR-FORM-CONFLICT`（迭代已归档等业务冲突）；禁止把提交失败做成 toast 后关闭表单（用户已填内容不可丢）。

#### 行内/轻量错误

- **行操作失败 toast**：行内「编辑 / 详情」为只读入口，打开详情失败走 toast——`--surface-2` 底 + 左 3px `--state-error` 竖条 + `--radius-md` + `--shadow-2`，mono 错误码 + mono 时间戳，3s 自动消失；文案「需求详情打开失败 · `ERR-API-500`」。
- **导出失败 toast**：页头「导出」失败走同规格 toast，文案「导出任务创建失败 · `ERR-EXPORT-500`」。
- **进度条「数据不可用」态（区别于 4.9 不确定加载态）**：某行进度字段拉取失败或后端明确无数据（非「正在重算」）时——`.as-progress-fill` 宽 0（track 显示 `--surface-3` 空轨道，无条纹、无动画）、`.as-progress-val` 显示 mono「0%」（`--text-faint`，非「…」）；track 加 `title="进度数据不可用"` 原生提示。与 4.9 的判定对照：进度未知且请求进行中 → 条纹 +「…」（不确定态）；进度字段请求已失败/确认缺失 → 0% + 灰 + title（数据不可用态）；进度已知 0% → fill 宽 0 + val「0%」（正常确定态，如 IT-011）。三者互斥，数据不可用态不参与条纹动画。
- **badge error 态**：本页优先级「高」与状态「阻塞」已用 `.as-badge[data-tone="error"]`（业务数据语义）；请求类错误不落表格行内 badge。

#### 降级与重试策略

- **错误文案三分**：服务端 5xx → `ERR-API-500`；网络中断 → `ERR-NET-TIMEOUT`；权限 403 → `ERR-AUTH-403` 隐藏「重试」、给「联系管理员」ghost 链接。
- **自动重试**：需求列表拉取失败自动静默重试 1 次；新建需求提交失败不自动重试（写操作），保留表单等用户手动「重试提交」。
- **判断顺序：错误 > 空 > 数据**（同前三页）；进度列的行级判定顺序为：错误（数据不可用）> 加载（不确定条纹）> 数据（确定百分比）。

#### 文案规范

| 场景 | 标题 | 描述（含错误码） | 按钮 |
| --- | --- | --- | --- |
| 表格拉取失败 | 需求列表加载失败 | 服务暂时不可用，请稍后重试 · `ERR-API-500` | 重试（ghost，icon: rotate-ccw） |
| 新建需求提交失败（表单错误条） | 提交失败 | 服务暂时不可用，已填内容已保留 · `ERR-FORM-500` | 重试提交（ghost 链接） |
| 新建需求业务冲突 | 提交失败 | 当前迭代已归档，无法新增需求 · `ERR-FORM-CONFLICT` | 联系管理员（ghost 链接） |
| 导出失败 toast | —（toast 文案） | 导出任务创建失败 · `ERR-EXPORT-500` · 14:32:18 | —（3s 自动消失） |
| 进度数据不可用 | —（行内态） | 0% + 灰轨道 + title「进度数据不可用 · `ERR-FIELD-PROGRESS`」 | —（随表格重试联动） |

---

## AdminShell 共性交互契约

以下规则在四个业务后台中完全一致，源自各页共享的 AdminShell 样式块（`as-*`）：

1. **侧栏激活规则**：导航项以 `data-active="true"` 标记；四页均同时激活控制台组 `overview` 与业务组当前项（jobs / collection / intent / requirements）。激活视觉 = 文字提亮至 `--text-strong` + 左侧 2px 琥珀指示条（`inset 2px 0 0 var(--mt-amber-400)`），不使用背景填充；悬停 = 文字 `--text-body` + 背景 `--surface-2`（120ms 过渡）。侧栏固定 240px、`position: sticky`、石墨渐变 `--mt-sider-grad`（#161b24 → #121620 → #0e1218）、右缘发丝线。
2. **顶栏面包屑**：52px 玻璃拟态（`--mt-header-glass` + backdrop-blur 8px）sticky 吸顶；面包屑为 mono 11px，根节点与分隔符「/」着 `--text-faint`，当前页着 `--text-body`；右侧恒定「V2.2」版本号 + 「ENV · PROD」环境徽标（5px 中性灰点，非彩色状态灯）。
3. **AdminPageHead 七槽位**：① eyebrow（mono 11px uppercase，ink-300）→ ② 标题（display 字体 26px）→ ③ badges（状态徽标行，可多枚）→ ④ 描述（muted，max-width 640px）→ ⑤ actions（右侧动作按钮组，flex-end 对齐）→ ⑥ pagehead-row（左右分栏容器，flex-wrap）→ ⑦ kpirow（页头底部 4 格读数行）。页头以底发丝线与内容区分隔。
4. **KPI hover**：`.as-kpi:hover` 背景 `--surface-2`；四格以左发丝线分隔，容器 surface-1 + 发丝线边框 + shadow-1；数值 JetBrains Mono 22px/600 + `tabular-nums`。
5. **按钮语言**：主按钮 `.as-btn-primary` = `--mt-ink-400` 实心（描边同色、文字 `--surface-0`），hover 上浮至 `--mt-ink-300`；次按钮 `.as-btn-ghost` = 透明底 + 发丝线描边，hover 背景 `--surface-2` + 文字提亮。统一 36px 高、radius-md、13.5px/500、图标 15px。琥珀 `--accent` 仅用于进度条填充与侧栏指示条，不用于按钮。
6. **状态徽标**：`.as-badge` 基态 = surface-1 底 + 发丝线 + muted 文字；`data-tone="success|warning|error|info"` 时改为同色文字 + 同色描边 + 透明底（暗色取对应 400 阶语义色）；无 tone 即中性徽标（如「待启动」「IT-014」）。
7. **表格基线**：表头 surface-2 底 + 发丝线；行 hover surface-2；mono 列一律 `tabular-nums`；末行去底边线。
8. **分页两种形态**：链接式（`a.pg-page`，求职/书库；激活 = surface-3 底 + hairline-strong 描边）与按钮式（`button.as-page-btn`，助手/交付；激活 = ink-400 实心反白；`disabled` = opacity .4 + not-allowed），左侧均配 mono 总数读数。
9. **焦点与降级**：可聚焦控件 `:focus-visible` → `outline: 1px solid var(--mt-ink-300); outline-offset: 2px`；`prefers-reduced-motion: reduce` 时 nav/foot/btn/badge/kpi 全部去过渡。
10. **断点阶梯**：1100px（助手页双栏并单栏）→ 960px（KPI 4 列变 2 列；交付页表格缩字号）→ 720px（工具栏收窄、分页纵排、矩阵缩列）→ 640px（交付页表格横向滚动）。表格最小宽 760px 为通用兜底。
11. **侧栏底部返回按钮**：`back-front` / `back-platform` 为 AdminShell 共性出口。实现契约：button + JS 跳转，纯后台应用（gatherer/investigator/assessor）返回前台目标为网关总览。

## 空态与加载态共性规范（AdminShell）

以下规则汇总自四页 1.9 / 2.9 / 3.9 / 4.9，作为 AdminShell 系页面的统一契约：

1. **表格空态 colspan 规则**：空态行必须横跨表格全宽，`colspan` 取该页 thead 实际列数——求职 / 书库 7 列、助手 / 交付 8 列；禁止写死 999 或 100（破坏列宽语义，屏幕阅读器读表时无法归位）。空态行是 tbody 内唯一的行，不与数据行混排。
2. **三种空态类型**：
   - **无数据空**（接口返回空数组）：图标 inbox / book-open / list-checks 等业务语义词，动作给「新建XX」primary 按钮；
   - **筛空**（有数据、筛选后命中 0）：图标 search-x，动作给「清除筛选 / 重置」ghost 链接或按钮，禁止引导创建；
   - **权限空**（当前角色无数据可见权）：图标 lock，标题「暂无可见数据」，无操作按钮（申请权限在系统设置页完成），描述中说明原因。三者文案、图标、动作必须互斥，不得复用。
3. **骨架块令牌**：所有骨架块统一 `--surface-2` 底 + `--radius-sm`；文字列 40–70% 宽度块，badge 列 48×22px 圆角块（四字徽标放宽至 56–64px），mono 列 40–64px 定宽块；shimmer 扫光为 320ms（`--duration-slow`）`--ease-standard` linear-gradient（surface-2 → surface-3 → surface-2），同一容器内所有块共享同一相位；**禁止 spinner**（书库行内摘要微型圆环为唯一例外）。
4. **KPI 骨架**：`.as-kpi-value` 位放 22px 高 × 72px 宽骨架块（对齐 JetBrains Mono 22px/600 行高，短值格可窄至 48px），`.as-kpi-label` 位放 12px 高 × 56px 宽块；四格等宽与左发丝线分隔在骨架期间保持不变（骨架尺寸 = 最终布局尺寸，见第 7 条）；骨架期间禁用 `.as-kpi:hover` 提亮。备选形态为 mono 数字占位「—」（`--text-faint`），一页之内二选一不得混用。
5. **进度条不确定态**：进度未知时 `.as-progress-fill` 不给百分比宽度，改渲染 30% 宽流动条纹 pattern（`repeating-linear-gradient(45deg, var(--accent) 0 6px, transparent 6px 12px)`，底色 `--accent` opacity .25），`.as-progress-val` 置 mono「…」；以 `--duration-slow` `--ease-standard` 无限平移。进度已知（含 0%）一律回到确定态渲染，不得用条纹表达「刚开始」。
6. **加载与空态互斥**：同一数据区域在任一时刻只呈现 骨架 / 空态 / 数据 三者之一；请求进行中显示骨架（即使上一次结果为空），响应到达且为空才切换空态，切换以一次 200ms（`--duration-base`）透明度过渡完成。禁止「空态 + 局部骨架」同屏混排；首次请求失败按空态渲染并给「重试」ghost 按钮，文案注明失败原因。
7. **骨架与最终布局尺寸一致**：骨架行数 = 真实示例行数（四页均为 8 行），骨架块按实际列结构占位（列数、列序、mono/badge 列宽规则见第 3 条），KPI 四格、分页条、卡头等容器高度在骨架期与数据期完全一致——数据落位时零布局位移（无 reflow 跳动），这是 AdminShell 骨架设计的硬约束。
8. **暗色对比度说明**：暗色主题下骨架块取 `--surface-2`（#1e2530，比 `--surface-1` 底 #181d26 亮一级），保证在卡面 / 面板底上有可辨识的明度差；shimmer 高光走 surface-3（#252e3b）而非纯白，避免暗房环境下扫光刺眼。亮色主题下同一 `--surface-2`（#eef1f5）相对白卡面为暗一级，规则同源对称。文本占位「—」用 `--text-faint`，与 `--text-muted` 数据态形成「未就绪 / 已就绪」的可读性梯度。
9. **分页加载读数**：加载中分页总数固定显示 mono「载入中 · 共 — 条」（四页各自的 `.pg-pagination-total` / `.as-page-info`），页码控件 disabled（opacity .4 + not-allowed）；总数回填后一次性更新，不做逐位跳数动画。
10. **降级统一**：`prefers-reduced-motion: reduce` 时 shimmer 停为静态 surface-2 块、条纹定格、圆环改省略号、过渡直接跳变——静态骨架本身即承载「载入中」语义，不依赖任何动画。

## 错误态共性规范（AdminShell）

以下规则汇总自四页 1.10 / 2.10 / 3.10 / 4.10，作为 AdminShell 系页面的统一错误契约：

1. **错误三级体系**（按错误影响面选级，禁止跨级滥用）：
   - **区域级（错误面板）**：数据区拉取/查询失败（表格、双卡图表、聚合接口），整块替换该数据区内容，置于 `.as-panel` 或 `.as-card-body` 内；
   - **行内 toast**：单次动作失败（行操作、导出、清理、表单外提交），不阻塞页面、不改变数据区结构；
   - **badge 行级**：行级异步任务失败（书库摘要任务），落该行状态徽标 + 操作列「重试」链接，唯一场景见 2.10。
2. **暗色错误令牌三件套**：`--state-error` = `--mt-error-400`（#d68a82，描边与图标色）、`--state-error-bg` = #2f1f1d（面板底）、`--state-error-text` = #e0a89f（图标与行内提示文字）；亮色主题沿用亮色锚点（error-600 / error-50 / error-700），规则同源对称。错误面板规格统一：`--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-md`；图标 cloud-off（区域拉取失败）或 alert-triangle（表单/行内校验），18px，色 `--state-error-text`；标题 14px/600 `--text-strong`；描述 12.5px `--text-muted`；重试按钮 `as-btn as-btn-ghost`（icon: rotate-ccw）。
3. **KPI「—」降级**：页头 KPI 接口失败时 `.as-kpi-value` 一律显示 mono「—」（`--text-faint`），四格同批降级、label 保留原文；错误期禁用骨架块（骨架专属于加载期，见空态加载共性规范第 4 条的「二选一」在错误期收敛为「—」）。
4. **badge error 描边式规范**：请求类与业务类错误统一复用 `.as-badge[data-tone="error"]`（`--state-error` 色字 + 同色描边 + 透明底，禁止背景填充式变体）；badge 宽度与该列常态徽标对齐（如「摘要失败」对齐「待审摘要」56–64px），避免列宽跳动。
5. **错误优先级：错误 > 空 > 数据**：同一数据区域任一时刻只呈现 骨架 / 错误 / 空态 / 数据 四者之一；请求失败（且自动重试耗尽）优先落错误面板，禁止把失败渲染成空态或静默清空已有数据。分区页面（助手页三区）按区独立判定，禁止整页一刀切。
6. **重试回骨架**：手动点击「重试」或自动重试触发时，错误面板/「—」占位切回骨架态（空态加载共性规范第 3 条规格），再按结果落 数据 / 空态 / 错误；写操作重试（行操作、表单提交、摘要重试）不回骨架，按钮进入 loading 禁用（opacity .4 + not-allowed）直至响应。
7. **aria-live**：toast 容器与区域级错误面板声明 `aria-live="polite"`（错误不抢占 `assertive`，屏幕阅读器在当前朗读结束后播报）；toast 消失与出现均随容器增删自动播报；行级 badge 错误（「摘要失败」）随表格行刷新，不单独声明 live 区。
8. **错误码命名规范**：`ERR-<域>-<码>`，mono 呈现、全大写——域取 API / DB / NET / AUTH / AGG / QUERY / EXPORT / IMPORT / FORM / LLM / FIELD / CLEAN / CONFLICT，码取 HTTP 语义（500/403/409）或场景词（TIMEOUT/FORMAT/FIELD）；同一错误在面板描述、toast、badge title 中使用同一码，禁止同场景多码。
9. **重试策略统一**：读操作失败自动静默重试 1 次（间隔 800ms），两次均失败才落错误面板；写操作（提交、清理、行状态变更、摘要生成）失败不自动重试，仅给手动入口；权限 403（`ERR-AUTH-403`）一律隐藏「重试」按钮，改「联系管理员」ghost 链接。
10. **toast 暗色规格**：`--surface-2` 底 + 左 3px `--state-error` 竖条 + `--radius-md` + `--shadow-2`；正文 12.5px `--text-muted`，错误码与时间戳 mono（时间戳格式 HH:MM:SS）；3s 自动消失；同屏至多 1 条错误 toast（新错误替换旧 toast，不堆叠）。
