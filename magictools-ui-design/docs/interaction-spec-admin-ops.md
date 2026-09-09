# MagicTools 后台交互说明 · 运营分册

> 适用范围：工坊 / 采集 / 调研 / 评审四运营后台（AdminShell 暗色控制台）
> 令牌体系：墨蓝石墨·工房感 v2.2 · AdminPageHead 七槽位契约
> 事实来源：本文档全部交互元素、data 属性、KPI 数值、表格列与示例行均逐条提取自 `pages/` 下四个 HTML 页面的实际代码（designer-admin.html / gatherer-admin.html / investigator-admin.html / assessor-admin.html），未做任何虚构补充。

## 目录

- [1. 工坊后台 · 组件馆藏（designer-admin.html）](#1-工坊后台--组件馆藏designer-adminhtml)
- [2. 采集后台 · 采集源管理（gatherer-admin.html）](#2-采集后台--采集源管理gatherer-adminhtml)
- [3. 调研后台 · 调研管理（investigator-admin.html）](#3-调研后台--调研管理investigator-adminhtml)
- [4. 评审后台 · 评审请求（assessor-admin.html）](#4-评审后台--评审请求assessor-adminhtml)
- [5. AdminShell 共性交互契约](#5-adminshell-共性交互契约)
- [6. 空态与加载态共性规范（AdminShell）](#6-空态与加载态共性规范adminshell)
- [7. 错误态共性规范（AdminShell）](#7-错误态共性规范adminshell)

---

## 1. 工坊后台 · 组件馆藏（designer-admin.html）

### 1.1 页面定位

工坊后台的组件生命周期管理页：以「组件馆藏」表格为核心，覆盖草稿 / 待审 / 已发布 / 已归档四种状态的组件资产，配套筛选工具栏与底部批量发布动作条。页面无分页（以批量动作条收尾），是四页中唯一使用琥珀色 accent 主按钮的页面。

### 1.2 页面结构

按实际 DOM 顺序（`.as-layout` 一栏式双轨布局）：

1. `aside.as-sider` — 240px 吸左侧栏：品牌区（`MAGICTOOLS · DESIGNER · CONTROL` / 工坊后台）→ `nav.as-nav`（aria-label="后台主导航"，两组六项）→ `as-sider-foot`（返回前台 / 返回总览）
2. `header.as-topbar` — 52px 吸顶玻璃顶栏：面包屑「工坊后台 / 组件馆藏」＋右侧 `V2.2` 版本号 ＋ `ENV · PROD` 环境徽标（含 5px 圆点）
3. `main.as-content` —
   - `div.as-pagehead`（AdminPageHead 七槽位，见 §5.3）：eyebrow `ADMIN · COMPONENTS` → 标题「组件馆藏」→ 状态徽标（success「服务正常」，内嵌 `check-circle-2` 12px 图标）→ 描述「管理组件生命周期，从草稿到发布。」→ 右侧动作区（导出 / 发布组件）→ KPI 行 → 底部 hairline 分隔
   - `div.as-content-body` — 筛选工具栏（aria-label="组件筛选"）→ 组件馆藏表格 → 发布动作条（aria-label="批量发布操作"）

### 1.3 侧栏导航

| 导航项 | data-nav-key | 激活态 | 分组 | 图标 data-lucide |
| --- | --- | --- | --- | --- |
| 总览 | `overview` | **data-active="true"** | 控制台 | layout-dashboard |
| 系统设置 | `settings` | — | 控制台 | settings |
| 访问日志 | `audit` | — | 控制台 | scroll-text |
| 组件馆藏 | `components` | **data-active="true"**（本页业务项） | 业务 | package |
| 委托管理 | `commissions` | — | 业务 | inbox |
| 发布历史 | `releases` | — | 业务 | git-commit-horizontal |

> 实际代码中 `overview` 与 `components` 两项**同时**带 `data-active="true"`（总览为控制台常亮锚点，业务项随页面切换），实现时保持该双激活语义。激活态视觉：`.as-nav-item[data-active="true"] { color: var(--text-strong); box-shadow: inset 2px 0 0 var(--mt-amber-400); }` 即左 2px 琥珀指示条 + 文字提亮；hover 态为 `color: var(--text-body); background: var(--surface-2)`，120ms 过渡。

### 1.4 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
| --- | --- | --- | --- | --- | --- |
| 1 | 总览 | `.as-nav-item[data-nav-key="overview"]`（active） | 导航链接 | 点击切换控制台总览 | 同壳内路由；激活琥珀左条 |
| 2 | 系统设置 | `.as-nav-item[data-nav-key="settings"]` | 导航链接 | 点击进入系统设置 | 同壳内路由 |
| 3 | 访问日志 | `.as-nav-item[data-nav-key="audit"]` | 导航链接 | 点击进入访问日志 | 同壳内路由 |
| 4 | 组件馆藏 | `.as-nav-item[data-nav-key="components"]`（active） | 导航链接 | 点击回到本页 | 当前页 |
| 5 | 委托管理 | `.as-nav-item[data-nav-key="commissions"]` | 导航链接 | 点击进入委托管理 | 同壳内路由 |
| 6 | 发布历史 | `.as-nav-item[data-nav-key="releases"]` | 导航链接 | 点击进入发布历史 | 同壳内路由 |
| 7 | 返回前台 | `button.as-foot-link[data-dom-id="back-front"]` | 按钮 | 离开后台返回工坊前台 | `./designer-front.html`（工坊前台；icon: arrow-left；见 1.6） |
| 8 | 返回总览 | `button.as-foot-link[data-dom-id="back-platform"]` | 按钮 | 返回 MagicTools 应用总览 | `./index.html`（应用总览；icon: layout-grid；见 1.6） |
| 9 | 导出 | `.as-page-actions .as-btn-ghost`（icon: download） | ghost 按钮 | 导出当前馆藏清单 | 触发下载/导出任务 |
| 10 | 发布组件 | `.as-page-actions .as-btn-primary`（icon: upload-cloud） | primary 按钮 | 打开组件发布流程 | 进入发布向导/弹层 |
| 11 | 搜索框 | `.as-search input`（placeholder「搜索组件名或分类…」，前置 search 图标） | 文本输入 | 按组件名/分类过滤表格 | 即时过滤列表；focus 时 `border-color: var(--mt-ink-400)` + `--shadow-focus` |
| 12 | 状态筛选 | `.as-select select` 第 1 组（全部/草稿/待审/已发布/已归档） | 下拉选择 | 按状态过滤表格 | 列表刷新 |
| 13 | 分类筛选 | `.as-select select` 第 2 组（全部/通用/表单输入/数据展示/数据可视化/反馈） | 下拉选择 | 按分类过滤 | 列表刷新 |
| 14 | 排序 | `.as-select select` 第 3 组（最近更新/下载量/版本号） | 下拉选择 | 重排表格 | 列表重排 |
| 15 | 重置 | `.as-toolbar .as-btn-ghost`（icon: rotate-ccw） | ghost 按钮 | 清空搜索与筛选 | 恢复默认列表 |
| 16–23 | 行操作「编辑」 | 各行 `a.as-link-btn`（icon: pencil） | 行内链接按钮 | 打开该组件编辑页 | 行 hover `surface-2`；按钮 hover 提亮 + `--mt-hairline-strong` 描边 |
| 17–24 | 行操作「详情」 | 各行 `a.as-link-btn`（icon: eye） | 行内链接按钮 | 打开组件详情 | 同上 |
| 32 | 批量发布 | `.as-actionbar-btns .as-btn-accent`（icon: upload-cloud） | **accent 按钮**（琥珀） | 对已选组件批量发布 | 批量状态流转 |
| 33 | 批量归档 | `.as-actionbar-btns .as-btn-ghost`（icon: archive） | ghost 按钮 | 对已选组件批量归档 | 批量状态流转 |

> 行操作共 8 行 × 2 个（编辑 / 详情）＝16 个；上表 #16–#31 为逐行实例，编号合并表示。全页可交互元素合计 **33 个**（侧栏 8 + 页头 2 + 工具栏 5 + 行操作 16 + 动作条 2）。

### 1.5 数据状态组件

**KPI 读数**（`.as-kpirow` 四联卡，值用 JetBrains Mono 22px tabular-nums）：

| KPI | 数值 |
| --- | --- |
| 在册组件 | 86 |
| 已发布 | 54 |
| 草稿中 | 12 |
| 待审 | 8 |

**组件状态 badge 映射**（`.as-badge[data-tone=…]`，从实际表格行提取）：

| 状态文案 | data-tone | 视觉语义 |
| --- | --- | --- |
| 已发布 | `success` | 描边+文字 `--state-success`（success-400），透明底 |
| 待审 | `warning` | `--state-warning` |
| 草稿 | `info` | `--state-info` |
| 已归档 | 无 tone（默认） | 默认灰：hairline 描边 + `--text-muted` + `surface-1` 底 |

**表格列定义**（实际 `thead`）：组件名 | 分类 | 版本 | 状态 | 最后更新 | 下载量 | 操作。

- 组件名列 `.col-name`：组件图标（`data-lucide` 逐行：square-mouse-pointer / table-2 / calendar-days / bar-chart-3 / upload / panel-right / git-fork / palette）+ 600 字重组件名
- **版本列 `.col-ver`：JetBrains Mono、500 字重、`--text-strong`、`white-space: nowrap`**（如 `v2.4.1`）
- 最后更新列 `.col-date`：mono、`--text-muted`、nowrap（如 `2026-09-06`）
- 下载量列 `.col-dl`：mono、`tabular-nums`（如 `1,284`）
- 表头：mono 11px 大写字距 0.06em（四页中唯一 mono 大写表头）；行 hover `surface-2`，120ms 过渡

**示例行（8 行）**：MtButton v2.4.1 已发布 1,284 ｜ MtTable v1.8.3 已发布 982 ｜ MtDatePicker v0.9.2 待审 0 ｜ MtChart v1.2.0 已发布 567 ｜ MtUpload v0.4.1 草稿 0 ｜ MtDrawer v1.5.0 已发布 743 ｜ MtTimeline v0.8.0 已归档 312 ｜ MtColorPicker v0.6.3 草稿 0。

**特殊组件 — 底部发布动作条**（`.as-actionbar`，aria-label="批量发布操作"）：

- 结构：`surface-2` 底 + `--mt-hairline-strong` 描边 + `--shadow-2` 的全宽条，左信息右按钮
- 信息区 `.as-actionbar-info`：`info` 图标（16px，`--mt-amber-400` 琥珀）＋「已选 **2** 个组件，可批量发布或归档。」（数字为 `b` 标签、mono 600、tabular-nums）
- 按钮区：`批量发布`（**accent 琥珀主按钮**，本页独有，`--accent` 底 `--accent-foreground` 字，hover `--accent-hover`）＋ `批量归档`（ghost）
- 该页无分页条；表格底部即动作条（设计意图：批量操作优先于翻页）

### 1.6 页面互跳

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
| --- | --- | --- | --- |
| 返回前台 | `data-dom-id="back-front"` | `./designer-front.html`（工坊前台） | `<button>` + JS `location.href` 注入（非 `<a href>`） |
| 返回总览 | `data-dom-id="back-platform"` | `./index.html`（MagicTools 应用总览，八应用门户） | `<button>` + JS `location.href` 注入（非 `<a href>`） |

两按钮均为 `<button type="button">`（无 href），跳转由页面末尾 `<script>` 注入：`querySelector('[data-dom-id="back-front"]')` 绑定 click → `location.href = './designer-front.html'`；`back-platform` 同法指向 `./index.html`。视觉沿用 `.as-foot-link`（mono 11px），hover 文字提亮 + surface-2 背景。

对应前台页 designer-front 的「后台管理」按钮（`link-admin` → `./designer-admin.html`）已指向本页，前台 ⇄ 后台双向闭环——详见前台分册对应章节。

### 1.7 可访问性与降级

- `nav.as-nav` 带 `aria-label="后台主导航"`；筛选工具栏带 `aria-label="组件筛选"`；动作条带 `aria-label="批量发布操作"`
- `.as-nav-item / .as-foot-link / .as-btn:focus-visible`：`outline: 1px solid var(--mt-ink-300); outline-offset: 2px`
- 搜索框 focus：`border-color: var(--mt-ink-400)` + `box-shadow: var(--shadow-focus)`（0 0 0 3px rgba(110,139,173,0.4)）
- `@media (prefers-reduced-motion: reduce)`：`.as-nav-item / .as-foot-link / .as-btn / .as-badge / .as-kpi` 全部 `transition: none`
- 图标全部由 lucide `data-lucide` 渲染，按钮文案均配文字（非纯图标）

### 1.8 响应式行为

- `≤960px`：KPI 行 4 列 → 2×2（偶数列补左边框，第 3 项起补上边框）；表格字号降至 12px、单元格 padding 收敛为 9px 10px
- `≤640px`：`.as-table-wrap { overflow-x: auto }` + `.as-table { min-width: 720px }`（横向滚动）；动作条改纵向堆叠 `flex-direction: column; align-items: stretch`，按钮组右对齐

### 1.9 空态与加载态

> 本节为增量交互规格：基于本页既有令牌、表格结构（7 列 / 示例 8 行）与底部动作条推导，静态稿不含空态与骨架实例；共性规则见 §6。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 新工作台无组件（馆藏总数为 0） | 组件馆藏表格 `.as-table-wrap` | 空态行 `td colspan="7"`：图标 `package` + 标题「馆藏空空如也」+ 描述 | `as-btn as-btn-primary`（upload-cloud 图标）「发布组件」，与页头主按钮同目标 |
| 筛选/搜索无结果（条件非空但 0 命中） | 同上 | 空态行 `colspan="7"`：图标 `ghost` + 标题「没有匹配的组件」 | `as-btn as-btn-ghost`（rotate-ccw 图标）「清除筛选」，等价工具栏「重置」 |
| 全部组件已归档（在册组件均处归档态） | 同上 | 空态行 `colspan="7"`：图标 `archive` + 标题「在册组件均已归档」 | `as-btn as-btn-ghost`「查看已归档」（状态筛选切至「已归档」） |

- 空态行横跨表格全宽：`td colspan="7"`（对应 thead 七列：组件名 / 分类 / 版本 / 状态 / 最后更新 / 下载量 / 操作），沿用 `tbody tr:last-child td { border-bottom: none }` 去底边线
- 居中构成：40px 图标容器（`--surface-2` 底 + `--mt-hairline` 描边 + `--radius-md`）内嵌 18px lucide 图标（`--text-faint`）→ 标题（`--font-body` 14px 600 `--text-strong`）→ 描述（12.5px `--text-muted`）→ 动作按钮；整体居中，行内上下留白 `--space-7`
- 筛空与无数据严格区分：筛空只给「清除筛选」ghost 动作（数据仍在，问题在条件）；无数据只给「发布组件」primary 动作（问题在资产），两类动作禁止互换
- 空态出现时底部发布动作条不消失（进入无选中禁用态，见下），保持页面框架稳定

#### 加载态（Loading State）

- 表格骨架：8 行（与本页真实示例行数一致）× 7 列，整体替换 `tbody`，按列结构定宽：
  - 组件名列：16px 图标占位块 + 文字块 45–60%
  - 分类列：文字块 40–50%
  - 版本列（`.col-ver`，mono）：64px
  - 状态列 badge：48 × 22px（对齐 `.as-badge` 实高）
  - 最后更新列（`.col-date`，mono）：64px；下载量列（`.col-dl`，mono）：64px
  - 操作列：两枚 44 × 22px 占位（对齐 `.as-link-btn` 迷你按钮）
- KPI 骨架：`.as-kpi-value` 位为 22px 高 × 72px 宽块，label 位 12px 高 × 56px 宽块；四联卡外框（`--surface-1` + `--mt-hairline` + `--shadow-1`）不变
- **本页专属 — 底部发布动作条无选中禁用态**（`.as-actionbar`，本页独有组件）：表格 0 行勾选时「批量发布」（`.as-btn-accent`）与「批量归档」（`.as-btn-ghost`）进入禁用——`opacity: 0.45` / `cursor: not-allowed` / 移除 hover 背景与描边变化 / 保持 `aria-disabled="true"`；信息区文案由「已选 N 个组件…」切换为「尚未选择组件，在表格中勾选后可批量操作。」（`info` 图标保留 `--mt-amber-400` 琥珀色）
- shimmer 动效：320ms（`--duration-slow`）线性扫过；`@media (prefers-reduced-motion: reduce)` 下停为静态 `--surface-2` 块

#### 文案规范

- 无数据：「馆藏空空如也」/「工作台还没有组件，发布第一个组件开始建设馆藏。」
- 筛空：「没有匹配的组件」/「换个关键词，或清除筛选条件再试一次。」
- 归档空态：「在册组件均已归档」/「所有组件处于归档态，可恢复组件或新建发布。」

### 1.10 错误态（Error State）

> 本节为增量交互规格：基于本页既有令牌、表格结构（7 列 / 示例 8 行）与底部发布动作条（`.as-actionbar`）推导，静态稿不含错误态实例；共性规则见 §7。

#### 区域级错误（表格拉取失败）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 组件馆藏列表拉取失败（网络 / 服务端 5xx / 超时） | 组件馆藏表格 `.as-table-wrap` | 暗色错误面板行 `td colspan="7"`：`--state-error-bg`（#2f1f1d）底 + 1px `--state-error`（--mt-error-400）描边 + `--radius-md`；`alert-triangle` 18px `--state-error-text`；标题 14px 600 `--text-strong`「馆藏加载失败」；描述 12.5px `--text-muted` + mono 错误码 | `as-btn as-btn-ghost`（rotate-ccw 图标）「重试」，等价重新发起列表请求 |
| 页头 KPI 拉取失败 | `.as-kpirow` 四联卡 | KPI 错误降级：`.as-kpi-value` 显 mono「—」（JetBrains Mono 22px、`--text-faint`），label 与四联卡外框不变；不显红色，KPI 失败为静默降级 | 点击任一 KPI 卡（hover surface-2 暗示下钻）进入对应下钻视图后按目标页规则重载 |

- 面板行横跨表格全宽（colspan="7"，对应 thead 七列），居中纵向构成，行内上下留白 `--space-7`；`thead` 与列宽保持不变，错误切换不引起表格横向跳动
- 错误面板出现时底部发布动作条不消失（进入无选中禁用态，沿用 §1.9 规格），页面框架稳定；侧栏 / 顶栏 / AdminPageHead / 工具栏全部原位保留
- 图标二选一：网络类错误（请求未达服务端 / 超时）用 `cloud-off`；服务端 / 业务错误（4xx、5xx）用 `alert-triangle`；实现时按错误码归类

#### 行内/轻量错误

- **批量发布 / 批量归档操作失败**（动作条上反馈）：请求失败时「批量发布」（`.as-btn-accent`）或「批量归档」（`.as-btn-ghost`）按钮短暂（600ms）切换为 1px `--state-error` 描边（文字与图标色不变，透明底不变）后回弹；同时弹错误 toast；**选中态完整保留**（动作条信息区「已选 N 个组件…」不变更），供用户直接重试或转单个操作
- **发布冲突（409 版本冲突）**：行级提示——冲突行「版本」列（`.col-ver`，mono）下方追加 12px `--state-error` 色行内文字「版本已被他人更新」（nowrap 允许换行为两行，不遮蔽相邻列）；操作列追加第四项 `as-action-link`（refresh-cw 图标）「刷新该行」，仅刷新冲突行数据，不整表刷新
- **toast（暗色）**：`--surface-2` 底 + 左 3px `--state-error` 竖条 + 右下 mono 时间戳（HH:MM:SS），标题 13px 600 `--text-strong` + 描述 12.5px `--text-muted` + mono 错误码；`--shadow-2` 浮层、右下角弹出、3s 消失；`prefers-reduced-motion: reduce` 下直接出现/消失不做位移过渡
- 行内错误不整行染红：仅错误信息所在单元格 / 描述行使用 `--state-error` 色文字，行 hover `surface-2` 规则不变

#### 降级与重试策略

- 自动重试：拉取类错误自动重试 2 次（指数退避 1s / 4s），期间表格回 8 行骨架（§6.3）；2 次仍失败才落错误面板
- 手动重试：错误面板「重试」ghost 按钮触发整表骨架 → 重载；409 冲突类错误**不自动重试**，仅引导「刷新该行」
- 判断顺序契约：**错误 > 空 > 数据**——同一数据区域同一时刻只呈现其一（沿用 §6.5 互斥原则扩展）；请求失败永不落入空态（禁止把错误伪装成「馆藏空空如也」）
- KPI 与表格解耦降级：表格失败但 KPI 成功时各自独立表达（表格错误面板 + KPI 正常数值），互不牵连

#### 文案规范

- 列表失败：「馆藏加载失败」/「组件服务暂时不可用，稍后自动重试，或手动重试一次。 `ERR-CMP-503`」
- 批量发布失败（toast）：「批量发布失败」/「2 个组件未发布成功，已保留勾选，可重试。 `ERR-CMP-500`」
- 版本冲突（行级）：「版本已被他人更新」/「该组件已被其他成员发布到新版本，刷新该行后再操作。 `ERR-CMP-409`」

---

## 2. 采集后台 · 采集源管理（gatherer-admin.html）

### 2.1 页面定位

采集后台的核心运维页：管理资料采集源（RSS / 网页 / API / 手动四类）、Cron 定时策略与启停状态，配套失败重试状态展示与标准分页。页面以「启停开关 + Cron mono 展示」为标志性交互。

### 2.2 页面结构

按实际 DOM 顺序：

1. `aside.as-sider` — 品牌区（`MAGICTOOLS · GATHERER · CONTROL` / 采集后台）→ 导航（控制台组 + 业务组）→ 侧栏底部（返回前台 / 返回总览）
2. `header.as-topbar` — 面包屑「采集后台 / 采集源管理」＋ `V2.2` ＋ `ENV · PROD`
3. `main.as-content` —
   - AdminPageHead：eyebrow `ADMIN · SOURCES` → 标题「采集源管理」→ 徽标（success「服务正常」）→ 描述「管理资料采集源、定时任务与入库流水。」→ 动作区（导出 / 新增采集源）→ KPI 行
   - `as-content-body` — 筛选工具栏 → 采集源表格 → 分页条

### 2.3 侧栏导航

| 导航项 | data-nav-key | 激活态 | 分组 | 图标 data-lucide |
| --- | --- | --- | --- | --- |
| 总览 | `overview` | **data-active="true"** | 控制台 | layout-dashboard |
| 系统设置 | `settings` | — | 控制台 | settings |
| 访问日志 | `audit` | — | 控制台 | scroll-text |
| 采集源 | `sources` | **data-active="true"**（本页业务项） | 业务 | database |
| 采集任务 | `tasks` | — | 业务 | list-todo |
| 入库历史 | `history` | — | 业务 | history |

> 同 §1.3：`overview` 与 `sources` 双 `data-active="true"`；激活视觉与 hover 规则同共性契约。

### 2.4 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
| --- | --- | --- | --- | --- | --- |
| 1 | 总览 | `.as-nav-item[data-nav-key="overview"]`（active） | 导航链接 | 切换控制台总览 | 同壳内路由 |
| 2 | 系统设置 | `.as-nav-item[data-nav-key="settings"]` | 导航链接 | 进入系统设置 | 同壳内路由 |
| 3 | 访问日志 | `.as-nav-item[data-nav-key="audit"]` | 导航链接 | 进入访问日志 | 同壳内路由 |
| 4 | 采集源 | `.as-nav-item[data-nav-key="sources"]`（active） | 导航链接 | 回到本页 | 当前页 |
| 5 | 采集任务 | `.as-nav-item[data-nav-key="tasks"]` | 导航链接 | 进入采集任务 | 同壳内路由 |
| 6 | 入库历史 | `.as-nav-item[data-nav-key="history"]` | 导航链接 | 进入入库历史 | 同壳内路由 |
| 7 | 返回前台 | `button.as-foot-link[data-dom-id="back-front"]` | 按钮 | 纯后台应用，回网关总览 | `./index.html`（网关总览；本应用无前台页面；见 2.6） |
| 8 | 返回总览 | `button.as-foot-link[data-dom-id="back-platform"]` | 按钮 | 返回应用总览 | `./index.html`（网关总览；见 2.6） |
| 9 | 导出 | `.as-page-actions .as-btn-ghost`（download） | ghost 按钮 | 导出采集源清单 | 触发下载 |
| 10 | 新增采集源 | `.as-page-actions .as-btn-primary`（plus） | primary 按钮 | 打开新增采集源表单 | 进入新建流程 |
| 11 | 搜索框 | `.as-toolbar-search input`（placeholder「搜索源名称或 URL...」） | 文本输入 | 按名称/URL 过滤 | focus 边框 `--mt-ink-400` |
| 12 | 状态筛选 | `select.as-toolbar-select[aria-label="状态筛选"]`：all 全部状态 / running 运行中 / paused 已暂停 / error 错误 | 下拉选择 | 按运行状态过滤 | 列表刷新 |
| 13 | 类型筛选 | `select.as-toolbar-select[aria-label="类型筛选"]`：all / rss RSS / web 网页 / api API / manual 手动 | 下拉选择 | 按源类型过滤 | 列表刷新 |
| 14 | 排序 | `select.as-toolbar-select[aria-label="排序"]`：updated 最近更新 / name 名称 / count 今日条数 / created 创建时间 | 下拉选择 | 重排表格 | 列表重排 |
| 15–22 | 启停开关 ×8 | `label.as-toggle > input[type="checkbox"]`（title 提示运行中/已暂停/错误） | 纯 CSS 开关 | 切换该源启停 | 见 §2.5 开关规格 |
| 23–46 | 行操作「编辑」×8 | `button.as-action-link`（pencil） | 行内按钮 | 打开源编辑 | hover `--mt-ink-300` 文字 + `surface-3` 底 |
| 24–47 | 行操作「暂停/启用」×8 | `button.as-action-link`（运行中行 icon `pause` 暂停；停止/错误行 icon `play` 启用） | 行内按钮 | 切换运行态（与开关联动） | 行内状态变更 |
| 25–48 | 行操作「日志」×8 | `button.as-action-link`（file-text） | 行内按钮 | 查看该源采集日志 | 进入日志视图 |
| 49 | 上一页 | `.as-page-btn[disabled]`（chevron-left） | 分页按钮 | 首页禁用 | disabled 原生态 |
| 50 | 页码 1 | `.as-page-btn[data-active="true"]` | 分页按钮 | 当前页 | `surface-3` 底 + hairline-strong 描边 + 提亮 |
| 51–53 | 页码 2/3/4 | `.as-page-btn` | 分页按钮 | 翻页 | hover `surface-2` |
| 54 | 下一页 | `.as-page-btn`（chevron-right） | 分页按钮 | 前往第 2 页 | 翻页 |

> 全页可交互元素合计 **52 个**（侧栏 8 + 页头 2 + 工具栏 4 + 开关 8 + 行操作 24 + 分页 6）。

### 2.5 数据状态组件

**KPI 读数**：

| KPI | 数值 |
| --- | --- |
| 活跃采集源 | 32 |
| 今日入库 | 128 |
| 采集任务 | 14 |
| 失败重试 | 3 |

**启停开关（纯 CSS checkbox hack，本页标志组件）**：

- 结构：`label.as-toggle > input[type=checkbox]（absolute、opacity:0、z-index:2、铺满可点） > span.as-toggle-track > span.as-toggle-thumb`
- 尺寸：轨道 38 × 20px（`border-radius: 9999px`），滑块 16 × 16px，`top: 2px; left: 2px`
- 关态：轨道 `background: var(--surface-4)`，滑块 `--text-faint`
- **开态规则**：`input:checked ~ .as-toggle-track { background: var(--state-success) }`，且 `input:checked ~ .as-toggle-track .as-toggle-thumb { transform: translateX(18px); background: var(--surface-0) }` —— 即 success 色轨道 + 滑块右移 18px（贴右侧 2px）变浅色
- 键盘：`input:focus-visible ~ .as-toggle-track { box-shadow: 0 0 0 3px rgba(110,139,173,0.4) }`；过渡 `--duration-fast`（120ms）
- 语义补充：`label` 的 `title` 属性即状态提示（「运行中」「已暂停」「错误」），停止态开关不勾选

**表格列定义**（实际 `thead`）：源名称 | URL | 类型 | 状态 | Cron 表达式 | 最后采集 | 今日条数 | 操作。

- **Cron 表达式列 `.col-mono`：JetBrains Mono 12px、`--mt-ink-300` 色、nowrap**（如 `0 */6 * * *`、`30 8 * * 1-5`；手动源显示「—」）
- URL 列 `.col-url`：mono 12px、`--text-muted`、`max-width: 200px` 超长省略号
- 今日条数列 `.col-count`：mono 600 字重 tabular-nums
- 类型 badge：RSS＝`info`、API＝`success`、网页/手动＝无 tone 默认灰
- **失败重试类状态行**（「新闻聚合源」行）：开关未勾选且 `title="错误"`、最后采集「3 小时前」、今日条数 0 且该单元格内联 `style="color: var(--state-error)"` 以 error 红强调，操作列第二项由「暂停」换为「启用」（play 图标）

**示例行（8 行）**：招聘信息聚合 RSS 运行中 `0 */6 * * *` 24 ｜ 技术博客精选 RSS 运行中 `0 */4 * * *` 18 ｜ 行业报告抓取 网页 已暂停 `0 2 * * *` 0 ｜ 论文数据接口 API 运行中 `0 */2 * * *` 42 ｜ 政策法规监控 网页 运行中 `30 8 * * 1-5` 6 ｜ 手动录入入口 手动 运行中 `—` 3 ｜ 新闻聚合源 RSS **错误** `0 */3 * * *` 0（error 红）｜ 招标公告采集 网页 已暂停 `0 9 * * 1-5` 0。

**分页条**：`.as-pagination-info`「共 32 条 · 第 1 / 4 页」＋ 页码按钮组（chevron-left 禁用 → 1（active）→ 2 → 3 → 4 → chevron-right）。

### 2.6 页面互跳

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
| --- | --- | --- | --- |
| 返回前台 | `data-dom-id="back-front"` | `./index.html`（网关总览——本应用为纯后台，无前台页面） | `<button>` + JS `location.href` 注入（非 `<a href>`） |
| 返回总览 | `data-dom-id="back-platform"` | `./index.html`（网关总览） | `<button>` + JS `location.href` 注入（非 `<a href>`） |
| 入口侧：网关总览应用卡片 | `data-dom-id="card-gatherer"`（`.pg-app-card`） | `./gatherer-admin.html`（本控制台） | 原生 `<a href>` 直连（卡片路由标注「控制台」） |

本页为纯后台应用，无前台页面：「返回前台」目标为网关总览（`./index.html`），与 `back-platform` 同目标但保留两个入口。两按钮均为 `<button type="button">`（无 href），跳转由页面末尾 `<script>` 注入：click → `location.href = './index.html'`。视觉沿用 `.as-foot-link`（mono 11px），hover 文字提亮 + surface-2 背景。

### 2.7 可访问性与降级

- 三个下拉均带 `aria-label`（状态筛选 / 类型筛选 / 排序）；导航带 `aria-label="后台主导航"`
- 开关的真实控件是原生 checkbox（opacity:0 但可聚焦可点击），聚焦环打在轨道上
- 上一页按钮原生 `disabled`，不依赖样式表达禁用
- `prefers-reduced-motion`：`.as-toggle-track / .as-toggle-thumb / .as-action-link / .as-page-btn / 表格行` 过渡全部关闭
- select 使用 `appearance: none` + 内联 SVG 箭头（stroke `#8b98a8`），`option` 显式指定 `background: var(--surface-3)` 防暗色下白底

### 2.8 响应式行为

- `≤960px`：KPI 2×2；工具栏 gap 收敛 8px、搜索框 `flex: 1 1 100%` 独占一行；分页条改纵向 `flex-direction: column; align-items: flex-start`
- 表格常态即 `min-width: 880px` + `overflow-x: auto`（容器横向滚动，窄屏不挤压列）

### 2.9 空态与加载态

> 本节为增量交互规格：基于本页既有令牌、表格结构（8 列 / 示例 8 行）、启停开关与失败行实现推导，静态稿不含空态与骨架实例；共性规则见 §6。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 新系统未配置任何采集源（总数为 0） | 采集源表格 `.as-table-wrap` | 空态行 `td colspan="8"`：图标 `inbox` + 标题「还没有采集源」+ 描述 | `as-btn as-btn-primary`（plus 图标）「新增采集源」，与页头主按钮同目标 |
| 筛选/搜索无结果（条件非空但 0 命中） | 同上 | 空态行 `colspan="8"`：图标 `ghost` + 标题「没有匹配的采集源」 | `as-btn as-btn-ghost`「清除筛选」，等价恢复全部下拉为 all + 清空搜索框 |
| 全部采集源已暂停（存在源但运行中为 0，且用户处于 running 筛选） | 同上 | 空态行 `colspan="8"`：图标 `pause` + 标题「暂无运行中的采集源」 | `as-btn as-btn-ghost`「查看全部源」（状态下拉切回 all） |

- 空态行横跨表格全宽：`td colspan="8"`（对应 thead 八列：源名称 / URL / 类型 / 状态 / Cron 表达式 / 最后采集 / 今日条数 / 操作），沿用末行去底边线规则
- 居中构成：40px 图标容器（`--surface-2` 底 + `--mt-hairline` 描边 + `--radius-md`）内嵌 18px lucide 图标（`--text-faint`）→ 标题（`--font-body` 14px 600 `--text-strong`）→ 描述（12.5px `--text-muted`）→ 动作按钮；整体居中，行内上下留白 `--space-7`
- 新系统引导型空态（首行）描述需承担新手引导职责：「接入 RSS、网页、API 或手动源后，系统将按 Cron 计划自动采集入库。」
- 空态下分页条显示「共 0 条 · 第 1 / 1 页」，全部页码按钮进入禁用（含 chevron-right），沿用 §5.5 分页规格 + 本节禁用规则
- KPI 卡不随表格空态归零（运营指标为系统级），仅同步真实数值

#### 加载态（Loading State）

- 表格骨架：8 行（与本页真实示例行数一致）× 8 列，整体替换 `tbody`，按列结构定宽：
  - 源名称列：文字块 45–55%；URL 列（`.col-url`，mono）：文字块 60%（`max-width: 200px` 省略号位）
  - 类型列 badge：48 × 22px；状态列开关：38 × 20px 圆角占位块（对齐 `.as-toggle` 轨道实尺寸）
  - Cron 表达式列（`.col-mono`）：64px；最后采集列（`.col-time`）：56px；今日条数列（`.col-count`，mono）：32px
  - 操作列：三枚 40 × 22px 占位（对齐「编辑 / 暂停·启用 / 日志」三个 `.as-action-link`）
- KPI 骨架：`.as-kpi-value` 位为 22px 高 × 72px 宽块；label 位 12px 高 × 56px 宽块
- **本页专属 — 采集任务运行中的行内状态**（行级「列级加载」，不整表刷新）：某源触发采集后仅该行「最后采集」列与「今日条数」列进入运行态——
  - 「最后采集」列显示进行中 mono 文案「采集中…」：`--font-mono` 12px、`--mt-ink-300`、`nowrap`，与该列常态 `.col-time` 规格一致（12px `--text-muted`），进行中态提亮为 info 色以示活跃
  - 「今日条数」列显示骨架块 32 × 14px（shimmer 320ms），替代旧计数；完成后回写实际条数并恢复 `--text-strong` mono 600 字重
  - 运行期间该行开关保持 checked 与 `title="运行中"`；「暂停」操作链接进入禁用（`opacity: 0.45` / `cursor: not-allowed` / 去 hover / `aria-disabled="true"`），防运行中被误停
- **本页专属 — 采集失败的行级 error 态**（从实际 HTML「新闻聚合源」行提取并扩展）：失败行呈现为——开关未勾选且 `label.as-toggle` `title="错误"`；「今日条数」单元格为 `<td class="col-count" style="color: var(--state-error);">0</td>`（error 红内联强调）；操作列第二项由「暂停」换为「启用」（play 图标）。加载后重试态规格：点击「启用」后该行同 §上述「采集中…」行内加载——最后采集列先变 mono「采集中…」、今日条数列变 32px 骨架块；重试成功则计数恢复 `--text-strong` 且 error 红内联样式移除、开关勾选；重试仍失败则回写「3 小时前」类相对时间 + error 红计数并保留 play 启用入口，行 hover 与开关语义不变
- shimmer 动效：320ms（`--duration-slow`）；`prefers-reduced-motion: reduce` 下停为静态块（与 `.as-toggle-track / .as-action-link / 表格行` 的既有 reduced-motion 清零规则同源）

#### 文案规范

- 无数据（引导新增）：「还没有采集源」/「接入 RSS、网页、API 或手动源后，系统将按 Cron 计划自动采集入库。」
- 筛空：「没有匹配的采集源」/「换个关键词或类型，也可以清除筛选后查看全部。」
- 失败重试行内：「采集中…」（进行中，mono）；失败重试后仍失败可配描述「采集失败已重试，请查看日志排查源可用性。」

### 2.10 错误态（Error State）

> 本节为增量交互规格：基于本页既有令牌、表格结构（8 列 / 示例 8 行）、既有失败行实现（实际 HTML「新闻聚合源」行）与启停开关推导；共性规则见 §7。

#### 区域级错误（表格拉取失败）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 采集源列表拉取失败（网络 / 服务端 5xx / 超时） | 采集源表格 `.as-table-wrap` | 暗色错误面板行 `td colspan="8"`：`--state-error-bg`（#2f1f1d）底 + 1px `--state-error`（--mt-error-400）描边 + `--radius-md`；`cloud-off` 18px `--state-error-text`（采集运维场景以网络类错误为主）；标题 14px 600 `--text-strong`「采集源加载失败」；描述 12.5px `--text-muted` + mono 错误码 | `as-btn as-btn-ghost`（rotate-ccw 图标）「重试」，等价重新发起列表请求 |
| 页头 KPI 拉取失败 | `.as-kpirow` 四联卡 | KPI 错误降级：`.as-kpi-value` 显 mono「—」（`--text-faint`） | 点击 KPI 卡下钻视图后按目标页规则重载 |

- 面板行横跨表格全宽（colspan="8"，对应 thead 八列：源名称 / URL / 类型 / 状态 / Cron 表达式 / 最后采集 / 今日条数 / 操作），居中纵向构成，行内上下留白 `--space-7`
- 分页条保留框架但页码全部禁用（沿用 §6.4，显示「共 0 条 · 第 1 / 1 页」为禁用占位，不表达真实计数）；工具栏筛选可交互（重试后按当前条件重载）

#### 行内/轻量错误

- **采集任务运行失败的行级错误态**（从实际 HTML「新闻聚合源」行提取的既有实现规格，静态稿已含实例）：
  - 状态列开关：`label.as-toggle` 的 `input[type=checkbox]` 未勾选 + `title="错误"`（非「已暂停」，语义为失败态非人为暂停）
  - 「今日条数」单元格：`<td class="col-count" style="color: var(--state-error);">0</td>`——col-count 常规 mono 600 tabular-nums 规格之上内联 `--state-error` 红色强调
  - 操作列：第二项由「暂停」（pause）换为「**启用**」（play 图标 `as-action-link`），供失败后重试
  - 失败行 hover 与开关聚焦规则与常规行完全一致，不做整行惩罚性染红
- **连续失败自动暂停（阈值规则，在既有失败行之上扩展）**：同一源连续失败次数达到** 3 次**后系统自动暂停——
  - 行首警示：源名称单元格前置 12px `alert-triangle` 图标（`--state-error` 色，与组件名同行、间距 6px），`title="连续失败 3 次，已自动暂停"` 悬停提示
  - 状态列开关保持未勾选、`title` 由「错误」切换为「已自动暂停」；今日条数保留 error 红内联强调
  - 自动暂停后「启用」（play）入口保留——点击即重试链路（§2.9 行内加载：最后采集列「采集中…」+ 计数列骨架）；重试成功则移除行首警示与 error 内联样式、开关勾选、失败计数清零；再失败则失败计数 +1（阈值已达不再重复暂停）
- **toggle 开关操作失败回弹**：手动切换开关（开→关或关→开）请求失败时——
  - 状态回退动画：轨道与滑块经 `--duration-fast`（120ms，与 `.as-toggle-track/.as-toggle-thumb` 既有过渡同参）回弹至操作前位置（视觉上允许先随点击位移、失败后弹回）；`label` 的 `title` 同步回写操作前状态（「运行中」/「已暂停」）
  - 同时弹错误 toast（暗色规格见 §1.10 toast 条）；`prefers-reduced-motion: reduce` 下回弹无动画直接复位
  - 回弹期间（600ms）该开关不可重复触发，防抖

#### 降级与重试策略

- 自动重试：拉取类错误自动重试 2 次（指数退避 1s / 4s），期间回 8 行骨架；2 次仍失败落错误面板
- 手动重试：错误面板「重试」/ 失败行「启用」两条链路；行级重试不整表刷新（沿用 §6.6 行内加载契约）
- 阈值自动降级：连续失败 3 次自动暂停（本页专属规则，见上）；判断顺序契约：**错误 > 空 > 数据**（§7.7）
- 状态筛选下拉已含 `error 错误` 选项：失败源可通过该筛选聚合查看与批量处置

#### 文案规范

- 列表失败：「采集源加载失败」/「采集服务连接超时，已自动重试 2 次仍失败，请稍后重试。 `ERR-SRC-504`」
- 自动暂停（行首警示 title / 日志）：「连续失败 3 次，已自动暂停」/「该源连续 3 次采集失败，已自动暂停，可查看日志或重新启用。 `ERR-SRC-003`」
- 开关回弹（toast）：「操作未生效」/「源状态切换失败，已恢复原状态，请重试。 `ERR-SRC-500`」

---

## 3. 调研后台 · 调研管理（investigator-admin.html）

### 3.1 页面定位

调研后台的项目列表页：以 `RS-YYYY-NNN` 编号为主键管理调研项目，覆盖类型（技术调研/用户研究/市场调研/竞品分析）、调度状态（待调度/进行中/已完成/已归档）与飞书推送状态三组维度。

### 3.2 页面结构

按实际 DOM 顺序：

1. `aside.as-sider` — 品牌（`MAGICTOOLS · INVESTIGATOR · CONTROL` / 调研后台）→ 导航（控制台组 + 业务组）→ 底部返回组
2. `header.as-topbar` — 面包屑「调研后台 / 调研管理」＋ `V2.2` ＋ `ENV · PROD`
3. `main.as-content` —
   - AdminPageHead：eyebrow `ADMIN · RESEARCH` → 标题「调研管理」→ 徽标（success「服务正常」）→ 描述「管理调研项目、调度状态与飞书推送。」→ 动作区（导出 / 新建调研）→ KPI 行
   - `as-content-body` — 工具栏 → 调研表格 → 分页条（带省略号页码）

### 3.3 侧栏导航

| 导航项 | data-nav-key | 激活态 | 分组 | 图标 data-lucide |
| --- | --- | --- | --- | --- |
| 总览 | `overview` | **data-active="true"** | 控制台 | layout-dashboard |
| 系统设置 | `settings` | — | 控制台 | settings |
| 访问日志 | `audit` | — | 控制台 | scroll-text |
| 调研列表 | `research` | **data-active="true"**（本页业务项） | 业务 | search |
| 问卷管理 | `surveys` | — | 业务 | file-question |
| 访谈记录 | `interviews` | — | 业务 | mic |

### 3.4 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
| --- | --- | --- | --- | --- | --- |
| 1 | 总览 | `.as-nav-item[data-nav-key="overview"]`（active） | 导航链接 | 切换控制台总览 | 同壳内路由 |
| 2 | 系统设置 | `.as-nav-item[data-nav-key="settings"]` | 导航链接 | 进入系统设置 | 同壳内路由 |
| 3 | 访问日志 | `.as-nav-item[data-nav-key="audit"]` | 导航链接 | 进入访问日志 | 同壳内路由 |
| 4 | 调研列表 | `.as-nav-item[data-nav-key="research"]`（active） | 导航链接 | 回到本页 | 当前页 |
| 5 | 问卷管理 | `.as-nav-item[data-nav-key="surveys"]` | 导航链接 | 进入问卷管理 | 同壳内路由 |
| 6 | 访谈记录 | `.as-nav-item[data-nav-key="interviews"]` | 导航链接 | 进入访谈记录 | 同壳内路由 |
| 7 | 返回前台 | `button.as-foot-link[data-dom-id="back-front"]` | 按钮 | 纯后台应用，回网关总览 | `./index.html`（网关总览；本应用无前台页面；见 3.6） |
| 8 | 返回总览 | `button.as-foot-link[data-dom-id="back-platform"]` | 按钮 | 返回应用总览 | `./index.html`（网关总览；见 3.6） |
| 9 | 导出 | `.as-page-actions .as-btn-ghost`（download） | ghost 按钮 | 导出调研清单 | 触发下载 |
| 10 | 新建调研 | `.as-page-actions .as-btn-primary`（plus） | primary 按钮 | 打开新建调研流程 | 进入创建表单 |
| 11 | 搜索框 | `.as-toolbar-search input`（placeholder「搜索调研编号或标题...」） | 文本输入 | 按编号/标题过滤 | focus 边框 `--mt-ink-400` |
| 12 | 状态筛选 | `select[aria-label="状态筛选"]`：all 全部状态 / pending 待调度 / running 进行中 / done 已完成 / archived 已归档 | 下拉选择 | 按调度状态过滤 | 列表刷新 |
| 13 | 类型筛选 | `select[aria-label="类型筛选"]`：all / tech 技术调研 / user 用户研究 / market 市场调研 / competitor 竞品分析 | 下拉选择 | 按类型过滤 | 列表刷新 |
| 14 | 排序 | `select[aria-label="排序"]`：updated 最近更新 / id 编号 / status 状态 | 下拉选择 | 重排表格 | 列表重排 |
| 15–22 | 行操作「编辑」×8 | `button.as-action-link`（pencil） | 行内按钮 | 打开调研编辑 | hover `--mt-ink-300` + `surface-3` |
| 16–23 | 行操作「查看」×8 | `button.as-action-link`（eye） | 行内按钮 | 查看调研详情 | 进入详情 |
| 17–24 | 行操作「推送」×8 | `button.as-action-link`（send） | 行内按钮 | 推送到飞书 | 飞书推送列状态翻转 |
| 25 | 上一页 | `.as-page-btn[disabled]`（chevron-left） | 分页按钮 | 首页禁用 | disabled |
| 26 | 页码 1 | `.as-page-btn[data-active="true"]` | 分页按钮 | 当前页 | active 样式 |
| 27–29 | 页码 2/3/4 | `.as-page-btn` | 分页按钮 | 翻页 | hover `surface-2` |
| 30 | 省略号 | `.as-page-btn`（文案「...」） | 分页占位 | 表示中间页折叠 | 非跳转占位 |
| 31 | 页码 8 | `.as-page-btn` | 分页按钮 | 跳尾页 | 翻页 |
| 32 | 下一页 | `.as-page-btn`（chevron-right） | 分页按钮 | 前往第 2 页 | 翻页 |

> 全页可交互元素合计 **46 个**（侧栏 8 + 页头 2 + 工具栏 4 + 行操作 24 + 分页 8）。

### 3.5 数据状态组件

**KPI 读数**：

| KPI | 数值 |
| --- | --- |
| 进行中调研 | 18 |
| 已完成 | 42 |
| 待调度 | 6 |
| 飞书推送 | 156 |

**调研编号 mono 格式**：编号列 `.col-mono`，JetBrains Mono 12px、`--mt-ink-300`、nowrap；实际格式为 `RS-YYYY-NNN`（本页 8 行：RS-2026-042 / 041 / 040 / 039 / 038 / 037 / 036 / 035，倒序排列）。

**调度状态映射**（状态列 badge）：

| 状态 | data-tone |
| --- | --- |
| 待调度 | `info` |
| 进行中 | `success` |
| 已完成 | `muted`（本页私有扩展 tone：`--text-muted` + hairline-strong 描边） |
| 已归档 | `faint`（本页私有扩展 tone：`--text-faint` + hairline 描边） |

**类型 badge**：技术调研＝`info`、用户研究＝`info`、竞品分析＝`warning`、市场调研＝无 tone 默认灰。

**飞书推送列状态 badge**：已推送＝`data-tone="success"`；未推送＝`data-tone="faint"`（弱化不喧宾）。

**表格列定义**（实际 `thead`）：调研编号 | 标题 | 负责人 | 类型 | 状态 | 飞书推送 | 最后更新 | 操作。最后更新列 `.col-time` 相对时间（「2 小时前」「1 天前」「1 周前」等）。

**示例行（8 行）**：见编号列表；负责人为中文姓名（张明/李芳/王强/赵雪/陈刚/刘洋/孙丽/周明）。

**分页条**：「共 66 条 · 第 1 / 8 页」＋ chevron-left（disabled）→ 1（active）→ 2 → 3 → 4 → `...` → 8 → chevron-right。**四页中唯一带省略号页码的分页**。

> 本页在共性 badge 四 tone（success/warning/error/info）之外扩展了 `muted` / `faint` 两档（仅 investigator 私有 CSS 中定义），用于「完成/归档/未推送」等无需吸引注意的终态。

### 3.6 页面互跳

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
| --- | --- | --- | --- |
| 返回前台 | `data-dom-id="back-front"` | `./index.html`（网关总览——本应用为纯后台，无前台页面） | `<button>` + JS `location.href` 注入（非 `<a href>`） |
| 返回总览 | `data-dom-id="back-platform"` | `./index.html`（网关总览） | `<button>` + JS `location.href` 注入（非 `<a href>`） |
| 入口侧：网关总览应用卡片 | `data-dom-id="card-investigator"`（`.pg-app-card`） | `./investigator-admin.html`（本控制台） | 原生 `<a href>` 直连（卡片路由标注「控制台」） |

本页为纯后台应用，无前台页面：「返回前台」目标为网关总览（`./index.html`），与 `back-platform` 同目标但保留两个入口。两按钮均为 `<button type="button">`（无 href），跳转由页面末尾 `<script>` 注入：click → `location.href = './index.html'`。视觉沿用 `.as-foot-link`（mono 11px），hover 文字提亮 + surface-2 背景。

### 3.7 可访问性与降级

- 三个下拉带 `aria-label`；导航带 `aria-label="后台主导航"`
- `prefers-reduced-motion`：`.as-action-link / .as-page-btn / 表格行` 过渡关闭
- 分页上一页原生 `disabled`；省略号为非交互占位按钮样式
- select `option` 显式 `background: var(--surface-3)` 暗色兜底

### 3.8 响应式行为

- `≤960px`：KPI 2×2；工具栏搜索独占一行；分页条纵向堆叠
- 表格常态 `min-width: 860px` + `overflow-x: auto`

### 3.9 空态与加载态

> 本节为增量交互规格：基于本页既有令牌、表格结构（8 列 / 示例 8 行）与飞书推送列 badge 双态（success / faint）推导，静态稿不含空态与骨架实例；共性规则见 §6。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 尚无任何调研项目（总数为 0） | 调研表格 `.as-table-wrap` | 空态行 `td colspan="8"`：图标 `open-folder` + 标题「还没有调研项目」+ 描述 | `as-btn as-btn-primary`（plus 图标）「新建调研」，与页头主按钮同目标 |
| 筛选/搜索无结果（条件非空但 0 命中） | 同上 | 空态行 `colspan="8"`：图标 `ghost` + 标题「没有匹配的调研」 | `as-btn as-btn-ghost`「清除筛选」，等价恢复状态/类型下拉为 all + 清空搜索框 |
| 全部项目已归档（处于 archived 筛选之外的常规视图 0 命中） | 同上 | 空态行 `colspan="8"`：图标 `archive` + 标题「在册调研均已归档」 | `as-btn as-btn-ghost`「查看已归档」（状态下拉切至「已归档」） |

- 空态行横跨表格全宽：`td colspan="8"`（对应 thead 八列：调研编号 / 标题 / 负责人 / 类型 / 状态 / 飞书推送 / 最后更新 / 操作），沿用末行去底边线规则
- 居中构成：40px 图标容器（`--surface-2` 底 + `--mt-hairline` 描边 + `--radius-md`）内嵌 18px lucide 图标（`--text-faint`）→ 标题（`--font-body` 14px 600 `--text-strong`）→ 描述（12.5px `--text-muted`）→ 动作按钮；整体居中，行内上下留白 `--space-7`
- 空态下分页条显示「共 0 条 · 第 1 / 1 页」，省略号与全部页码按钮进入禁用（本页分页为四页唯一带 `...` 折叠形态，空态下省略号一并隐藏）

#### 加载态（Loading State）

- 表格骨架：8 行（与本页真实示例行数一致）× 8 列，整体替换 `tbody`，按列结构定宽：
  - 调研编号列（`.col-mono`）：64px；标题列：文字块 50–70%；负责人列：文字块 40%
  - 类型 / 状态 / 飞书推送三列 badge：各 48 × 22px（对齐 `.as-badge` 实高）
  - 最后更新列（`.col-time`）：56px；操作列：三枚 40 × 22px 占位（对齐「编辑 / 查看 / 推送」三个 `.as-action-link`）
- KPI 骨架：`.as-kpi-value` 位为 22px 高 × 72px 宽块；label 位 12px 高 × 56px 宽块
- **本页专属 — 飞书推送列的推送进行中态**（行级「列级加载」）：点击行操作「推送」（send 图标）后，仅该行「飞书推送」列 badge 由静态双态（已推送 `data-tone="success"` / 未推送 `data-tone="faint"`，本页私有 tone：faint＝`--text-faint` + `--mt-hairline` 描边）切换为进行中态——
  - badge 规格：warning 语义边框（`border-color: var(--state-warning)`）+ 文字，文案换为 mono「推送中」（`--font-mono` 11.5px，与 `.as-badge` 基础字号一致），透明底不变，高度维持 22px 胶囊
  - 推送期间该行「推送」操作链接进入禁用（`opacity: 0.45` / `cursor: not-allowed` / 去 hover / `aria-disabled="true"`），防重复触发
  - 终态回写：成功 → `data-tone="success"`「已推送」；失败 → `data-tone="error"`「推送失败」并保留行内「推送」入口供重试
- shimmer 动效：320ms（`--duration-slow`）；`prefers-reduced-motion: reduce` 下停为静态块（与 `.as-action-link / .as-page-btn / 表格行` 既有 reduced-motion 清零规则同源）

#### 文案规范

- 无数据：「还没有调研项目」/「创建第一份调研，编号将按 RS-YYYY-NNN 自动生成。」
- 筛空：「没有匹配的调研」/「换个编号、标题或类型条件，或清除筛选查看全部。」
- 推送行内：「推送中」（mono badge）；失败态描述可配「飞书推送失败，请检查集成配置后重试。」

### 3.10 错误态（Error State）

> 本节为增量交互规格：基于本页既有令牌、表格结构（8 列 / 示例 8 行）与飞书推送列 badge 既有双态（实际 HTML：已推送 `data-tone="success"` / 未推送 `data-tone="faint"`）推导；共性规则见 §7。

#### 区域级错误（表格拉取失败）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 调研列表拉取失败（网络 / 服务端 5xx / 超时） | 调研表格 `.as-table-wrap` | 暗色错误面板行 `td colspan="8"`：`--state-error-bg`（#2f1f1d）底 + 1px `--state-error`（--mt-error-400）描边 + `--radius-md`；`alert-triangle` 18px `--state-error-text`；标题 14px 600 `--text-strong`「调研列表加载失败」；描述 12.5px `--text-muted` + mono 错误码 | `as-btn as-btn-ghost`（rotate-ccw 图标）「重试」，等价重新发起列表请求 |
| 页头 KPI 拉取失败（含「飞书推送 156」卡） | `.as-kpirow` 四联卡 | KPI 错误降级：`.as-kpi-value` 显 mono「—」（`--text-faint`） | 点击 KPI 卡下钻视图后按目标页规则重载 |

- 面板行横跨表格全宽（colspan="8"，对应 thead 八列：调研编号 / 标题 / 负责人 / 类型 / 状态 / 飞书推送 / 最后更新 / 操作），居中纵向构成，行内上下留白 `--space-7`
- 分页条（本页为带省略号折叠形态）保留框架但页码与省略号全部禁用；「新建调研」主按钮保持可交互（创建后进入列表自然重载）

#### 行内/轻量错误

- **飞书推送失败的 badge error 态**（扩展既有双态为第四态）：飞书推送列由「已推送 `data-tone="success"` / 未推送 `data-tone="faint"` / 推送中 warning 描边（§3.9）」扩展——
  - **推送失败 = `data-tone="error"` 描边 badge**：沿用 `.as-badge[data-tone="error"]` 既有规则（`--state-error` 文字+描边同色、透明底、22px 胶囊），文案为 mono「推送失败」（`--font-mono` 11.5px，与「推送中」规格一致）
  - 操作列恢复链接出现规则：失败行「推送」`as-action-link`（send 图标）保留并可点，语义变为**重推**（hover 规则不变）；重推走 §3.9 推送中态链路，成功回写 `data-tone="success"`「已推送」，再失败回 error 态
  - 推送失败不阻塞其他行操作：同行「编辑 / 查看」照常可交互
- **新建调研提交失败**：表单停留在当前填写态（已填字段不清空），提交按钮短暂（600ms）1px `--state-error` 描边后回弹 + 错误 toast；编号类冲突（RS-YYYY-NNN 序号被占用）在编号字段下方 12px `--state-error` 行内提示，提交按钮回弹后可再次提交
- **toast（暗色）**：`--surface-2` 底 + 左 3px `--state-error` 竖条 + 右下 mono 时间戳，3s 消失（§7.4 统一规格）

#### 降级与重试策略

- 自动重试：列表拉取自动重试 2 次（指数退避 1s / 4s），期间回 8 行骨架；2 次仍失败落错误面板
- 推送失败**不做自动重推**（外发副作用类操作仅手动重试，避免重复轰炸飞书群）；列表拉取失败与推送失败互不牵连
- 判断顺序契约：**错误 > 空 > 数据**（§7.7）；请求失败永不落入「还没有调研项目」空态

#### 文案规范

- 列表失败：「调研列表加载失败」/「调研服务暂时不可用，稍后自动重试，或手动重试一次。 `ERR-RSCH-503`」
- 推送失败（badge + 悬停描述）：mono badge「推送失败」/「飞书推送失败，请检查集成配置后重试。 `ERR-RSCH-FEISHU`」
- 新建提交失败（toast）：「创建未成功」/「调研创建提交失败，内容已保留，请重试。 `ERR-RSCH-500`」

---

## 4. 评审后台 · 评审请求（assessor-admin.html）

### 4.1 页面定位

评审后台的请求队列页：以 `RV-YYYY-NNN` 编号管理评审请求，双 badge 体系（优先级 + 状态）叠加来源 badge（调研/采集/外部），底部设「分析文档」入口面板。页头徽标为 warning「5 待审」（四页中唯一非 success 的页头徽标）。

### 4.2 页面结构

按实际 DOM 顺序：

1. `aside.as-sider` — 品牌（`MAGICTOOLS · ASSESSOR · CONTROL` / 评审后台）→ 导航（控制台组 + 业务组）→ 底部返回组
2. `header.as-topbar` — 面包屑「评审后台 / 评审请求」＋ `V2.2` ＋ `ENV · PROD`
3. `main.as-content` —
   - AdminPageHead：eyebrow `ADMIN · REVIEWS` → 标题「评审请求」→ 徽标（**warning「5 待审」**）→ 描述「管理评审请求队列、评审标准与分析文档入口。」→ 动作区（导出 / 批量分配）→ KPI 行
   - `as-content-body` — 工具栏 → 评审请求表格 → 分页条 → **分析文档入口面板**（`section.as-panel.as-doc-panel`，aria-label="分析文档入口"）

### 4.3 侧栏导航

| 导航项 | data-nav-key | 激活态 | 分组 | 图标 data-lucide |
| --- | --- | --- | --- | --- |
| 总览 | `overview` | **data-active="true"** | 控制台 | layout-dashboard |
| 系统设置 | `settings` | — | 控制台 | settings |
| 访问日志 | `audit` | — | 控制台 | scroll-text |
| 评审请求 | `reviews` | **data-active="true"**（本页业务项） | 业务 | clipboard-check |
| 评审标准 | `criteria` | — | 业务 | list-checks |
| 分析文档 | `docs` | — | 业务 | file-text |

### 4.4 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
| --- | --- | --- | --- | --- | --- |
| 1 | 总览 | `.as-nav-item[data-nav-key="overview"]`（active） | 导航链接 | 切换控制台总览 | 同壳内路由 |
| 2 | 系统设置 | `.as-nav-item[data-nav-key="settings"]` | 导航链接 | 进入系统设置 | 同壳内路由 |
| 3 | 访问日志 | `.as-nav-item[data-nav-key="audit"]` | 导航链接 | 进入访问日志 | 同壳内路由 |
| 4 | 评审请求 | `.as-nav-item[data-nav-key="reviews"]`（active） | 导航链接 | 回到本页 | 当前页 |
| 5 | 评审标准 | `.as-nav-item[data-nav-key="criteria"]` | 导航链接 | 进入评审标准 | 同壳内路由 |
| 6 | 分析文档 | `.as-nav-item[data-nav-key="docs"]` | 导航链接 | 进入分析文档 | 同壳内路由（与底部入口面板同目标） |
| 7 | 返回前台 | `button.as-foot-link[data-dom-id="back-front"]` | 按钮 | 纯后台应用，回网关总览 | `./index.html`（网关总览；本应用无前台页面；见 4.6） |
| 8 | 返回总览 | `button.as-foot-link[data-dom-id="back-platform"]` | 按钮 | 返回应用总览 | `./index.html`（网关总览；见 4.6） |
| 9 | 导出 | `.as-page-actions .as-btn-ghost`（download） | ghost 按钮 | 导出请求清单 | 触发下载 |
| 10 | 批量分配 | `.as-page-actions .as-btn-primary`（user-plus） | primary 按钮 | 批量分配评审人 | 打开分配流程 |
| 11 | 搜索框 | `.as-toolbar-search input`（placeholder「搜索请求编号或标题...」） | 文本输入 | 按编号/标题过滤 | focus 边框 `--mt-ink-400` |
| 12 | 状态筛选 | `select[aria-label="状态筛选"]`：all 全部状态 / unassigned 待分配 / reviewing 评审中 / approved 已通过 / rejected 已驳回 | 下拉选择 | 按状态过滤 | 列表刷新 |
| 13 | 优先级筛选 | `select[aria-label="优先级筛选"]`：all 全部优先级 / high 高 / medium 中 / low 低 | 下拉选择 | 按优先级过滤 | 列表刷新 |
| 14 | 排序 | `select[aria-label="排序"]`：date 提交日期 / priority 优先级 / status 状态 / id 编号 | 下拉选择 | 重排表格 | 列表重排 |
| 15–22 | 行操作「分配」×8 | `button.as-action-link`（user-plus） | 行内按钮 | 为该请求指派评审人 | 评审人列由「—」变姓名 |
| 16–23 | 行操作「查看」×8 | `button.as-action-link`（eye） | 行内按钮 | 查看请求详情 | 进入详情 |
| 17–24 | 行操作「文档」×8 | `button.as-action-link`（file-text） | 行内按钮 | 查看该请求分析文档 | 进入文档 |
| 25 | 上一页 | `.as-page-btn[disabled]`（chevron-left） | 分页按钮 | 首页禁用 | disabled |
| 26 | 页码 1 | `.as-page-btn[data-active="true"]` | 分页按钮 | 当前页 | active 样式 |
| 27–31 | 页码 2–6 | `.as-page-btn` | 分页按钮 | 翻页 | hover `surface-2` |
| 32 | 下一页 | `.as-page-btn`（chevron-right） | 分页按钮 | 前往第 2 页 | 翻页 |
| 33 | 分析文档入口「进入」 | `.as-doc-panel .as-btn-ghost.as-doc-panel-btn`（arrow-right） | ghost 按钮 | 进入分析文档汇总 | 前往 docs 视图 |

> 全页可交互元素合计 **47 个**（侧栏 8 + 页头 2 + 工具栏 4 + 行操作 24 + 分页 8 + 文档面板 1）。

### 4.5 数据状态组件

**KPI 读数**：

| KPI | 数值 |
| --- | --- |
| 待审请求 | 5 |
| 本周完成 | 23 |
| 平均耗时 | 2.3d |
| 通过率 | 78% |

**请求编号 mono 格式**：编号列 `.col-mono`（mono 12px、`--mt-ink-300`、nowrap），实际格式 `RV-YYYY-NNN`（本页 8 行：RV-2026-128 / 127 / 126 / 125 / 124 / 123 / 122 / 121，倒序）。

**来源 badge**：调研＝`info`、采集＝`success`、外部＝`warning`。

**优先级与状态双 badge 体系**（同行并列两枚语义 badge）：

| 维度 | 值 → data-tone |
| --- | --- |
| 优先级 | 高 → `error`；中 → `warning`；低 → `info` |
| 状态 | 待分配 → `warning`；评审中 → `info`；已通过 → `success`；已驳回 → `error` |

**表格列定义**（实际 `thead`）：请求编号 | 标题 | 来源 | 评审人 | 优先级 | 状态 | 提交日期 | 操作。评审人未分配时显示「—」；提交日期列 `.col-date` 为 mono 字体日期（`2026-09-08` 等）。

**特殊组件 — 底部分析文档入口面板**（`section.as-panel.as-doc-panel`，aria-label="分析文档入口"）：

- 布局：横向三段（44 × 44px 图标盒 → 文本区 → 右侧按钮），`margin-top: 20px`，`as-panel` 表面（surface-1 + hairline + shadow-1）
- 图标盒：`surface-2` 底 + hairline 描边，icon `bar-chart-3` 22px，颜色 `--mt-amber-400`（琥珀点缀）
- 文本区：标题「分析文档」（display 字体 16px 600）＋ 描述「查看评审汇总分析与趋势报告」
- 按钮：ghost「进入」（arrow-right 图标），flex:none 固定右侧

**示例行（8 行）**：RV-2026-128 招聘模块重构方案（调研/高/待分配/—）｜ RV-2026-127 书库搜索优化（采集/中/评审中/李芳）｜ RV-2026-126 助手对话流改进（外部/高/评审中/王强）｜ RV-2026-125 交付看板改版（调研/中/已通过/赵雪）｜ RV-2026-124 组件工坊样式调整（外部/低/已通过/陈刚）｜ RV-2026-123 采集源去重策略（采集/高/已驳回/刘洋）｜ RV-2026-122 调研问卷模板化（调研/中/待分配/—）｜ RV-2026-121 评审流程自动化（外部/低/已通过/周明）。

**分页条**：「共 48 条 · 第 1 / 6 页」＋ chevron-left（disabled）→ 1（active）→ 2 → 3 → 4 → 5 → 6 → chevron-right。

### 4.6 页面互跳

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
| --- | --- | --- | --- |
| 返回前台 | `data-dom-id="back-front"` | `./index.html`（网关总览——本应用为纯后台，无前台页面） | `<button>` + JS `location.href` 注入（非 `<a href>`） |
| 返回总览 | `data-dom-id="back-platform"` | `./index.html`（网关总览） | `<button>` + JS `location.href` 注入（非 `<a href>`） |
| 入口侧：网关总览应用卡片 | `data-dom-id="card-assessor"`（`.pg-app-card`） | `./assessor-admin.html`（本控制台） | 原生 `<a href>` 直连（卡片路由标注「控制台」） |
| 分析文档「进入」 | `.as-doc-panel-btn` | 分析文档视图 | `<button>` 同壳内路由（与侧栏 `docs` 项同目标） |

本页为纯后台应用，无前台页面：「返回前台」目标为网关总览（`./index.html`），与 `back-platform` 同目标但保留两个入口。两按钮均为 `<button type="button">`（无 href），跳转由页面末尾 `<script>` 注入：click → `location.href = './index.html'`。视觉沿用 `.as-foot-link`（mono 11px），hover 文字提亮 + surface-2 背景。

### 4.7 可访问性与降级

- 下拉带 `aria-label`（状态筛选 / 优先级筛选 / 排序）；文档面板带 `aria-label="分析文档入口"`；导航带 `aria-label="后台主导航"`
- `prefers-reduced-motion`：`.as-action-link / .as-page-btn / 表格行` 过渡关闭
- 上一页原生 `disabled`；`option` 显式暗色底兜底

### 4.8 响应式行为

- `≤960px`：KPI 2×2；工具栏搜索独占一行；分页纵向堆叠；**文档面板改纵向**（`flex-direction: column; align-items: flex-start`，按钮 `align-self: flex-end` 靠右）
- 表格常态 `min-width: 860px` + `overflow-x: auto`

### 4.9 空态与加载态

> 本节为增量交互规格：基于本页既有令牌、表格结构（8 列 / 示例 8 行）、warning「5 待审」页头徽标与底部分析文档面板推导，静态稿不含空态与骨架实例；共性规则见 §6。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 待审清零（全部请求进入已通过/已驳回终态，常规视图 0 命中）——**正向空态** | 评审请求表格 `.as-table-wrap` | 空态行 `td colspan="8"`：图标 `check-circle-2` + 标题「队列已清空」+ 描述 | `as-btn as-btn-ghost`「查看已完成」（状态下拉切至「已通过」） |
| 尚无任何评审请求（系统总数为 0） | 同上 | 空态行 `colspan="8"`：图标 `inbox` + 标题「还没有评审请求」 | `as-btn as-btn-primary`（user-plus 图标）「批量分配」，与页头主按钮同目标（需先有请求再分配，无数据态下按钮改为引导描述「等待调研 / 采集 / 外部渠道提交请求」） |
| 筛选/搜索无结果（条件非空但 0 命中） | 同上 | 空态行 `colspan="8"`：图标 `ghost` + 标题「没有匹配的请求」 | `as-btn as-btn-ghost`「清除筛选」，等价恢复状态/优先级下拉为 all + 清空搜索框 |

- 空态行横跨表格全宽：`td colspan="8"`（对应 thead 八列：请求编号 / 标题 / 来源 / 评审人 / 优先级 / 状态 / 提交日期 / 操作），沿用末行去底边线规则
- 居中构成：40px 图标容器（`--surface-2` 底 + `--mt-hairline` 描边 + `--radius-md`）内嵌 18px lucide 图标（`--text-faint`）→ 标题（`--font-body` 14px 600 `--text-strong`）→ 描述（12.5px `--text-muted`）→ 动作按钮；整体居中，行内上下留白 `--space-7`
- **正向空态的克制庆祝原则**：「队列已清空」是四页中唯一的正向空态——允许 `check-circle-2` 图标与轻量庆祝文案，但**不使用插画、不做动效庆祝、不加 reward/confetti 类图标**；图标仍走 `--text-faint` 常规弱化色，不提亮为 success 色，保持控制台的克制气质
- 待审清零时联动：页头徽标由 warning「5 待审」切换为 success「队列空闲」（沿用 `.as-badge[data-tone="success"]` 规格），KPI「待审请求」值归 0
- 空态下分页条显示「共 0 条 · 第 1 / 1 页」，全部页码按钮进入禁用

#### 加载态（Loading State）

- 表格骨架：8 行（与本页真实示例行数一致）× 8 列，整体替换 `tbody`，按列结构定宽：
  - 请求编号列（`.col-mono`）：64px；标题列：文字块 50–70%；评审人列：文字块 40%
  - 来源 / 优先级 / 状态三列 badge（双 badge 体系所在行）：各 48 × 22px（对齐 `.as-badge` 实高）
  - 提交日期列（`.col-date`，mono）：64px；操作列：三枚 40 × 22px 占位（对齐「分配 / 查看 / 文档」三个 `.as-action-link`）
- KPI 骨架：`.as-kpi-value` 位为 22px 高 × 72px 宽块；label 位 12px 高 × 56px 宽块
- **本页专属 — 底部分析文档入口面板无数据禁用态**（`section.as-panel.as-doc-panel`，本页独有组件，44 × 44px 图标盒 + 文本区 + ghost「进入」按钮）：评审系统无任何已归档分析文档时，面板保留在原位不隐藏——
  - 「进入」按钮（`.as-doc-panel-btn`）进入禁用：`opacity: 0.45` / `cursor: not-allowed` / 移除 hover 背景与描边变化 / 保持 `aria-disabled="true"`
  - 描述文案由「查看评审汇总分析与趋势报告」切换为「暂无汇总数据，首份评审完成后自动生成」；标题「分析文档」与琥珀 `bar-chart-3` 图标盒（`--mt-amber-400`）保持不变，面板整体透明度不下调（仅按钮禁用），避免整面板视觉塌陷
- shimmer 动效：320ms（`--duration-slow`）；`prefers-reduced-motion: reduce` 下停为静态块（与 `.as-action-link / .as-page-btn / 表格行` 既有 reduced-motion 清零规则同源）

#### 文案规范

- 正向空态（克制庆祝）：「队列已清空」/「所有请求已完成评审，新的请求提交后会出现在这里。」
- 无数据：「还没有评审请求」/「等待调研、采集或外部渠道提交评审请求。」
- 文档面板禁用：「暂无汇总数据，首份评审完成后自动生成」

### 4.10 错误态（Error State）

> 本节为增量交互规格：基于本页既有令牌、表格结构（8 列 / 示例 8 行）、页头主按钮「批量分配」与底部分析文档入口面板（`section.as-panel.as-doc-panel`）推导；共性规则见 §7。

#### 区域级错误（表格拉取失败）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
| --- | --- | --- | --- |
| 评审请求列表拉取失败（网络 / 服务端 5xx / 超时） | 评审请求表格 `.as-table-wrap` | 暗色错误面板行 `td colspan="8"`：`--state-error-bg`（#2f1f1d）底 + 1px `--state-error`（--mt-error-400）描边 + `--radius-md`；`alert-triangle` 18px `--state-error-text`；标题 14px 600 `--text-strong`「评审队列加载失败」；描述 12.5px `--text-muted` + mono 错误码 | `as-btn as-btn-ghost`（rotate-ccw 图标）「重试」，等价重新发起列表请求 |
| 页头 KPI 拉取失败 | `.as-kpirow` 四联卡 | KPI 错误降级：`.as-kpi-value` 显 mono「—」（`--text-faint`） | 点击 KPI 卡下钻视图后按目标页规则重载 |
| **分析文档入口面板加载失败** | `section.as-panel.as-doc-panel`（底部入口面板） | **面板内错误占位**：面板原位保留、三段布局不变（44 × 44px 图标盒 → 文本区 → 按钮位）；文本区标题保持「分析文档」，描述切换为错误文案 + mono 错误码；图标盒 `bar-chart-3`（`--mt-amber-400`）不变 | 「进入」按钮（`.as-doc-panel-btn`）**禁用**（§6.4：`opacity: 0.45` / `cursor: not-allowed` / 去 hover / `aria-disabled="true"`）；描述区提供「重试」文字链接（`as-action-link` 规格）重新拉取汇总状态 |

- 面板错误态只降级其动作与描述，不隐藏面板、不下调整面板透明度（沿用 §6.4 面板级禁用原则）；重试成功后恢复「查看评审汇总分析与趋势报告」+ 按钮解禁
- 表格错误面板行横跨全宽（colspan="8"）；页头 warning「5 待审」徽标不因拉取失败改动（未知状态不伪造为「队列空闲」）

#### 行内/轻量错误

- **批量分配部分成功的混合结果反馈（复合 toast）**：对多行勾选执行「批量分配」时出现「成功 N + 失败 M」混合结果——
  - 复合 toast 规格：`--surface-2` 底 + 左 3px **双色分段竖条**（上段 60% 高 `--state-success` / 下段 40% 高 `--state-error`，合计仍为 3px 宽）+ 右下 mono 时间戳；`--shadow-2` 浮层、右下角弹出、**5s 消失**（长于普通错误 toast 的 3s，混合结果需更长阅读时间）
  - 标题行：「部分分配成功」13px 600 `--text-strong`；描述两行：第一行「成功 **N** 条，分配给 <评审人>。」（N 为 mono 600 tabular-nums）；第二行「失败 **M** 条：2 条已被他人分配、1 条已进入终态。」+ mono 错误码
  - 全失败（M＝全部）时竖条整条 `--state-error`、标题「分配失败」、按 §7.4 普通 3s 错误 toast 处理，不使用复合形态
  - 混合结果落地：成功行评审人列由「—」变姓名、状态 badge 翻转；失败行保持原态并在操作列追加「分配」重试入口（本就常驻，无需新增）
- **toast（暗色）**：普通错误 toast 规格（`--surface-2` + 左 3px `--state-error` 竖条 + mono 时间戳、3s 消失），复合 toast 为其扩展形态
- 行操作「分配 / 查看 / 文档」失败：按钮短暂 600ms 1px `--state-error` 描边回弹 + 错误 toast，行数据不变

#### 降级与重试策略

- 自动重试：列表与文档面板汇总状态各自独立自动重试 2 次（指数退避 1s / 4s）；2 次仍失败分别落错误面板 / 面板内错误占位
- 手动重试：表格错误面板「重试」ghost 按钮 / 文档面板描述区「重试」文字链接 / 失败行「分配」重试三条链路
- 409 类冲突（分配时请求已进入终态、已被他人分配）**不自动重试**，复合 toast 中单独归因列出并引导刷新
- 判断顺序契约：**错误 > 空 > 数据**（§7.7）；请求失败永不落入「队列已清空」正向空态（错误与正向空态语义冲突，必须严格区分）

#### 文案规范

- 列表失败：「评审队列加载失败」/「评审服务暂时不可用，稍后自动重试，或手动重试一次。 `ERR-RVW-503`」
- 复合分配（toast）：「部分分配成功」/「成功 5 条，分配给王强。失败 3 条：2 条已被他人分配、1 条已进入终态。 `ERR-RVW-409`」
- 文档面板失败：「分析报告加载失败」/「汇总数据暂时不可用，可重试或稍后再进。 `ERR-RVW-DOC`」

---

## 5. AdminShell 共性交互契约

以下规则在四个页面代码中完全一致，为运营后台共用契约。

### 5.1 侧栏激活规则

- 结构：`.as-sider`（240px、sticky、`--mt-sider-grad` 三段纵向渐变底 + 右侧 hairline）→ 品牌区（mono 眉标 `MAGICTOOLS · <APP> · CONTROL` + display 字体应用名）→ `nav.as-nav[aria-label="后台主导航"]`（「控制台」「业务」两组，组标题为 mono 10px 大写 faint）→ `as-sider-foot`
- 导航项 `.as-nav-item`：36px 高、13.5px 字号、16px lucide 图标
- hover：`color: var(--text-body); background: var(--surface-2)`（120ms）
- **激活**：`data-active="true"` → `color: var(--text-strong)` + `box-shadow: inset 2px 0 0 var(--mt-amber-400)`（左 2px 琥珀指示条 + 文字提亮，无底色）
- **双激活约定**：每页「总览（overview）」与「当前业务项」同时 `data-active="true"`；控制台组（总览/系统设置/访问日志）三页完全同构，业务组随应用替换
- 底部 `as-foot-link`：32px 高、mono 11px；恒为「返回前台（back-front，arrow-left）」「返回总览（back-platform，layout-grid）」两枚，hover 提亮 + surface-2。**实现契约（与业务分册同口径）**：两枚恒为 `<button type="button">`（无 href），跳转由各页末尾 `<script>` 注入 click → `location.href`；`back-platform` 恒指 `./index.html`，`back-front` 在有前台的应用指对应 `*-front.html`（本册仅 designer），纯后台应用（gatherer / investigator / assessor，无前台页面）回落至 `./index.html`（与 back-platform 同目标、保留双入口）

### 5.2 顶栏面包屑

- `.as-topbar`：52px、sticky top:0、z-index:20、`--mt-header-glass`（rgba(14,18,24,0.82)）+ 8px backdrop-blur 毛玻璃 + 底部 hairline
- 左：`.as-crumbs` mono 11px 字距 0.06em，三段式「根（faint）/ 分隔符 `/`（faint）/ 当前页（body）」
- 右：`V2.2` 版本号（mono 10px faint）＋ `ENV · PROD` 环境徽标（22px 高 mono 大写胶囊，前置 5px 圆点）

### 5.3 AdminPageHead 七槽位

`.as-pagehead`（padding 20px 24px 0，底部 hairline 分隔）按序固定七槽：

| 槽位 | 选择器 | 内容 |
| --- | --- | --- |
| ① 眉标 | `.as-page-eyebrow` | mono 11px 大写（如 `ADMIN · COMPONENTS`） |
| ② 标题 | `.as-page-title` | display 字体 26px 600 |
| ③ 徽标行 | `.as-page-badges` | `.as-badge[data-tone]`（服务正常 success / 5 待审 warning） |
| ④ 描述 | `.as-page-desc` | 13.5px muted，max-width 640px |
| ⑤ 动作区 | `.as-page-actions` | 右下对齐：ghost「导出」＋ primary 主创建动作 |
| ⑥ KPI 行 | `.as-kpirow` | 4 联卡 |
| ⑦ 分隔线 | `border-bottom` | 与内容区划界 |

### 5.4 KPI hover

- `.as-kpirow`：4 列网格、surface-1 底、hairline 描边、shadow-1、内部分格线
- `.as-kpi`：label 12px muted，value **JetBrains Mono 22px 600 tabular-nums**（`--text-strong`）
- **hover：`background: var(--surface-2)`（120ms）**，暗示可点击下钻
- `≤960px` 统一降为 2×2 并重排分隔线

### 5.5 按钮语言

| 级别 | 类 | 视觉 | 用途（实际用例） |
| --- | --- | --- | --- |
| primary | `.as-btn-primary` | `--mt-ink-400` 实底、hover `--mt-ink-300`、36px 高 | 每页唯一主创建动作：发布组件 / 新增采集源 / 新建调研 / 批量分配 |
| ghost | `.as-btn-ghost` | 透明底 + hairline 描边、hover surface-2 | 次级动作：导出（四页通用）、重置、批量归档、进入 |
| accent | `.as-btn-accent` | `--accent`（琥珀 400）实底、hover `--accent-hover` | 仅 designer 批量发布 |
| 行内 | `.as-action-link` | 无边框文字+13px 图标、hover `--mt-ink-300` 文字 + `surface-3` 底 | 表格行操作（编辑/详情/暂停/启用/日志/查看/推送/分配/文档） |
| 链接式 | `.as-link-btn` | hairline 描边迷你按钮（12px）、hover surface-2 + hairline-strong | 仅 designer 行操作（编辑/详情） |
| 分页 | `.as-page-btn` | 28px 见方 mono、active `surface-3` + hairline-strong 描边 | 页码与前后翻页（chevron） |

统一参数：36px 高（行内/分页除外）、radius-md、13.5px 字号、15px 图标、120ms 过渡；`focus-visible` 一律 `outline: 1px solid var(--mt-ink-300); outline-offset: 2px`。

### 5.6 其他共性

- 表格：`thead` surface-2 底、行 hover `surface-2`、末行去底边线；mono 列（编号/Cron/版本/日期/计数）统一 JetBrains Mono + `tabular-nums`/`nowrap`
- badge：22px 高胶囊、hairline 描边、透明底；`data-tone` 四档语义色（success/warning/error/info）文字+描边同色；无 tone 即默认灰
- 动效：全部 120ms（`--duration-fast`）标准缓动；`prefers-reduced-motion: reduce` 下所有交互过渡清零
- 降级：`disabled` 用原生属性；暗色 select `option` 显式指定 surface-3 底；图标库 lucide 失败时按钮仍有文字可读

---

## 6. 空态与加载态共性规范（AdminShell）

以下为四页 `X.9` 节共用的空态 / 加载态契约，与既有 §5.1–§5.6 同级生效；各页专属差异以其 X.9 节「本页专属」条目为准。

### 6.1 空态三类型

四页空态统一归为三类，动作区严格对应、禁止互换：

| 类型 | 判定 | 图标（data-lucide） | 动作 |
| --- | --- | --- | --- |
| 无数据（新建引导） | 系统总数为 0，筛选条件为空 | `inbox`（列表型）/ `package`（资产型） | primary 主创建按钮，与该页页头主按钮同目标 |
| 筛空 | 筛选/搜索条件非空但 0 命中 | `ghost` | ghost「清除筛选」，等价重置全部下拉 + 清空搜索 |
| 终态空（业务派生） | 数据存在但被业务状态全部占据（已归档 / 已暂停 / 队列清空） | `archive` / `pause` / `check-circle-2` | ghost 查看类按钮（切换对应筛选） |

- 三类空态共享同一居中构成（见 §6.2），差异只体现在图标、文案与动作级别
- 正向空态（如 assessor「队列已清空」）允许轻量庆祝文案，但不用插画、不做动效、图标保持 `--text-faint` 弱化色

### 6.2 表格 colspan 空态

- 空态以**表格行**承载，不替换表格容器：`tbody` 内唯一 `<tr>`，其 `<td colspan="N">` 横跨该页 `thead` 实际列数（designer=7；gatherer / investigator / assessor=8）
- 空态单元格内为居中纵向构成：40px 图标容器（`--surface-2` 底 + `--mt-hairline` 描边 + `--radius-md`）内嵌 18px lucide 图标（`--text-faint`）→ 标题（`--font-body` 14px 600 `--text-strong`）→ 描述（12.5px `--text-muted`）→ 动作（`as-btn as-btn-ghost` 或 `as-btn as-btn-primary`）；行内上下留白 `--space-7`
- 空态行沿用表格末行 `border-bottom: none` 规则；`thead` 与列宽保持不变，空态切换不引起表格横向跳动
- 空态不改变页面框架：侧栏 / 顶栏 / AdminPageHead / 工具栏 / 分页条 / 页面专属面板（动作条、文档面板）原位保留，仅数据区表达空

### 6.3 骨架令牌（Skeleton）

- 骨架块基底：`--surface-2` 实底块 + `--radius-sm`，shimmer 高光 320ms（`--duration-slow`，`--ease-standard`）线性扫过
- 按列结构定宽（四页统一）：badge 列 48 × 22px（对齐 `.as-badge` 22px 实高）；mono 列（编号 / Cron / 版本 / 日期 / 计数）64px；文字列按内容宽度 40–70%；操作列按该页 `.as-action-link` 数量逐枚 40 × 22px
- 骨架行数与该页真实示例行数一致（四页均为 8 行），避免加载完成后高度跳变
- KPI 骨架：`.as-kpi-value` 位 22px 高 × 72px 宽块（对齐 mono 22px 实字号）；`.as-kpi-label` 位 12px 高 × 56px 宽块；`.as-kpirow` 四联卡外框（`--surface-1` + `--mt-hairline` + `--shadow-1`）加载期间不变
- `@media (prefers-reduced-motion: reduce)`：shimmer 停止，骨架保持静态 `--surface-2` 块（并入 §5.6 既有 reduced-motion 清零契约）

### 6.4 禁用态规格（按钮与操作链接）

- 统一规格：`opacity: 0.45` / `cursor: not-allowed` / **移除 hover 背景、描边与文字变化**（`.as-btn-ghost:hover`、`.as-btn-accent:hover`、`.as-action-link:hover`、`.as-page-btn:hover` 全部不触发）/ 保持 `aria-disabled="true"` 暴露辅助语义
- 分页按钮与原生 `disabled` 属性叠加使用（沿用 §5.6「disabled 用原生属性」原则，`aria-disabled` 为语义冗余兜底）
- 面板级禁用（如 assessor 文档面板）只禁用其动作按钮，不下调整面板透明度、不隐藏面板，防止页面结构塌陷

### 6.5 加载与空态互斥

- 加载态与空态**互斥呈现**：同一数据区域同一时刻只存在「骨架」或「空态」之一——数据未回传前一律骨架（禁止在等待期间提前显示空态）；数据回传 0 条后才切换空态；禁止「加载中即显示无数据」的错误组合
- 切换顺序契约：骨架（请求中）→ 数据行（成功非空）或 空态（成功为空）；错误情形走行级 error 态（见 §6.6），不落入空态
- 筛选触发的二次加载：表格切回骨架但 `thead` 与工具栏交互不冻结；空态下调整筛选直接进入骨架，回传后再判定空/非空

### 6.6 行内加载（列级状态）与整表加载的区分

- **整表加载**：首次进入 / 翻页 / 重排时，`tbody` 整体替换为 8 行骨架（§6.3）；期间分页按钮与工具栏可保留交互（或按 §6.4 禁用），返回后回写全部行
- **行内加载（列级状态）**：单行业务动作（采集运行 / 飞书推送 / 失败重试）只变更该行的状态列与计数列，**不整表刷新**：
  - 进行中文案走 mono 规格（「采集中…」「推送中」），提亮为 info / warning 语义色以示活跃；计数位以小骨架块占位
  - 行内加载期间该行触发动作的 `.as-action-link` 进入禁用（§6.4），防重复触发
  - 终态回写只改该行：badge 切换 `data-tone`（success / error）、计数恢复 mono tabular-nums、相对时间刷新；行 hover 与其余列不变
- 判定规则：动作影响一行 → 行内加载；动作影响全量（筛选 / 排序 / 翻页）→ 整表骨架。两者不得混用（禁止为单行动作刷整表骨架，也禁止为翻页只做行内占位）

---

## 7. 错误态共性规范（AdminShell）

以下为四页 `X.10` 节共用的错误态契约，与既有 §5 / §6 同级生效；各页专属差异以其 X.10 节「本页专属」条目为准。

### 7.1 错误三级体系

错误按影响范围分三级，各级承载形式固定：

| 级别 | 影响范围 | 承载形式 | 实例 |
| --- | --- | --- | --- |
| 区域级 | 整个数据区（表格 / 面板）拉取失败 | 暗色错误面板（表格行 colspan / 面板内占位）+ 重试按钮 | 四页表格拉取失败、assessor 文档面板加载失败 |
| 行级 | 单行业务对象失败 | badge error 态 / 单元格内联 error 色 / 行首警示图标 + 操作列恢复链接 | gatherer 采集失败行、investigator 推送失败 badge、designer 409 冲突行 |
| 轻量级 | 单次操作失败（无数据变化） | 按钮 error 描边回弹 + toast；toggle 状态回退 | 批量发布失败、开关回弹、新建提交失败 |

- 三级不得错配：禁止为单行失败刷整表错误面板，也禁止为整表失败只弹 toast
- 错误不整行 / 整面板惩罚性染红：`--state-error` 色只出现在 badge、单元格文字、竖条、描边等局部载体上

### 7.2 暗色错误令牌三件套

错误视觉一律使用既有 error 三件套令牌（四页 CSS 中实际定义，勿自行取色）：

| 令牌 | 实际值（暗色主题） | 用途 |
| --- | --- | --- |
| `--state-error` | `var(--mt-error-400)`（#d68a82） | 描边、badge 文字/描边、单元格内联文字、竖条 |
| `--state-error-bg` | `#2f1f1d` | 错误面板底色 |
| `--state-error-text` | `#e0a89f` | 错误面板图标与高对比文字 |

- 暗色错误面板标准构成：`--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-md`；图标 18px `--state-error-text`（`cloud-off`＝网络类 / `alert-triangle`＝服务端与业务类）；标题 14px 600 `--text-strong`；描述 12.5px `--text-muted` + mono 错误码；重试按钮 `as-btn as-btn-ghost`
- KPI 错误降级为静默「—」：`.as-kpi-value` 显 mono「—」（`--text-faint`），不用红色（读数失败不是事故，是缺数）

### 7.3 badge error 第四态扩展规则

badge 语义在既有 success / faint / warning（含 investigator 私有 muted / faint）之外，统一扩展 **error** 第四态用于「动作 / 任务失败」：

- 规格完全复用既有 `.as-badge[data-tone="error"]` 规则：`--state-error` 文字+描边同色、透明底、22px 胶囊，不新增 CSS
- 进行中态（warning 描边 + mono 文案）与失败态（error 描边 + mono 文案）字号一致（11.5px `--font-mono`），保证状态机流转（faint → warning → success / error）时 badge 尺寸零跳动
- 失败态 badge 必须配套「操作列恢复链接」：原触发动作链接保留可点、语义变为重试（如「推送」→ 重推、「暂停」→「启用」），不另设弹窗
- 适用判定：仅**有明确重试语义**的状态列用 error badge；纯展示型失败（如计数为 0）用单元格内联 `--state-error` 色即可

### 7.4 错误 toast 规格（暗色）与复合结果反馈

- **普通错误 toast**：`--surface-2` 底 + 左 3px `--state-error` 竖条 + `--shadow-2` 浮层；标题 13px 600 `--text-strong` + 描述 12.5px `--text-muted` + mono 错误码 + 右下 mono 时间戳（HH:MM:SS）；右下角弹出，3s 消失
- **复合结果 toast（批量操作部分成功）**：左竖条改为**双色分段**（`--state-success` 上段 + `--state-error` 下段，总宽仍 3px）；标题「部分…成功」；描述分行给出「成功 N 条」+「失败 M 条」并归因失败原因；停留 5s（普通错误 toast 的延长形态）；N/M 数字一律 mono 600 tabular-nums
  - 全成功 → success toast（全条 `--state-success`）；全失败 → 普通 3s 错误 toast；仅混合结果使用复合形态
  - 复合结果必须落地到行：成功行按正常终态回写，失败行保持原态且保留重试入口；toast 不得是唯一结果披露渠道
- `prefers-reduced-motion: reduce`：toast 直接出现/消失，无位移过渡；复合 toast 停留时长不变

### 7.5 操作失败回弹规则（含 toggle 类控件）

- **按钮描边回弹**：操作类按钮（`.as-btn-primary` / `.as-btn-accent` / `.as-btn-ghost`）请求失败时短暂（600ms）切换为 1px `--state-error` 描边后回弹——文字、图标、底色不变（透明底保持透明），错误表达克制在描边层
- **toggle 状态回退**：开关类控件（`.as-toggle`）操作失败时，轨道与滑块以既有过渡参数（`--duration-fast` 120ms）回退至操作前位置，`title` 同步回写原状态；回弹期 600ms 内不可重复触发（防抖）；reduced-motion 下直接复位
- **表单提交失败**：已填内容一律保留不清空；冲突类错误在字段下方 12px `--state-error` 行内提示，非 toast 独占
- 回弹 / 回退与 toast 并发出现（视觉回弹 + 语义说明），二者不互斥

### 7.6 阈值自动降级规则

- 周期性任务（当前仅 gatherer 采集）设**连续失败阈值 3 次**：达到后系统自动暂停，行首加 `alert-triangle` 警示图标（12px `--state-error` + title 说明），开关保持未勾选但 `title` 切换为「已自动暂停」
- 自动暂停不删除数据、不移除重试入口（「启用」play 链接保留）；重试成功则清除警示与失败计数，再失败计数 +1 但不重复触发暂停
- 阈值规则用于**周期任务**；一次性操作（推送、分配、提交）不设自动重试 / 自动降级，一律手动重试（外发副作用类操作禁止自动重发）

### 7.7 错误优先级与状态判定顺序

- 三态判定顺序契约：**错误 > 空 > 数据**——请求失败永不落入空态、更不允许落入正向空态（如「队列已清空」）；空态判定只在「成功回传且 0 条」时成立（与 §6.5 互斥原则衔接：骨架 → 数据 / 空态，错误为独立第三分支）
- 409 冲突类错误特殊处理：**不自动重试**（重放无意义），引导刷新（「刷新该行」链接 / 复合 toast 归因）后再操作
- 页头徽标与 KPI 不因数据区失败伪造状态：warning「5 待审」保持原值、KPI 显「—」，未知不表达为正常

### 7.8 重试回骨架

- 手动 / 自动重试一律**先回骨架再回数据**：重试触发即整表切 8 行骨架（§6.3 令牌），禁止错误面板与骨架之外的第三种中间态
- 行级重试走行内加载（§6.6）：仅状态列 / 计数列进入进行中表达（mono「采集中…」「推送中」+ 计数骨架块），不整表刷新
- 自动重试上限 2 次（指数退避 1s / 4s），超过后停止自动重试、保留手动入口；自动重试过程无需用户感知文案（静默骨架即可）

### 7.9 无障碍（aria-live）

- 错误 toast 容器挂 `role="status"` + `aria-live="polite"`（不打断阅读）；灾难性 / 阻断操作类错误（提交失败导致数据可能丢失）用 `aria-live="assertive"`
- 表格区域级错误面板行带 `role="alert"`（插入即朗读）；行级 badge 状态翻转依托其所在单元格的 `aria-live="polite"` 容器播报
- toggle 回弹后开关 `title` 同步回写，视觉与读屏语义一致；禁用按钮保持 `aria-disabled="true"`（§6.4）
- 错误码对读屏可读：mono 错误码包含在 toast / 面板描述文本内，不依赖颜色单独传达错误（色弱可辨：竖条 / 描边 / 图标三通道冗余）

### 7.10 错误码命名规范

- 格式：**`ERR-<域>-<码>`**，全大写、连字符分隔、mono 呈现
- 域（四页固定）：`CMP`＝工坊组件 / `SRC`＝采集源 / `RSCH`＝调研 / `RVW`＝评审
- 码位：三位 HTTP 语义码（`409` 冲突 / `500` 服务端 / `503` 不可用 / `504` 超时）或三位业务序号（`003` 阈值触发类）；跨系统集成类可加子域后缀（如 `ERR-RSCH-FEISHU`、`ERR-RVW-DOC`）
- 同一错误在 toast / 面板 / 行级提示中携带同一错误码，便于日志对账；文案与错误码之间以空格 + mono 反引号呈现
