# MagicTools 前台交互说明 · 前台分册

> 适用范围：网关总览与 5 个业务前台（UserShell 亮色壳）
> 令牌体系：墨蓝石墨·工房感 v2.2 · 八应用 accent 派生
> 依据来源：`pages/` 下 6 个 HTML 设计稿的实际 DOM 与私有 CSS，全部交互元素均逐一核实，未含虚构项。

## 目录

- [1. 平台总览 · 网关（index.html）](#1-平台总览--网关indexhtml)
  - [1.9 错误态（Error State）](#19-错误态error-state)
- [2. 求职前台 · 岗位墙（applicant-front.html）](#2-求职前台--岗位墙applicant-fronthtml)
  - [2.9 错误态（Error State）](#29-错误态error-state)
- [3. 书库前台 · 馆藏检索（scholar-front.html）](#3-书库前台--馆藏检索scholar-fronthtml)
  - [3.9 错误态（Error State）](#39-错误态error-state)
- [4. 助手前台 · 智能对话（assistant-front.html）](#4-助手前台--智能对话assistant-fronthtml)
  - [4.9 错误态（Error State）](#49-错误态error-state)
- [5. 交付前台 · 需求看板（manager-front.html）](#5-交付前台--需求看板manager-fronthtml)
  - [5.9 错误态（Error State）](#59-错误态error-state)
- [6. 工坊前台 · 组件画廊（designer-front.html）](#6-工坊前台--组件画廊designer-fronthtml)
  - [6.9 错误态（Error State）](#69-错误态error-state)
- [7. 前台共性交互契约（UserShell）](#7-前台共性交互契约usershell)
- [8. 空态与加载态共性规范](#8-空态与加载态共性规范)
- [9. 错误态共性规范](#9-错误态共性规范)

---

## 1. 平台总览 · 网关（index.html）

### 1.1 页面定位

平台统一网关入口与「编辑部目录」式总览页，面向全部访客，承担八应用直达、事件流向说明与服务健康读数三项职责。accent 取兜底主色 `--mt-ink-600`（header 内联 `--app-accent: var(--mt-ink-600)`），不归属任何业务应用。主导航中「首页」为激活态，报头为 `MAGICTOOLS GATEWAY / 平台总览`。

### 1.2 页面结构

按实际 DOM 顺序：

1. **报头（us-masthead）**：品牌区（eyebrow + 应用名）→ 主导航（6 项，aria-label="主导航"）→ 动作区（仅「返回总览」链接，**本页 header 无「后台管理」按钮**）
2. **主区（us-main / pg-page）**
   - Hero（pg-hero）：衬线大标题「工具工房，八件套」+ 副文 + mono 平台读数行（在册应用 8 / 服务 17 / 事件契约 3）
   - 01 应用目录（pg-grid）：4×2 八卡目录墙，每卡 accent 顶边 4px，卡脚为 mono 路由读数（如 `/applicant · :3011`）
   - 02 事件流向（pg-flow-list）：3 条目录式事件条目（researcher.response.push / requirement.created / knowledge.item.collected）
   - 03 服务状态（pg-status）：mono 命令 `GATEWAY /status` + 服务计数 + 「全部健康」success 徽标
3. **页脚（us-footer）**：mono 注记「MagicTools · 统一网关入口」+ 管理后台链接 + 版权行

### 1.3 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
|---|------|----------------|------|----------|-----------|
| 1 | 导航 · 首页 | `a[data-nav-key="home"]`（`data-active="true"`） | 链接 | 点击跳转 | `./index.html`（当前页，激活下划线） |
| 2 | 导航 · 求职 | `a[data-nav-key="applicant"]`（`data-active="false"`） | 链接 | 点击跳转 | `./applicant-front.html` |
| 3 | 导航 · 书库 | `a[data-nav-key="scholar"]`（`data-active="false"`） | 链接 | 点击跳转 | `./scholar-front.html` |
| 4 | 导航 · 助手 | `a[data-nav-key="assistant"]`（`data-active="false"`） | 链接 | 点击跳转 | `./assistant-front.html` |
| 5 | 导航 · 交付 | `a[data-nav-key="manager"]`（`data-active="false"`） | 链接 | 点击跳转 | `./manager-front.html` |
| 6 | 导航 · 工坊 | `a[data-nav-key="designer"]`（`data-active="false"`） | 链接 | 点击跳转 | `./designer-front.html` |
| 7 | 返回总览 | `a[data-dom-id="back-platform"]`（`.us-back-link`） | 链接 | 点击跳转 | `./index.html`，图标 `data-lucide="arrow-left"` |
| 8 | 应用卡 · 求职工坊 | `a[data-dom-id="card-applicant"]`（`.pg-app-card--link`，`--card-accent: var(--app-applicant)`） | 链接卡 | 点击跳转 / hover 浮起 | `./applicant-front.html`；hover `translateY(-2px)` |
| 9 | 其余 7 张应用卡 | `a[data-dom-id="card-scholar" / "card-assistant" / "card-manager" / "card-designer" / "card-gatherer" / "card-investigator" / "card-assessor"]`（均为 `.pg-app-card--link`，各卡 `--card-accent` 互异） | 链接卡 | 点击跳转 / hover 浮起 | 学者书库→`./scholar-front.html`、智能助手→`./assistant-front.html`、交付管理→`./manager-front.html`、组件工坊→`./designer-front.html`、采集工坊→`./gatherer-admin.html`、调研工坊→`./investigator-admin.html`、评审工坊→`./assessor-admin.html`；hover `translateY(-2px)` |
| 10 | 页脚 · 管理后台 | `a.us-footer-admin` | 链接 | 点击跳转 | `#`（占位，网关页无单一后台归属），图标 `data-lucide="arrow-right"` |

注：应用目录八卡全部为可点击链接卡（`<a class="pg-app-card pg-app-card--link">`）；采集 / 调研 / 评审 3 卡路由标注「控制台」，直达各自后台控制台页。事件流向 3 条目与服务状态条均为静态内容，无交互绑定。

### 1.4 状态与反馈

- **悬停**：
  - 链接卡 `.pg-app-card--link:hover` → `transform: translateY(-2px)`（注释标注「目录墙唯一交互卡：轻微浮起」）+ 边框色过渡
  - 普通卡 `.pg-app-card:hover` → 仅 `border-color: var(--mt-hairline-strong)`，顶边保持 `--card-accent`
- **激活导航**：`.us-nav a[data-active="true"]` → 文字与 2px 下边线变 `--app-accent`（本页为 `--mt-ink-600`）；下边线使用「占位几何」——非激活态即 `border-bottom: 2px solid transparent`，激活仅变色不改变几何
- **焦点**：`.pg-app-card--link:focus-visible` → `outline: 2px solid var(--mt-ink-500); outline-offset: 2px`
- **动效令牌**：所有过渡使用 `--duration-fast`（120ms）+ `--ease-standard`（cubic-bezier(0.4,0,0.2,1)）

### 1.5 页面互跳

出向（本页可离开的全部入口，均为 `<a href>` 实现）：

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
|---|---|---|---|
| 导航 · 首页（当前页，active） | `a[data-nav-key="home"][data-active="true"]` | `./index.html` | `<a href>` |
| 导航 · 求职 | `a[data-nav-key="applicant"]` | `./applicant-front.html` | `<a href>` |
| 导航 · 书库 | `a[data-nav-key="scholar"]` | `./scholar-front.html` | `<a href>` |
| 导航 · 助手 | `a[data-nav-key="assistant"]` | `./assistant-front.html` | `<a href>` |
| 导航 · 交付 | `a[data-nav-key="manager"]` | `./manager-front.html` | `<a href>` |
| 导航 · 工坊 | `a[data-nav-key="designer"]` | `./designer-front.html` | `<a href>` |
| 返回总览 | `a[data-dom-id="back-platform"]`（`.us-back-link`） | `./index.html` | `<a href>` |
| 应用卡 · 求职工坊 | `a[data-dom-id="card-applicant"]` | `./applicant-front.html` | `<a href>` |
| 应用卡 · 学者书库 | `a[data-dom-id="card-scholar"]` | `./scholar-front.html` | `<a href>` |
| 应用卡 · 智能助手 | `a[data-dom-id="card-assistant"]` | `./assistant-front.html` | `<a href>` |
| 应用卡 · 交付管理 | `a[data-dom-id="card-manager"]` | `./manager-front.html` | `<a href>` |
| 应用卡 · 组件工坊 | `a[data-dom-id="card-designer"]` | `./designer-front.html` | `<a href>` |
| 应用卡 · 采集工坊（路由 `/gatherer · :3016 · 控制台`） | `a[data-dom-id="card-gatherer"]` | `./gatherer-admin.html` | `<a href>` |
| 应用卡 · 调研工坊（路由 `/investigator · :3017 · 控制台`） | `a[data-dom-id="card-investigator"]` | `./investigator-admin.html` | `<a href>` |
| 应用卡 · 评审工坊（路由 `/assessor · :3018 · 控制台`） | `a[data-dom-id="card-assessor"]` | `./assessor-admin.html` | `<a href>` |
| 页脚 · 管理后台 | `a.us-footer-admin` | —（占位 `href="#"`，网关页无单一后台归属，待定） | `<a href>` 占位 |

入向：5 个业务前台的「返回总览」（`back-platform`）与导航「首页」均回指本页；manager-front 的全局导航「首页」亦回指本页；assistant-retry-demo 页脚「返回助手前台」不经过本页。

### 1.6 可访问性与降级

- focus-visible：导航链接 / back-link / 页脚管理后台为 `outline: 2px solid var(--mt-ink-500)`；本页 header 无 admin-btn，故无琥珀焦点规则触发点
- aria：`nav[aria-label="主导航"]`；四个内容 section 均 `aria-labelledby` 指向各自标题（`pg-hero-title` / `pg-apps-title` / `pg-flow-title` / `pg-status-title`）；全部装饰图标 `aria-hidden="true"`
- `prefers-reduced-motion: reduce`：`.pg-app-card`、`.pg-app-card--link` 过渡全部禁用（`transition: none`）

### 1.7 响应式行为

- **≤960px**：目录墙 `.pg-grid` 降为 2 列；事件行 `.pg-flow` 由三列 grid 降为单列堆叠（`row-gap: var(--space-2)`）
- **≤920px**（UserShell 层）：报头换行，导航整行置底（order:3）；主区 padding 收窄为 `20px 16px 48px`
- **≤640px**：目录墙降 1 列；`.pg-page` 区块间距 `--space-7`→`--space-6`；小节标题头 `.pg-sec-head` 改纵向排列；读数行间距收紧；服务状态条 padding 收窄；页脚改纵向堆叠

### 1.8 空态与加载态

本页应用目录（`.pg-grid` 八卡）与事件流向（`.pg-flow-list` 三条目）为静态内容，不设空态与骨架；空态与加载态只作用于服务状态条（`.pg-status`）的降级态与首屏加载。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 网关不可达（`/status` 请求失败或超时） | 03 服务状态条 `.pg-status`（徽标位 `.pg-status-badge`） | 徽标由「全部健康」切换为 error 呈现：底 `--state-error-bg`、文字 `--state-error-text`、12px/700、`--radius-sm`，文案「网关不可达」；命令行 `terminal` 图标（15px）由 `--mt-ink-600` 变 `--state-error`；条体保持 `--surface-1` 底 + hairline 边框 + `--radius-md` 几何不变（降级只换语义色，不动布局） | 徽标右侧追加下划线文字链接「重试 /status」：`--font-mono` / 12px / `--mt-ink-600`，hover `--mt-ink-700` 且下划线随色；点击重新拉取状态 |
| 部分服务异常（`/status` 返回非全绿） | 同上 | 徽标换 warning 呈现：底 `--state-warning-bg`、文字 `--state-warning-text`，文案「部分降级」；mono 计数同步为「17 服务 · 2 异常」（`--text-muted`） | 同上；事件流向区（02）不受降级影响，保持静态 |

注：本页空态不使用大留白空态卡——服务状态条是单行读数条，降级态以「语义色徽标 + 重试链接」的行内方式呈现，不铺虚线框、不用位图插画。

#### 加载态（Loading State）

- **首屏**：页面 CSS（us-shell / critical-layout）全部内联、无运行时依赖，首屏静态内容直接以令牌底色呈现，**不设整体骨架屏、不出 spinner**；唯一异步点是服务状态条的 `/status` 读数
- **状态条局部加载**：`/status` 返回前，徽标位与计数位铺行内骨架块——徽标骨架 72×22px、计数骨架 64×16px，均 `--surface-2` 底 + `--radius-sm`；命令行 `GATEWAY /status` 文字直出
- **首屏 vs 局部**：状态条位于首屏末尾但首屏可见，读数随首屏立即拉取（不延迟到滚动）；其余区块（hero / 目录墙 / 事件流）纯静态、无加载概念
- **动效**：shimmer 扫光 `linear-gradient(90deg, transparent, var(--surface-1) 50%, transparent)`，时长 `--duration-slow`（320ms）+ `--ease-standard` 循环；禁止旋转 spinner（工房感不用转圈）
- **降级**：`prefers-reduced-motion: reduce` 时 shimmer 停止，骨架退为静态 `--surface-2` 块

#### 文案规范

- error：徽标「网关不可达」+ mono 描述「/status 未响应 · 请稍后重试」
- warning：徽标「部分降级 · 2/17」+ mono 描述「部分服务无响应，事件流转可能延迟」

### 1.9 错误态（Error State）

错误态作用于服务状态条（`.pg-status`）与健康检查失败的徽标位；目录墙、事件流向为静态结构不出错误态。与 1.8 的关系：`/status` pending 显示骨架，fulfilled 且全绿显示 success 徽标「全部健康」，rejected 或非全绿进入本节错误/降级态；错误判定优先于空态。

#### 区域级错误（可重试）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 服务状态检查失败（`/status` rejected 或非 2xx） | 03 服务状态条 `.pg-status`（徽标位 `.pg-status-badge`） | 徽标由 success 切换为 error 呈现：底 `--state-error-bg`、文字 `--state-error-text`、12px/700、`--radius-sm`，文案「部分服务不可用」；命令区 `.pg-status-cmd` 变化：`terminal` 图标（15px）由 `--mt-ink-600` 变 `--state-error`，mono 命令文案由 `GATEWAY /status` 追加失败读数（如 `GATEWAY /status · ERR-GW-504`）；服务计数 `.pg-status-count` 同步为「17 服务 · 3 不可用」（mono / `--state-error-text`）；条体保持 `--surface-1` 底 + hairline 边框 + `--radius-md` 几何不变（只换语义色，不动布局） | 徽标右侧下划线文字链接「重试 /status」：`--font-mono` / 12px / `--mt-ink-600`，hover `--mt-ink-700` 且下划线随色；点击后徽标位与计数位回到 1.8 定义的行内骨架（72×22px + 64×16px、`--surface-2` 底） |
| 应用卡片目标不可达（点击 `card-applicant` 链接卡后目标页加载失败 / 预检探活失败） | 01 目录墙链接卡 `.pg-app-card--link`（`--card-accent: var(--app-applicant)`） | 卡片本体不铺错误面板——顶边 4px accent 条保持不变，卡脚 mono 路由读数位（`/applicant · :3011`）替换为「`:3011 · ERR-CONN-502`」（`--font-mono` / 12px / `--state-error-text`）；卡内追加 14px 行内提示「目标应用暂不可达，稍后重试」（`--font-body` / 12.5px / `--state-error-text`）；hover 浮起 `translateY(-2px)` 保留（链接仍可点，允许用户重试进入） | 保持可点击即重试：点击重新导航；卡脚读数位旁不加独立按钮，避免目录墙降噪失败；探活恢复后读数自动回显 mono 路由 |

- **降级判定**：`/status` 返回非全绿但网关自身存活时走 1.8 已定义的 warning 档（「部分降级」`--state-warning-bg`/`--state-warning-text`）；本节 error 档仅用于网关自身 rejected/超时，两档互斥不叠加。
- **重试行为**：点击「重试 /status」→ 状态条回到 1.8 局部骨架 → 成功回 success 徽标、失败回 error 徽标；连续失败 3 次后重试链接文案追加 mono 计数「第 3 次」，不做自动重试（网关页为读数页，静默轮询由实现方决定，视觉层不承诺）。
- **优先级**：错误态优先于空态判断——`/status` 失败时不得显示任何「服务 0」类空读数，计数位保持错误描述或回骨架。

#### 行内/轻量错误（toast 与字段）

本页无表单字段与行内写操作，不使用 toast 与字段级错误；网关页错误全部以状态条徽标 + 卡脚读数降级的行内方式呈现（与 1.8「不使用大留白空态卡」同口径，错误同样不铺大面板）。

#### 降级与重试策略

- **网络级 vs 服务端**：`ERR-NET-XXX`（fetch 抛出/超时）命令区显示「/status 网络超时 · 请检查连接」；`ERR-GW-5XX`（响应非 2xx）显示「/status 返回 `ERR-GW-504` · 网关繁忙」。两者徽标文案统一「部分服务不可用」，靠命令区 mono 读数区分。
- **自动重试**：无自动重试；手动入口唯一（重试链接）。
- **互斥关系**：骨架（pending）→ success/error 徽标（settled）；error 期间不显示空态、不显示 success 徽标。

#### 文案规范

- error：徽标「部分服务不可用」+ mono 描述「GATEWAY /status · `ERR-GW-504` · 3/17 无响应」+ 动作「重试 /status」
- 网络超时：徽标「部分服务不可用」+ mono 描述「/status 网络超时 · `ERR-NET-408`」+ 动作「重试 /status」
- 卡片降级：卡脚「`:3011 · ERR-CONN-502`」+ 行内「目标应用暂不可达，稍后重试」

---

## 2. 求职前台 · 岗位墙（applicant-front.html）

### 2.1 页面定位

求职工坊对外的「编辑部特稿」式岗位墙，面向求职者浏览在招岗位并进入简历工坊。accent 为砖红 `var(--app-applicant)`（`#a8522e`，header 内联 `--app-accent: var(--app-applicant)`）。报头 `APPLICANT · 求职工坊 / 岗位墙`，主导航「岗位墙」激活，导航组为本应用私有 3 项。

### 2.2 页面结构

1. **报头**：品牌区 → 导航（wall / resume / review）→ 动作区（返回总览 + 后台管理琥珀描边按钮）
2. **主区（us-main）**
   - 特稿 hero（pg-hero）：`VOL.09 · 在招岗位` 刊号 + 大标题「把简历排进编辑部」（em 强调色砖红）+ 右侧统计（在招 12 / 本周新增 +3），砖红浅底 `--app-applicant-tint`
   - 筛选行（pg-filters）：城市组（北京/上海/远程）+ 职类组（前端/后端/产品）胶囊 + 右侧 mono 计数「精选 07 / 12」
   - 岗位墙（pg-wall）：2 列杂志网格——头条卡（跨 2 列，含 JD 摘要侧栏与「查看详情」按钮）、大卡 ×2、小卡 ×4，共 7 张岗位卡
   - 简历工坊入口卡（pg-studio）：凹面 surface-2 横幅 + pen-tool 圆形图标 + 「进入工坊」按钮
3. **页脚**：注记「每一份履历都值得被认真排印」+ 管理后台 + 版权

### 2.3 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
|---|------|----------------|------|----------|-----------|
| 1 | 导航 · 岗位墙 | `a[data-nav-key="wall"]`（`data-active="true"`） | 链接 | 点击跳转 | `./applicant-front.html`（当前页） |
| 2 | 导航 · 简历中心 | `a[data-nav-key="resume"]`（`data-active="false"`） | 链接 | 点击跳转 | `#`（占位） |
| 3 | 导航 · 面试复盘 | `a[data-nav-key="review"]`（`data-active="false"`） | 链接 | 点击跳转 | `#`（占位） |
| 4 | 返回总览 | `a[data-dom-id="back-platform"]` | 链接 | 点击跳转 | `./index.html` |
| 5 | 后台管理 | `a[data-dom-id="link-admin"]`（`.us-admin-btn`） | 链接按钮 | 点击跳转 | `./applicant-admin.html`，琥珀描边 + `wrench` 图标 |
| 6 | 城市筛选 · 北京 | `button.pg-pill[data-active="true"]`（城市组第 1 项） | 胶囊按钮 | 点击切换选中 | 选中态砖红浅底 `--app-applicant-tint` + 砖红文字 |
| 7 | 城市筛选 · 上海 | `button.pg-pill[data-active="false"]` | 胶囊按钮 | 点击切换选中 | 同上 |
| 8 | 城市筛选 · 远程 | `button.pg-pill[data-active="false"]` | 胶囊按钮 | 点击切换选中 | 同上 |
| 9 | 职类筛选 · 前端 | `button.pg-pill[data-active="true"]`（职类组第 1 项） | 胶囊按钮 | 点击切换选中 | 同上 |
| 10 | 职类筛选 · 后端 | `button.pg-pill[data-active="false"]` | 胶囊按钮 | 点击切换选中 | 同上 |
| 11 | 职类筛选 · 产品 | `button.pg-pill[data-active="false"]` | 胶囊按钮 | 点击切换选中 | 同上 |
| 12 | 查看详情（头条岗位） | `a.pg-btn`（头条卡 `.pg-lead-side-action` 内） | 次级按钮 | 点击跳转 | `#`（占位），`arrow-up-right` 图标 |
| 13 | 岗位卡 ×7 | `.pg-job`（含 `.pg-job-lead` ×1、`.pg-job-lg` ×2、小卡 ×4，均为 article 非链接） | 展示卡 | 仅 hover 反馈 | hover 边框变砖红 + `translateY(-2px)` + 卡题变砖红 |
| 14 | 进入工坊（简历工坊） | `a.pg-btn`（`.pg-studio-action` 内） | 次级按钮 | 点击跳转 | `#`（占位），`arrow-up-right` 图标 |
| 15 | 页脚 · 管理后台 | `a.us-footer-admin` | 链接 | 点击跳转 | `./applicant-admin.html` |

注：岗位卡上的标签（`pg-tag-head` 头条岗位 / `pg-tag-warning` 急聘 / `pg-tag-info` 新招 / `pg-tag-neutral` 在招）与筛选计数「精选 07 / 12」均为静态展示。

### 2.4 状态与反馈

- **悬停**：
  - `.pg-pill:hover` → 背景 `--surface-2`、文字 `--text-body`
  - `.pg-job:hover` → `border-color: var(--app-applicant)` + `transform: translateY(-2px)`（`--duration-base` 200ms）；`.pg-job:hover .pg-job-title` → 标题变砖红
  - `.pg-btn:hover` → 边框与文字变 `--app-applicant`
- **激活/选中**：`.pg-pill[data-active="true"]` → 背景 `--app-applicant-tint`、文字 `--app-applicant`、字重 600
- **按压**：`.pg-btn:active` → 背景 `--surface-2`
- **焦点**：`.pg-pill:focus-visible` 与 `.pg-btn:focus-visible` → `outline: 2px solid var(--app-applicant); outline-offset: 2px`
- **动效令牌**：卡片用 `--duration-base`，按钮/胶囊用 `--duration-fast`，缓动均 `--ease-standard`

### 2.5 页面互跳

出向：

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
|---|---|---|---|
| 返回总览 | `a[data-dom-id="back-platform"]`（`.us-back-link`） | `./index.html` | `<a href>` |
| 后台管理（报头按钮） | `a[data-dom-id="link-admin"]`（`.us-admin-btn`） | `./applicant-admin.html` | `<a href>` |
| 页脚 · 管理后台 | `a.us-footer-admin` | `./applicant-admin.html` | `<a href>` |
| 导航 · 简历中心 / 面试复盘 | `a[data-nav-key="resume"]` / `a[data-nav-key="review"]` | `#`（占位，页签未实装） | `<a href>` 占位 |
| 查看详情（头条岗位） / 进入工坊（简历工坊） | `a.pg-btn` ×2 | `#`（占位） | `<a href>` 占位 |

入向：来自网关导航「求职」与目录墙链接卡 `card-applicant`。

### 2.6 可访问性与降级

- focus-visible：本页私有控件焦点环统一为砖红 2px；UserShell 层导航/返回为墨蓝、admin 按钮为琥珀
- aria：hero `aria-label="本期在招岗位特稿"`、hero 统计 `aria-label="在招统计"`、筛选行 `aria-label="岗位筛选"`、岗位墙 `aria-label="岗位墙"`、入口卡 `aria-label="简历工坊入口"`；图标均 `aria-hidden="true"`
- `prefers-reduced-motion: reduce`：`.pg-job / .pg-job-title / .pg-pill / .pg-btn` 过渡禁用，且 `.pg-job:hover { transform: none }` 取消浮起

### 2.7 响应式行为

- **≤920px**（UserShell 层）：报头换行、导航整行置底
- **≤860px**：hero 改纵向（标题 32px，统计区改为上边线 + 横排）；头条卡降单列（侧栏改上边线）；筛选计数 `.pg-filter-count` 换行占满宽
- **≤720px**：岗位墙降 1 列；头条标题降至 22px；「进入工坊」按钮拉通 100% 宽
- **≤640px**（UserShell 层）：品牌区限宽 58%、admin 按钮收窄、页脚纵向堆叠

### 2.8 空态与加载态

空态与加载态只作用于岗位墙网格（`.pg-wall`）；hero 特稿、筛选行（`.pg-filters`）、简历工坊入口卡（`.pg-studio`）为常驻结构，不设空态。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 岗位全部筛空（城市 × 职类组合无匹配岗位，如「上海 × 前端」） | 岗位墙 `.pg-wall` 整体替换 | 图标 `search-x`（data-lucide）32px / `--text-faint`；空态标题「这一组合暂无在招」：`--font-display` / 15px / 600 / `--text-body`；描述「换个城市或职类试试，编辑部每周更新岗位」：`--font-body` / 13px / `--text-muted`；动作按钮「清除筛选」复用 `.pg-btn` 次级按钮语言（`--surface-1` 底 + `--mt-hairline-strong` 描边 + 34px 高，hover 砖红描边 `--app-applicant`）；区域留白上下 `--space-7`、左右跟随网格宽；空态外框用 `--mt-hairline` 1px 虚线（`border-radius: var(--radius-lg)`）或纯留白二选一，禁止位图插画 | 点击「清除筛选」重置城市/职类胶囊至默认（北京 / 前端），岗位墙回到初始 7 卡 |
| 检索/在招库为空（服务返回岗位总数为 0，非筛选所致） | 同上 | 图标 `newspaper`（data-lucide）32px / `--text-faint`；标题「本期特稿还在排版」；描述「编辑部正在准备下一期岗位，先去简历工坊打磨履历」；动作改「进入工坊」accent 下划线链接（`--app-applicant` / 13px / 600 / `text-underline-offset: 4px`，hover `--app-applicant-ink`） | 链接跳转简历工坊；或等岗位发布后重新进入本页 |

注：筛选计数 `.pg-filter-count` 同步显示「精选 00 / 12」（mono / `--text-faint`），与空态文案互为印证，不互相替代。

#### 加载态（Loading State）

- **首屏整体骨架**：岗位墙首屏即铺骨架卡阵，占位与真实网格同构（2 列 `repeat(2, minmax(0,1fr))`、gap 16px）——头条骨架 1 张跨 2 列（高约 200px）+ 大卡骨架 2 张（高约 160px）+ 小卡骨架 4 张（高约 150px），共 7 个占位与初始卡数一致
- **骨架块规格**：统一 `--surface-2` 底 + `--radius-lg` 卡壳（对齐 `.pg-job` 的 `--radius-lg`）；卡内文字行（标题/机构/薪资行）用 `--surface-2` + `--radius-sm` 的行块模拟，行高对齐真实行高（标题行 17px→22px 块、meta 行 12px→16px 块）
- **筛选局部加载**：切换城市/职类胶囊后仅岗位墙区重铺骨架，hero、筛选行、入口卡不动；骨架期间筛选计数显示「精选 -- / --」
- **首屏 vs 局部**：hero 与筛选行首屏静态直出（无骨架）；简历工坊入口卡在岗位墙之后、滚动到位即静态呈现，不延迟加载
- **动效**：shimmer 扫光 `linear-gradient(90deg, transparent, var(--surface-1) 50%, transparent)`，`--duration-slow`（320ms）+ `--ease-standard` 循环；禁止旋转 spinner
- **降级**：`prefers-reduced-motion: reduce` 时 shimmer 停止，骨架退为静态 `--surface-2` 块

#### 文案规范

- 筛空：标题「这一组合暂无在招」+ 描述「换个城市或职类试试，编辑部每周更新岗位」+ 按钮「清除筛选」
- 库空：标题「本期特稿还在排版」+ 描述「编辑部正在准备下一期岗位，先去简历工坊打磨履历」+ 链接「进入工坊」

### 2.9 错误态（Error State）

错误态作用于岗位墙网格（`.pg-wall`）的区域级接口失败，与卡片上的收藏/投递行内动作失败反馈；hero 特稿、筛选行、简历工坊入口卡为常驻结构不出错误态。与 2.8 的关系：pending 铺骨架卡阵，fulfilled 非空出卡、fulfilled 且空出空态（2.8），rejected 进入本节错误面板；错误优先于空态，禁止以「岗位 0」空态兜底接口失败。

#### 区域级错误（可重试）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 岗位列表接口失败（首屏或切换筛选后 `/api/jobs` rejected / 非 2xx） | 岗位墙 `.pg-wall` 整体替换（hero、筛选行、`.pg-studio` 不动） | 图标 `wifi-off`（网络级）或 `cloud-off`（服务端）data-lucide 18px / `--state-error-text`；错误面板：底 `--state-error-bg` + 1px `--state-error` 描边 + `--radius-md`，宽随网格（2 列模板保持，面板跨满宽），留白上下 `--space-7`、居中排布；标题「岗位墙暂时失联」：`--font-body` / 14px / 600 / `--text-strong`；描述「拉取在招岗位失败（`ERR-JOB-503`），可重试或稍后再来」：12.5px / `--text-muted`，错误码 mono 直排；重试按钮复用 `.pg-btn` 次级按钮语言（`--surface-1` 底 + `--mt-hairline-strong` 描边 + 34px 高，hover 砖红描边 `--app-applicant`），文案「重试」+ `refresh-cw` 图标（14px）；筛选计数 `.pg-filter-count` 同步为「精选 -- / --」 | 点击「重试」→ 岗位墙回到 2.8 定义的骨架卡阵（头条 1 + 大卡 2 + 小卡 4 同构占位）→ 成功出卡、失败回错误面板；重试期间按钮禁用并回到骨架，面板即刻让位 |
| 筛选切换接口失败（城市/职类胶囊切换后的增量拉取 rejected） | 同上（仅岗位墙区重铺，筛选胶囊保持用户已选项） | 同上结构，标题换「这一组岗位没拉取成功」；已选胶囊保持砖红选中态不变（错误不回滚用户选择） | 同上；「重试」按当前筛选组合重新拉取；不改写胶囊选中态 |

- **自动重试**：首屏失败自动静默重试 1 次（间隔 `--duration-slow` 级短退避）；仍失败才出面板。面板出现后不再自动重试，手动入口唯一。
- **优先级**：错误 > 空 > 加载完成。接口 rejected 时即使响应体携带空数组语义也一律出错误面板。

#### 行内/轻量错误（toast 与字段）

- **收藏动作失败（toast）**：岗位卡无独立收藏按钮的设计稿态下，本规格预留给「收藏/快速投递」行内动作接入时使用——toast：`--surface-1` 底 + 左侧 3px `--state-error` 竖条 + `--radius-md` + `--shadow-2`；文案「收藏失败 · `ERR-FAV-500`，请稍后再试」（`--font-body` / 13px / `--text-body`，错误码 mono），右上角 mono 时间戳（`--font-mono` / 11px / `--text-faint`，如 `09:41:07`）；停留 3s 自动消失，hover 可延迟；同一动作 3s 内重复失败只刷新时间戳不叠 toast。
- **投递动作失败（toast）**：同上规格，文案「投递未能送达 · `ERR-APPLY-502`，岗位仍可重投」；不阻塞卡片其余区域。
- 本页无表单字段，无字段级错误。

#### 降级与重试策略

- **网络级 vs 服务端**：网络级（fetch 抛出/超时）图标用 `wifi-off`、描述「网络不稳，岗位墙没拉取成功（`ERR-NET-408`）」；服务端（非 2xx）图标用 `cloud-off`、描述「编辑部服务暂时不可用（`ERR-JOB-503`）」。两档面板结构一致，仅图标与文案区分。
- **重试回骨架**：一切手动重试先回 2.8 骨架卡阵，禁止从错误面板直接翻转到内容（保持加载感知）。
- **互斥关系**：骨架/内容/空态/错误态四者互斥单态呈现；错误面板期间 hero 统计（在招 12 / 本周新增 +3）如来自同一接口需同步隐藏数字为「--」，不得保留旧值误导。

#### 文案规范

- 首屏失败：标题「岗位墙暂时失联」+ 描述「拉取在招岗位失败（`ERR-JOB-503`），可重试或稍后再来」+ 按钮「重试」
- 网络超时：标题「这一组岗位没拉取成功」+ 描述「网络不稳，岗位墙没拉取成功（`ERR-NET-408`）」+ 按钮「重试」
- 行内失败：toast「收藏失败 · `ERR-FAV-500`，请稍后再试」/「投递未能送达 · `ERR-APPLY-502`，岗位仍可重投」

---

## 3. 书库前台 · 馆藏检索（scholar-front.html）

### 3.1 页面定位

学者书库对外的「图书馆目录」检索页，面向长期阅读者按类目浏览馆藏书目。accent 为馆藏绿 `var(--app-scholar)`（`#2f5a3b`，header 内联 `--app-accent: var(--app-scholar)`）。报头 `SCHOLAR · 学者书库 / 馆藏检索`，导航「馆藏检索」激活。

### 3.2 页面结构

1. **报头**：品牌区 → 导航（catalog / graph / inbox）→ 动作区（返回总览 + 后台管理）
2. **主区（us-main / pg-page）**
   - 馆藏检索栏（pg-search）：羊皮纸浅绿底 + 馆藏绿 3px 顶线；标题「馆藏目录」+ mono 索引元数据「在册 1,284 卷 · 本月新收 36」；检索条 = 检索输入域（放大镜图标 + search 输入框 + `/` 键位提示）+「高级检索」文字按钮
   - 类目圈定行（pg-categories）：书签式标签 4 枚，底边与目录基线衔接（`margin-bottom: -1px`）
   - 书目目录（pg-catalog-list）：6 条三列 grid 条目（4px 书脊竖条 / 主体标题+来源+摘要 / 右侧类目+日期+质量徽标）
   - 知识图谱横幅（pg-graph-banner）：network 圆角图标 + 说明 + 「查看图谱」按钮
3. **页脚**：注记「牛皮纸与馆藏绿，为长阅读而生」+ 管理后台 + 版权

### 3.3 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
|---|------|----------------|------|----------|-----------|
| 1 | 导航 · 馆藏检索 | `a[data-nav-key="catalog"]`（`data-active="true"`） | 链接 | 点击跳转 | `./scholar-front.html`（当前页） |
| 2 | 导航 · 知识图谱 | `a[data-nav-key="graph"]`（`data-active="false"`） | 链接 | 点击跳转 | `#`（占位） |
| 3 | 导航 · 收件箱 | `a[data-nav-key="inbox"]`（`data-active="false"`） | 链接 | 点击跳转 | `#`（占位） |
| 4 | 返回总览 | `a[data-dom-id="back-platform"]` | 链接 | 点击跳转 | `./index.html` |
| 5 | 后台管理 | `a[data-dom-id="link-admin"]` | 链接按钮 | 点击跳转 | `./scholar-admin.html`，琥珀描边 + `wrench` |
| 6 | 馆藏检索输入框 | `input.pg-search-input`（`type="search"`，`aria-label="检索馆藏目录"`，placeholder「检索书名、作者、来源或关键词」） | 搜索输入 | 聚焦输入 | 容器 `:focus-within` 绿色 2px 聚焦环；`/` 键位提示为装饰（`kbd.pg-kbd[aria-hidden="true"]`） |
| 7 | 高级检索 | `button.pg-adv-btn`（`type="button"`） | 文字按钮 | 点击展开高级条件 | 无页面内实现（设计稿态）；hover 变绿 + 下划线 |
| 8 | 类目 · 前端工程 | `a.pg-cat[aria-current="true"]` | 书签标签 | 点击切换类目 | `#`；激活态绿浅底 + 绿字（注意：本页用 `aria-current` 而非 `data-active`） |
| 9 | 类目 · 产品设计 | `a.pg-cat` | 书签标签 | 点击切换类目 | `#` |
| 10 | 类目 · 数据科学 | `a.pg-cat` | 书签标签 | 点击切换类目 | `#` |
| 11 | 类目 · 行业研究 | `a.pg-cat` | 书签标签 | 点击切换类目 | `#` |
| 12 | 书目条目 ×6 | `li.pg-entry`（含 `.pg-spine` 书脊） | 展示行 | 仅 hover 反馈 | hover 边框加深、书脊变深绿 `--app-scholar-ink`、标题变深绿 |
| 13 | 查看图谱 | `a.pg-graph-btn` | 次级按钮 | 点击跳转 | `#`（占位），`arrow-right` 图标；hover 绿边框 + 绿浅底 |
| 14 | 页脚 · 管理后台 | `a.us-footer-admin` | 链接 | 点击跳转 | `./scholar-admin.html` |

注：条目右侧质量徽标（`.pg-quality--complete` 摘要完备 / `.pg-quality--review` 摘要待校）为静态状态展示。

### 3.4 状态与反馈

- **悬停**：
  - `.pg-search-field:hover` → 边框 `--mt-graphite-400`
  - `.pg-adv-btn:hover` → 文字变 `--app-scholar` + 下划线（`text-underline-offset: 5px`）
  - `.pg-cat:hover` → 文字 `--app-scholar-ink`、背景 `--surface-1`
  - `.pg-entry:hover` → 边框 `--mt-hairline-strong`；书脊与标题变 `--app-scholar-ink`
  - `.pg-graph-btn:hover` → 边框/文字变绿、背景 `--app-scholar-tint`
- **聚焦**：`.pg-search-field:focus-within` → 背景 `--surface-1`、边框 `--app-scholar`、`box-shadow: 0 0 0 2px var(--app-scholar)`（2px 绿环），放大镜图标同步变绿
- **激活**：`.pg-cat[aria-current="true"]` → 背景 `--app-scholar-tint`、文字 `--app-scholar`
- **焦点环**：`.pg-cat / .pg-adv-btn / .pg-graph-btn :focus-visible` → `outline: 2px solid var(--app-scholar); outline-offset: 2px`
- **动效令牌**：全部 `--duration-fast` + `--ease-standard`

### 3.5 页面互跳

出向：

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
|---|---|---|---|
| 返回总览 | `a[data-dom-id="back-platform"]`（`.us-back-link`） | `./index.html` | `<a href>` |
| 后台管理（报头按钮） | `a[data-dom-id="link-admin"]`（`.us-admin-btn`） | `./scholar-admin.html` | `<a href>` |
| 页脚 · 管理后台 | `a.us-footer-admin` | `./scholar-admin.html` | `<a href>` |
| 导航 · 知识图谱 / 收件箱 | `a[data-nav-key="graph"]` / `a[data-nav-key="inbox"]` | `#`（占位，页签未实装） | `<a href>` 占位 |
| 类目 ×4 / 查看图谱 | `a.pg-cat` ×4 / `a.pg-graph-btn` | `#`（占位） | `<a href>` 占位 |

入向：来自网关导航「书库」与目录墙链接卡 `card-scholar`。

### 3.6 可访问性与降级

- 输入框带 `aria-label="检索馆藏目录"`；`/` 键位徽标 `aria-hidden="true"`（纯视觉提示，无按键监听实现）
- 类目导航 `nav[aria-label="类目筛选"`，当前项用 `aria-current="true"` 语义标注；目录区 `aria-label="书目目录"`
- focus-visible：馆藏绿 2px 环（本页私有控件）
- `prefers-reduced-motion: reduce`：`.pg-search-field / .pg-cat / .pg-entry / .pg-spine / .pg-entry-title / .pg-adv-btn / .pg-graph-btn` 过渡全部禁用

### 3.7 响应式行为

- **≤920px**（UserShell 层）：报头换行、导航整行置底
- **≤860px**：条目元数据列收窄至 150px、列距收紧
- **≤640px**：检索条改纵向（高级检索按钮 42px 高、右对齐）；条目降为两列两行结构（书脊跨 2 行，元数据移至第二行横排）；图谱横幅换行且按钮拉通 100% 宽
- **≤640px**（UserShell 层）：品牌限宽、页脚纵向堆叠

### 3.8 空态与加载态

空态与加载态作用于书目目录列表（`.pg-catalog-list`）；检索栏（`.pg-search`）、类目圈定行（`.pg-categories`）、知识图谱横幅（`.pg-graph-banner`）为常驻结构，不设空态。

#### 空态（Empty State）

检索空态必须区分两种成因，文案互不通用：

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 无匹配结果（有检索词或非默认类目下，命中数为 0） | 书目目录 `.pg-catalog-list` 整体替换（保留类目行与图谱横幅） | 图标 `search-x`（data-lucide）32px / `--text-faint`；空态标题「没有找到匹配的书目」：`--font-display` / 15px / 600 / `--text-body`；描述「换个关键词试试，或去掉类目限制检索全馆藏」：`--font-body` / 13px / `--text-muted`；动作「清除检索」复用 `.pg-adv-btn` 文字按钮语言（`--app-scholar-ink` / 13px / 600，hover 变 `--app-scholar` + 下划线 `text-underline-offset: 5px`）；区域留白上下 `--space-7`；空态框用 `--mt-hairline-strong` 1px 虚线 + `--radius-md`（与目录行 `.pg-entry` 同族几何）或纯留白，禁止位图插画 | 点击清空检索词并切回默认类目「前端工程」，列表回到初始 6 条 |
| 库藏为空（当前类目下在册总数为 0，与检索词无关） | 同上 | 图标 `book-open`（data-lucide）32px / `--app-scholar`；标题「这个书架还空着」：`--font-display` / 15px / 600 / `--text-body`；描述「馆藏正在编目上架，新收条目会自动归目入藏」：`--font-body` / 13px / `--text-muted`；动作「去别的类目逛逛」accent 下划线链接（`--app-scholar` / 13px / 600 / `text-underline-offset: 5px`，hover `--app-scholar-ink`） | 点击切换至任一非空类目；新书上架后列表自动出现 |

注：检索索引元数据 `.pg-index-meta` 在无匹配时同步为「命中 0 卷 · 在册 1,284 卷」（mono / `--text-muted`），标明是检索无果而非库空。

#### 加载态（Loading State）

- **首屏整体骨架**：目录列表首屏铺 6 条目录行骨架，与真实 `.pg-entry` 同构——三列 grid（4px 书脊 / 主体 / 200px 元数据列）保持列宽模板 `4px minmax(0,1fr) 200px`，每行高 72px（对齐真实行 `.pg-entry` 的 `--space-4` 上下 padding + 三行文字实际高度），行距 `--space-3`
- **骨架块规格**：卡壳 `--surface-1` 底 + `--mt-hairline` 边框 + `--radius-md`（与真实行一致，边框保留、内容铺灰）；书脊位 4×48px 竖块、标题行 17px→22px 块、来源行 12px→14px 块、摘要行 13.5px→16px 块、右侧元数据铺 64×20px + 72×14px 两块，均 `--surface-2` 底 + `--radius-sm`
- **检索局部加载**：输入检索词触发查询时仅列表区重铺骨架（首 3 条即可，其余留白），检索栏、类目行、图谱横幅不动
- **首屏 vs 局部**：检索栏与类目行首屏静态直出；图谱横幅在目录列表之后、滚动到位即静态呈现，不延迟加载
- **动效**：shimmer 扫光 `linear-gradient(90deg, transparent, var(--surface-1) 50%, transparent)`，`--duration-slow`（320ms）+ `--ease-standard` 循环；禁止旋转 spinner
- **降级**：`prefers-reduced-motion: reduce` 时 shimmer 停止，骨架退为静态 `--surface-2` 块

#### 文案规范

- 无匹配：标题「没有找到匹配的书目」+ 描述「换个关键词试试，或去掉类目限制检索全馆藏」+ 动作「清除检索」
- 库藏空：标题「这个书架还空着」+ 描述「馆藏正在编目上架，新收条目会自动归目入藏」+ 动作「去别的类目逛逛」

### 3.9 错误态（Error State）

错误态作用于检索请求失败（检索栏下方的行内错误条）与知识图谱入口加载失败；类目圈定行、检索栏本体为常驻结构不出错误态。与 3.8 的关系：pending 铺目录骨架，fulfilled 非空出条目、fulfilled 且空出空态（3.8），rejected 进入本节错误态；错误优先于空态，禁止以「命中 0 卷」兜底请求失败。

#### 区域级错误（可重试）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 检索请求失败 · 服务端错误（`/api/catalog` 返回非 2xx） | 检索栏 `.pg-search-bar` 下方错误条 + 书目目录 `.pg-catalog-list` 整体替换 | **错误条**：紧贴检索条下缘（`margin-bottom: var(--space-3)` 与目录区同距），`--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-md`，行内横排——图标 `cloud-off`（data-lucide）18px / `--state-error-text` + 标题「检索服务暂时不可用」：`--font-body` / 14px / 600 / `--text-strong` + 描述「这次检索没有完成（`ERR-SCHOLAR-500`），书目目录已暂停展示」：12.5px / `--text-muted`，错误码 mono + 重试动作「重新检索」accent 下划线链接（`--app-scholar` / 13px / 600 / `text-underline-offset: 5px`，hover `--app-scholar-ink`）；**目录区**：列表替换为同族几何的留白占位（保持类目行与图谱横幅不动）。`aria-live="assertive"` 挂于错误条容器 | 点击「重新检索」→ 目录区回到 3.8 定义的 6 条目录行骨架（三列 grid 同构）→ 成功出条目并撤错误条、失败错误条刷新时间戳与错误码 |
| 检索请求失败 · 网络超时（fetch 超时 / 断网） | 同上 | 同上结构，仅三处换装：图标换 `wifi-off`；标题「网络不稳定，检索中断」；描述「请求超时（`ERR-NET-408`），请检查网络后重新检索」 | 同上；重试沿用当前检索词与类目，不回滚输入框内容 |
| 知识图谱入口加载失败（`.pg-graph-banner` 数据源探活 rejected） | 03 图谱横幅 `.pg-graph-banner` 行内 | 横幅结构保持（`network` 圆角图标区 + 说明 + 按钮不变），仅按钮降级：`查看图谱` 按钮（`.pg-graph-btn`）描边与文字换 `--state-error`、禁用（`cursor: not-allowed`、移除 hover 绿底规则），按钮文案换「图谱暂不可达」；横幅描述行追加 mono 小字「`ERR-GRAPH-503`」（12px / `--state-error-text`） | 探活成功自动恢复按钮态与文案；失败期间点击无效（禁用即防重试风暴），横幅说明文字保留可用 |

- **自动重试**：检索失败自动重试 1 次（仅网络级，服务端错误不自动重试）；图谱探活按静默轮询（间隔 ≥30s），不向用户暴露轮询过程。
- **优先级**：错误 > 空 > 加载完成。rejected 时 `.pg-index-meta` 索引元数据显示「检索未完成」（mono / `--text-muted`），禁止显示「命中 0 卷」。

#### 行内/轻量错误（toast 与字段）

- 本页无写操作与表单字段，不使用 toast 与字段级错误；检索失败以「错误条 + 目录区让位」的区域级方式呈现，符合检索类页面的主任务聚焦原则。
- 输入框（`.pg-search-input`）本身无校验规则（空关键词不触发检索，视为无操作），无字段错误态。

#### 降级与重试策略

- **网络级 vs 服务端**：网络超时用 `wifi-off` + 「请求超时（`ERR-NET-408`）」；服务端错误用 `cloud-off` + 「这次检索没有完成（`ERR-SCHOLAR-500`）」。两档错误条几何与令牌一致，仅图标、标题、错误码区分。
- **重试回骨架**：「重新检索」先回 3.8 目录骨架（首 3 条 + 留白），检索栏与类目行保持静态直出。
- **互斥关系**：错误条与空态互斥——错误期间不出「没有找到匹配的书目」；图谱入口降级独立于检索错误，可并存但互不影响（横幅属常驻结构）。

#### 文案规范

- 服务端：标题「检索服务暂时不可用」+ 描述「这次检索没有完成（`ERR-SCHOLAR-500`），书目目录已暂停展示」+ 链接「重新检索」
- 网络超时：标题「网络不稳定，检索中断」+ 描述「请求超时（`ERR-NET-408`），请检查网络后重新检索」+ 链接「重新检索」
- 图谱降级：按钮「图谱暂不可达」+ mono「`ERR-GRAPH-503`」

---

## 4. 助手前台 · 智能对话（assistant-front.html）

### 4.1 页面定位

智能助手对外的双栏对话工作区，面向日常问答用户，覆盖澄清追问、数据表格回答、引用溯源与打字中反馈四类对话形态。accent 为瓷青 `var(--app-assistant)`（`#4a688c`，header 内联 `--app-accent: var(--app-assistant)`）。报头 `ASSISTANT · 智能助手 / 对话`，导航「对话」激活。

### 4.2 页面结构

1. **报头**：品牌区 → 导航（chat / feedback）→ 动作区（返回总览 + 后台管理）
2. **主区（us-main / pg-chat，双栏 grid：260px + 1fr）**
   - 左栏 · 会话侧栏（pg-sessions，surface-0）：「新对话」实心按钮 → 「历史会话」标签 → 6 条会话项（首项激活，左侧 2px 瓷青条）→ 底部 mono 意图注记
   - 右栏 · 对话主区（pg-stage，surface-1 大面板）：标题栏（会话名 + mono 会话号 `CHAT-2026-0908-A7F2`）→ 消息流（用户气泡 ×2、澄清气泡含是/否选项、数据气泡含 mono 表与引用来源、打字中三点气泡）→ 输入区（message-square 图标 + 输入框 + 「发送」实心按钮 + 能力小注）
3. **页脚**：注记「有据可依的回答，来源可追溯」+ 管理后台 + 版权

### 4.3 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
|---|------|----------------|------|----------|-----------|
| 1 | 导航 · 对话 | `a[data-nav-key="chat"]`（`data-active="true"`） | 链接 | 点击跳转 | `./assistant-front.html`（当前页） |
| 2 | 导航 · 使用反馈 | `a[data-nav-key="feedback"]`（`data-active="false"`） | 链接 | 点击跳转 | `#`（占位） |
| 3 | 返回总览 | `a[data-dom-id="back-platform"]` | 链接 | 点击跳转 | `./index.html` |
| 4 | 后台管理 | `a[data-dom-id="link-admin"]` | 链接按钮 | 点击跳转 | `./assistant-admin.html`，琥珀描边 + `wrench` |
| 5 | 新对话 | `button.pg-new-chat`（`type="button"`） | 实心主按钮 | 点击新建会话 | 瓷青实心底 + `plus` 图标；hover 深瓷青，按压墨蓝 |
| 6 | 历史会话项 ×6 | `a.pg-session-item`（首条 `data-active="true"`） | 列表链接 | 点击切换会话 | `#`；hover 浅灰底；激活项瓷青浅底 + 左侧 2px 瓷青条 + 标题加粗 |
| 7 | 澄清选项 · 是 | `button.pg-choice-btn[data-selected="true"]`（`.pg-choice[role="group"][aria-label="澄清选项"]` 内） | 选项按钮 | 点击选择 | 已选中：瓷青描边 + 瓷青浅底 + 深字 |
| 8 | 澄清选项 · 否 | `button.pg-choice-btn` | 选项按钮 | 点击选择 | 未选中：中性描边；hover 墨蓝描边 |
| 9 | 引用来源 | `a.pg-cite`（数据气泡内） | mono 链接 | 点击查看知识条目 | `#`；文案「引用来源 · knowledge/KB-HR-012 · 调休与考勤管理」；hover 深墨蓝 + 下划线随色 |
| 10 | 对话输入框 | `.pg-input input`（`type="text"`，`aria-label="对话输入框"`，placeholder「问点什么…支持多轮追问」） | 文本输入 | 输入内容 | 容器 `:focus-within` 边框变瓷青 |
| 11 | 发送 | `button.pg-send`（`type="button"`） | 实心主按钮 | 点击发送 | 瓷青实心 + `send` 图标 + 文案「发送」；hover 深瓷青，按压墨蓝 |
| 12 | 打字中指示器 | `.pg-bubble-typing`（`aria-label="助手正在输入"`）+ `.pg-typing-dot` ×3 | 状态展示 | 无操作 | 三点跳动动画（1.2s 循环，延迟 0.15s/0.3s）；reduced-motion 降级为静态 |
| 13 | 数据表格 | `table.pg-table`（数据气泡内，3 行 2 列） | 内容展示 | 无操作 | mono 表格，末行无下边线 |
| 14 | 页脚 · 管理后台 | `a.us-footer-admin` | 链接 | 点击跳转 | `./assistant-admin.html` |

注：会话标题栏、意图注记（`intents · data_query / trouble / knowledge / ticket`）、能力小注均为静态展示。

### 4.4 状态与反馈

- **悬停**：`.pg-new-chat:hover` / `.pg-send:hover` → 背景 `--app-assistant-ink`；`.pg-session-item:hover` → 背景 `--surface-2`；`.pg-choice-btn:hover` → 边框 `--mt-ink-400`、文字 `--mt-ink-700`；`.pg-cite:hover` → 文字 `--mt-ink-700` 且下划线随色
- **按压**：`.pg-new-chat:active` / `.pg-send:active` → 背景 `--mt-ink-700`
- **激活/选中**：`.pg-session-item[data-active="true"]` → 背景 `--app-assistant-tint`、标题 `--app-assistant-ink` 加粗、`::before` 左侧 2px 瓷青条（top/bottom 9px）；`.pg-choice-btn[data-selected="true"]` → 瓷青描边 + 浅底 + 深字加粗
- **聚焦**：`.pg-input:focus-within` → 边框 `--app-assistant`
- **加载态**：打字中气泡 `pg-typing-bounce` 关键帧（translateY(0→-3px→0)，opacity 0.45↔1，1.2s 无限循环）
- **焦点环**：`.pg-new-chat / .pg-choice-btn / .pg-send / .pg-session-item / .pg-cite :focus-visible` → `outline: 2px solid var(--mt-ink-500)`（session-item offset 为 1px）
- **动效令牌**：交互过渡 `--duration-fast`；动画用 `--ease-standard`

### 4.5 页面互跳

出向：

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
|---|---|---|---|
| 返回总览 | `a[data-dom-id="back-platform"]`（`.us-back-link`） | `./index.html` | `<a href>` |
| 后台管理（报头按钮） | `a[data-dom-id="link-admin"]`（`.us-admin-btn`） | `./assistant-admin.html` | `<a href>` |
| 页脚 · 管理后台 | `a.us-footer-admin` | `./assistant-admin.html` | `<a href>` |
| 导航 · 使用反馈 | `a[data-nav-key="feedback"]` | `#`（占位，页签未实装） | `<a href>` 占位 |
| 历史会话项 ×6 / 引用来源 | `a.pg-session-item` ×6 / `a.pg-cite` | `#`（占位） | `<a href>` 占位 |

入向：来自网关导航「助手」与目录墙链接卡 `card-assistant`。

### 4.6 可访问性与降级

- aria：侧栏 `aria-label="会话列表"`、会话列表 `aria-label="历史会话"`、工作区 `aria-label="智能对话工作区"`、对话区 `aria-label="对话区"`、消息流 `aria-label="对话消息流"`、选项组 `role="group" aria-label="澄清选项"`、输入框 `aria-label="对话输入框"`、打字气泡 `aria-label="助手正在输入"`
- focus-visible：墨蓝 2px 环覆盖全部本页私有控件
- `prefers-reduced-motion: reduce`：`.pg-typing-dot` 动画禁用并降级为静态三点（opacity 0.7）；`.pg-new-chat / .pg-send / .pg-choice-btn / .pg-session-item / .pg-cite / .pg-input` 过渡禁用

### 4.7 响应式行为

- **≤920px**：双栏收为单栏（`.pg-chat` 单列）；会话列表转横向滚动条带（`.pg-session-list` 改 row + `overflow-x: auto`），会话项固定宽 200px；侧栏取消最小高度
- **≤640px**：消息流 padding 收窄、间距 16→12；标题栏改纵向（会话号换行）；发送按钮隐藏文字仅留图标（`.pg-send span { display: none }`，padding 收为 0 14px）防挤压换行
- **≤640px**（UserShell 层）：品牌限宽、页脚纵向堆叠

### 4.8 空态与加载态

空态作用于会话侧栏（`.pg-sessions`）的历史会话区；加载态覆盖「历史消息加载」与「AI 回复生成中」两种对话气泡流状态。新对话按钮（`.pg-new-chat`）、输入区（`.pg-composer`）为常驻结构，不设空态。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 新用户无历史会话（会话列表拉取完成且为空） | 左栏「历史会话」标签与 `.pg-session-list` 区 | 图标 `message-square`（data-lucide，与输入区同图标成呼应）24px / `--text-faint`；空态标题「还没有历史会话」：`--font-display` / 15px / 600 / `--text-body`；描述「在右侧问出第一个问题，对话会自动归档到这里」：`--font-body` / 13px / `--text-muted`；无独立动作按钮——「新对话」按钮（`.pg-new-chat`）本身就在空态正上方常驻，空态不再重复；区域留白上下 `--space-6`，左对齐排布（侧栏窄列，不居中）；空态不用外框虚线、以纯留白呈现，禁止位图插画 | 用户发送第一条消息后，会话自动建档并出现在列表首位；空态随之消失 |
| 当前会话无消息（刚点「新对话」、气泡流为空） | 右栏消息流 `.pg-stream` 首屏 | 图标 `bot`（data-lucide，与网关八卡同图标）28px / `--app-assistant`；标题「开始你的第一段对话」：`--font-display` / 15px / 600 / `--text-body`；描述「支持多轮追问 · 数据查询 · 知识检索 · 工单处理」：`--font-body` / 13px / `--text-muted`（与能力小注口径一致）；无动作按钮，光标直接落在输入框；区域留白上下 `--space-7`，居中于 `.pg-stage` | 输入并发送第一条消息即进入对话 |

注：侧栏空态只在列表拉取**完成后**判定（互斥规则见第 8 章）；拉取中先铺侧栏骨架，不闪空态。

#### 加载态（Loading State）

- **会话侧栏骨架**：列表拉取期间铺 4 条会话项骨架，与真实 `.pg-session-item` 同构（padding 9px 10px 9px 13px + `--radius-md`）——每条含标题行块（13px→16px 高、60% 宽）与日期行块（11px→12px 高、40% 宽），均 `--surface-2` 底 + `--radius-sm`；「新对话」按钮与「历史会话」标签静态直出
- **历史消息加载（切换会话时）**：右栏消息流铺 3 个气泡骨架，与真实气泡同构——用户气泡右对齐（宽约 320px、高 64px、右上无圆角）、助手气泡左对齐（宽约 480px、高 88px、左上无圆角），底 `--surface-2` + `--radius-lg`（气泡壳整体即骨架块，内部不再分层）；标题栏（会话名 + 会话号）与输入区静态直出
- **AI 回复生成中**：沿用既有 `.pg-bubble-typing` 三点气泡（`pg-typing-bounce` 1.2s 循环、6px 点、`--app-assistant` 色、延迟 0.15s/0.3s 错落）作为生成中指示，**不引入 spinner**；发送按钮在生成期间禁用（不换图标、不变灰之外的额外动效）；流式回复逐字渲染时以 12px 块状光标（`--app-assistant`）行尾跟随，替代三点气泡
- **首屏 vs 局部**：首屏整体骨架仅侧栏列表 + 首会话消息流两处；输入区、标题栏静态直出；切换历史会话属局部加载，只重铺消息流
- **动效**：骨架 shimmer 扫光 `linear-gradient(90deg, transparent, var(--surface-1) 50%, transparent)`，`--duration-slow`（320ms）+ `--ease-standard` 循环；禁止旋转 spinner（工房感不用转圈）
- **降级**：`prefers-reduced-motion: reduce` 时 shimmer 停止退为静态 `--surface-2` 块；三点气泡降级为静态三点（opacity 0.7，与既有 4.6 规则一致）；流式光标停闪

#### 文案规范

- 侧栏空：标题「还没有历史会话」+ 描述「在右侧问出第一个问题，对话会自动归档到这里」
- 气泡流空：标题「开始你的第一段对话」+ 描述「支持多轮追问 · 数据查询 · 知识检索 · 工单处理」
- 生成中：气泡 aria-label「助手正在输入」（沿用既有文案）；超 8s 未响应在三点气泡下追加 mono 小字「正在组织回答 · 稍候」

### 4.9 错误态（Error State）

> **深度展开**：AI 回复失败气泡重试的完整状态机、五类错误码矩阵、重试时序、动效与验收清单，见《[深度补充 · AI 回复失败气泡重试功能](./deep-dive-assistant-retry.md)》（`docs/deep-dive-assistant-retry.md`）。

错误态是本页的关键态——对话类产品的错误必须留在对话流内（气泡级），不得整屏拦截。覆盖两类：AI 回复生成失败的气泡内错误态、模型路由全部失败的输入区禁用态。与 4.8 的关系：pending 显示三点气泡（生成中），流式渲染完成出正常气泡，生成 rejected 时三点气泡**原位翻转为错误气泡**（不新增位置、不滚动跳变）；错误优先于空态。

#### 区域级错误（可重试）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 模型路由失败 · 全部模型不可用（DeepSeek 与智谱路由同时 rejected，会话级熔断） | 对话主区 `.pg-stage`：消息流底部 + 输入区 `.pg-composer` | 消息流末尾追加系统级错误条（`--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-md`，横排 `alert-triangle`（data-lucide）18px / `--state-error-text` + 标题「模型服务暂不可用」：`--font-body` / 14px / 600 / `--text-strong` + 描述「全部模型路由失败（`ERR-LLM-503`），新消息暂无法发送，历史对话仍可浏览」：12.5px / `--text-muted`，错误码 mono），`aria-live="assertive"`；**输入区禁用**：`.pg-input` 边框换 `--state-error`、输入框 `disabled` + placeholder 换「模型暂不可用 · 稍后自动恢复」；「发送」按钮（`.pg-send`）背景降为 `--mt-graphite-400`、禁点（与 6.8 designer 提交中同款禁用语义色）；左栏会话侧栏与新对话按钮不受影响（会话列表仍可切换浏览） | 路由探活成功后自动解除：错误条淡出（`--duration-slow`）、输入区恢复瓷青聚焦与可用态；错误条内不放手动重试（避免输入区上方堆叠入口），探活静默轮询（间隔 ≥15s） |
| 会话切换 · 历史消息拉取失败（切换 `.pg-session-item` 后消息流接口 rejected） | 右栏消息流 `.pg-stream` 整体替换 | 图标 `cloud-off`（data-lucide）18px / `--state-error-text`；错误面板：`--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-md`，居中于 `.pg-stage`、留白上下 `--space-7`；标题「这段对话没能加载」：`--font-body` / 14px / 600 / `--text-strong`；描述「历史消息拉取失败（`ERR-CHAT-500`），重试或切换其他会话」：12.5px / `--text-muted`；重试动作「重新加载」accent 下划线链接（`--app-assistant` / 13px / 600 / `text-underline-offset: 4px`，hover `--app-assistant-ink`）；标题栏（会话名 + 会话号）与输入区保持直出 | 点击「重新加载」→ 消息流回到 4.8 定义的三气泡骨架（用户 320px / 助手 480px 同构）→ 成功出历史消息、失败回错误面板；侧栏激活项保持所选会话不变 |

- **自动重试**：生成失败不自动重发（避免重复消耗与重复扣费歧义），一律等用户点气泡内「重试」；会话切换拉取失败自动重试 1 次。
- **优先级**：错误 > 空 > 加载完成——新会话气泡流为空但生成失败时，仍出错误气泡，不出 4.8 的「开始你的第一段对话」空态。

#### 行内/轻量错误（toast 与字段）

- **对话气泡错误（本页专属，对话类产品关键错误态）**：生成 rejected 时，该轮 pending 的 `.pg-bubble-typing` 三点气泡**原位翻转**为错误气泡 `.pg-bubble pg-bubble-bot` 错误呈现——气泡描边换 1px `--state-error`、底色换 `--state-error-bg`（几何与圆角 `--radius-lg`、左对齐位置均不变）；气泡内：`alert-triangle` 图标 14px / `--state-error-text` + 错误文案「这条回答没能生成（`ERR-LLM-429`），问题可能问得太急了」：`--font-body` / 13.5px / `--text-body` + 错误码 mono 小字 + 「重试」accent 下划线链接（`--app-assistant` / 13px / 600，hover `--app-assistant-ink`）；点击「重试」→ 该气泡回到三点气泡（生成中）→ 成功原位渲染答案、失败再次翻转错误气泡（刷新错误码与时间戳）；用户气泡（右侧）永远不出现错误态，发送失败以输入区上方行内提示呈现（「上一条未送达 · 回车重发」12.5px / `--state-error-text`，输入框内容保留）。
- 本页无表单字段，无字段级错误；toast 不用于对话错误（气泡内自证更符合对话上下文）。

#### 降级与重试策略

- **网络级 vs 服务端**：网络中断（`ERR-NET-XXX`）错误气泡文案「网络中断，回答没能送达」+ `wifi-off` 语义；模型限流/服务端（`ERR-LLM-429`/`ERR-LLM-503`）文案「这条回答没能生成，问题可能问得太急了」；单模型故障但路由可用时**不报错**（静默切换备用模型），仅全部路由失败才触发输入区禁用态。
- **自动重试**：单模型失败自动换路由 1 次（对用户不可见）；全部失败出系统错误条；气泡错误不自动重试。
- **互斥关系**：错误气泡与三点气泡互斥（同一轮次原位翻转）；系统错误条存在期间，输入区禁用优先于一切输入反馈；错误期间侧栏浏览不受限。

#### 文案规范

- 生成失败：气泡「这条回答没能生成（`ERR-LLM-429`），问题可能问得太急了」+ 链接「重试」
- 全模型不可用：错误条「模型服务暂不可用」+「全部模型路由失败（`ERR-LLM-503`），新消息暂无法发送，历史对话仍可浏览」+ placeholder「模型暂不可用 · 稍后自动恢复」
- 发送未送达：行内「上一条未送达 · 回车重发」；历史加载失败：「这段对话没能加载」+「历史消息拉取失败（`ERR-CHAT-500`），重试或切换其他会话」+「重新加载」

---

## 5. 交付前台 · 需求看板（manager-front.html）

### 5.1 页面定位

交付管理对外的「FLIGHT DECK 交付驾驶舱」，面向项目交付相关方纵览需求流转与迭代交付节奏。accent 为钢蓝 `var(--app-manager)`（`#3a5f84`，header 内联 `--app-accent: var(--app-manager)`）。报头 `MANAGER · WORKSPACE / 交付管理`。注意：本页导航沿用网关 6 项全局导航（非应用私有导航），且非激活项**未写 `data-active="false"`**，仅激活项标注 `data-active="true"`。

### 5.2 页面结构

1. **报头**：品牌区 → 全局导航 6 项（home/applicant/scholar/assistant/manager/designer，manager 激活且 `href="#"`）→ 动作区（返回总览 + 后台管理）
2. **主区（us-main / pg-page）**
   - FLIGHT DECK hero（pg-flight）：mono 眉题「FLIGHT DECK · 交付驾驶舱」+ 衬线标题 + 副文 + mono 读数行（活跃需求 24 / 本迭代交付 8 / 阻塞 3 / 完成率 67%）
   - 01 关键读数（pg-kpis）：4 张 KPI 卡，surface-1 + 顶部 4px 钢蓝顶边 + `--shadow-1`
   - 02 泳道看板（pg-swimlanes）：3 列（待启动 3 / 进行中 3 / 已交付 2），共 8 张需求卡（标题 + P0/P1/P2 徽标 + 负责人 + 工期）
   - 03 迭代切换（pg-iter-bar）：mono 标签「迭代」+ 3 枚 IT 编号切换项（可横向滚动）
3. **页脚**：注记「MagicTools · 交付管理工坊」+ 管理后台 + 版权

### 5.3 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
|---|------|----------------|------|----------|-----------|
| 1 | 导航 · 首页 | `a[data-nav-key="home"]`（无 data-active 属性） | 链接 | 点击跳转 | `./index.html` |
| 2 | 导航 · 求职 | `a[data-nav-key="applicant"]` | 链接 | 点击跳转 | `./applicant-front.html` |
| 3 | 导航 · 书库 | `a[data-nav-key="scholar"]` | 链接 | 点击跳转 | `./scholar-front.html` |
| 4 | 导航 · 助手 | `a[data-nav-key="assistant"]` | 链接 | 点击跳转 | `./assistant-front.html` |
| 5 | 导航 · 交付 | `a[data-nav-key="manager"][data-active="true"]` | 链接 | 点击跳转 | `#`（当前场景自身，钢蓝激活下划线） |
| 6 | 导航 · 工坊 | `a[data-nav-key="designer"]` | 链接 | 点击跳转 | `./designer-front.html` |
| 7 | 返回总览 | `a[data-dom-id="back-platform"]` | 链接 | 点击跳转 | `./index.html` |
| 8 | 后台管理 | `a[data-dom-id="link-admin"]` | 链接按钮 | 点击跳转 | `./manager-admin.html`，琥珀描边 + `wrench` |
| 9 | KPI 卡 ×4 | `.pg-kpi`（活跃需求 24 / 今日交付 8 / 阻塞项 3 / 完成率 67%） | 静态读数卡 | 无 | 顶部 4px 钢蓝顶边，无 hover/点击态 |
| 10 | 需求卡 ×8 | `article.pg-req`（含 `.pg-req-badge[data-tone]` P0×1 / P1×3 / P2×4） | 展示卡 | 仅 hover 反馈 | hover 边框加深为 `--mt-hairline-strong`；无跳转 |
| 11 | 迭代项 · IT-014 | `a.pg-iter-item[data-active="true"]` | 切换标签 | 点击切换迭代 | `#`；激活态 surface-2 底 + 钢蓝描边 |
| 12 | 迭代项 · IT-013 | `a.pg-iter-item` | 切换标签 | 点击切换迭代 | `#`；hover 灰底深字 |
| 13 | 迭代项 · IT-012 | `a.pg-iter-item` | 切换标签 | 点击切换迭代 | `#`；hover 灰底深字 |
| 14 | 页脚 · 管理后台 | `a.us-footer-admin` | 链接 | 点击跳转 | `./manager-admin.html` |

注：优先级徽标语义色——`data-tone="p0"` error 红、`"p1"` warning 琥珀、`"p2"` info 蓝，均为静态。

### 5.4 状态与反馈

- **悬停**：`.pg-req:hover` → `border-color: var(--mt-hairline-strong)`（无位移）；`.pg-iter-item:hover` → 文字 `--text-body`、背景 `--surface-2`
- **激活**：`.pg-iter-item[data-active="true"]` → 文字 `--text-strong`、背景 `--surface-2`、`border-color: var(--app-manager)`（1px 钢蓝描边，透明描边占位几何）
- **焦点**：本页私有 CSS 未给 `.pg-req / .pg-iter-item` 定义 focus-visible 规则（键盘焦点依赖浏览器默认 outline）；UserShell 层导航/按钮焦点规则照常生效
- **动效令牌**：`.pg-req` 与 `.pg-iter-item` 均 `--duration-fast` + `--ease-standard`，仅过渡 color/background/border

### 5.5 页面互跳

出向（本页持有六页最全的全局导航组）：

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
|---|---|---|---|
| 导航 · 首页 | `a[data-nav-key="home"]` | `./index.html` | `<a href>` |
| 导航 · 求职 | `a[data-nav-key="applicant"]` | `./applicant-front.html` | `<a href>` |
| 导航 · 书库 | `a[data-nav-key="scholar"]` | `./scholar-front.html` | `<a href>` |
| 导航 · 助手 | `a[data-nav-key="assistant"]` | `./assistant-front.html` | `<a href>` |
| 导航 · 交付（当前页，active） | `a[data-nav-key="manager"][data-active="true"]` | `#`（自指占位，钢蓝激活下划线） | `<a href>` 占位 |
| 导航 · 工坊 | `a[data-nav-key="designer"]` | `./designer-front.html` | `<a href>` |
| 返回总览 | `a[data-dom-id="back-platform"]`（`.us-back-link`） | `./index.html` | `<a href>` |
| 后台管理（报头按钮） | `a[data-dom-id="link-admin"]`（`.us-admin-btn`） | `./manager-admin.html` | `<a href>` |
| 页脚 · 管理后台 | `a.us-footer-admin` | `./manager-admin.html` | `<a href>` |
| 迭代项 ×3 | `a.pg-iter-item` ×3 | `#`（占位） | `<a href>` 占位 |

入向：来自网关导航「交付」与目录墙链接卡 `card-manager`。

### 5.6 可访问性与降级

- aria：四个内容区均 `aria-labelledby`（`pg-flight-title` / `pg-kpi-title` / `pg-board-title` / `pg-iter-title`）；导航 `aria-label="主导航"`
- focus-visible：仅 UserShell 控件有显式焦点环；`.pg-iter-item` 为可点击链接，键盘可达但无自定义焦点样式（实现时建议补齐）
- `prefers-reduced-motion: reduce`：`.pg-req`、`.pg-iter-item` 过渡禁用

### 5.7 响应式行为

- **≤960px**：KPI 行降 2 列；泳道看板降单列纵向堆叠（列间发丝线由左边线改为上边线）
- **≤920px**（UserShell 层）：报头换行、导航整行置底（全局导航 6 项在窄屏横向滚动）
- **≤640px**：KPI 降 1 列；区块间距 `--space-7`→`--space-6`；小节标题头改纵向
- 迭代切换条本身 `overflow-x: auto`，任意宽度下可横向滚动

### 5.8 空态与加载态

空态与加载态作用于泳道看板（`.pg-swimlanes`）的泳道列与需求卡；FLIGHT DECK hero、KPI 行（`.pg-kpis`）、迭代切换条（`.pg-iter-bar`）为常驻结构，不设空态。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 空泳道（某泳道列当前迭代无需求卡，泳道头计数为 0） | 该列 `.pg-swimlane-cards` 卡片区内 | 占位虚线框：`--mt-hairline-strong` 1px dashed 边框 + `--radius-md`，高约 96px（约一张需求卡高度），内部居中一行文案「暂无需求」：`--font-body` / 13px / `--text-faint`；不配图标、不配动作按钮（看板空列是常态业务状态，克制处理）；列头 `.pg-swimlane-head`（名称 + mono 计数 0）保持常驻，几何不变 | 无主动恢复动作——待启动列等新需求流入自动填充；「已交付」列空态文案换为「本迭代暂无交付」 |
| 全板为空（当前迭代三条泳道均无卡） | 三列 `.pg-swimlane-cards` 同时铺占位框 | 三列各自占位虚线框（规格同上）；三列文案分别为「暂无需求」「暂无进行中需求」「本迭代暂无交付」；不做整板大空态卡，保持泳道骨架结构可见 | 切换迭代条（IT-013 / IT-012）查看往期；需求流入后自动填充 |

注：占位虚线框遵循第 8 章三层构成的低配档（仅文案、免图标与动作）——泳道列是结构容器，空态不应喧宾夺主；禁止位图插画。

#### 加载态（Loading State）

- **首屏整体骨架**：看板区首屏铺三列骨架——列头（名称 + 计数）静态直出，卡片区按当前迭代真实卡数铺需求卡骨架（无数据时按 3/3/2 铺），每卡与真实 `.pg-req` 同构：`--surface-0` 底 + `--mt-hairline` 边框 + `--radius-md` + padding `--space-3`；卡内标题行块（13.5px→18px、80% 宽）+ 徽标块（28×20px）+ meta 行块（12px→14px、60% 宽），内容块均 `--surface-2` 底 + `--radius-sm`，卡高对齐真实卡约 88px
- **KPI 行骨架**：4 张 KPI 卡骨架与 `.pg-kpi` 同构（含顶部 4px accent 顶边占位，顶边用 `--app-manager` 30% 透明实色占位、不参与 shimmer），标签块（64×14px）+ 数值块（48×28px），`--surface-2` 底 + `--radius-sm`
- **迭代切换局部加载**：点击 IT-013 / IT-012 后仅看板区与 KPI 行重铺骨架，hero 与迭代条不动；骨架期间迭代项保持激活态样式不变
- **首屏 vs 局部**：hero（含 mono 读数行）首屏静态直出；KPI 行与看板为异步读数区、首屏整体骨架；迭代条静态直出
- **动效**：shimmer 扫光 `linear-gradient(90deg, transparent, var(--surface-1) 50%, transparent)`，`--duration-slow`（320ms）+ `--ease-standard` 循环；禁止旋转 spinner（工房感不用转圈）
- **降级**：`prefers-reduced-motion: reduce` 时 shimmer 停止，骨架退为静态 `--surface-2` 块

#### 文案规范

- 空泳道：「暂无需求」（待启动）/「暂无进行中需求」（进行中）/「本迭代暂无交付」（已交付）
- 加载中：看板区右上 mono 小字「载入需求 · --/8」，完成后随数据消失（进度计数规范见第 8 章）

### 5.9 错误态（Error State）

错误态作用于泳道看板（`.pg-swimlanes`）的数据拉取失败与迭代切换失败；FLIGHT DECK hero、KPI 行、迭代切换条本体为常驻结构不出错误态。与 5.8 的关系：pending 铺三列骨架，fulfilled 出卡（空列出 5.8 空态虚线框），rejected 进入本节错误态；错误优先于空态，禁止以「暂无需求」空列兜底接口失败。

#### 区域级错误（可重试）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 看板数据拉取失败（首屏 `/api/board` rejected / 非 2xx） | 泳道区 `.pg-swimlanes`——**三列列头（`.pg-swimlane-head` 名称 + mono 计数）保留，仅列身（`.pg-swimlane-cards`）替换** | 三列网格结构不变（列间发丝线照常）；每列列身内各自嵌一张窄错误面板：`--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-md`，高约 96px（对齐 5.8 空列虚线框高度，避免 CLS）；面板内：图标 `cloud-off`（网络级）/ `wifi-off`（超时）data-lucide 18px / `--state-error-text` + 单行标题「看板数据拉取失败」：`--font-body` / 14px / 600 / `--text-strong` + mono 错误码「`ERR-BOARD-503`」（12px / `--state-error-text`）；**重试按钮只放一次**——置于三列之外的看板区右上（小节头 `.pg-sec-head` 行内，`refresh-cw` 图标 14px + 文案「重试」次级按钮：`--surface-1` 底 + `--mt-hairline-strong` 描边 + `--radius-md`，hover 钢蓝描边 `--app-manager`），三列面板不重复按钮；看板区容器挂 `aria-live="assertive"` | 点击「重试」→ 三列列身回到 5.8 定义的骨架卡阵（列头静态直出，卡片区按 3/3/2 铺）→ 成功出卡、失败回错误面板；列头计数显示「--」（mono / `--text-faint`）直至数据到达 |
| 迭代切换失败（点击 IT-013 / IT-012 后该迭代看板接口 rejected） | 同上（仅看板区 + KPI 行进入错误态） | 同上结构；**迭代条保持用户所点项的激活态**（`.pg-iter-item[data-active="true"]` 钢蓝描边不变，错误不回滚选择）；KPI 行 4 卡同步降级——数值位换「--」（mono / `--text-faint`），卡片几何与 4px 钢蓝顶边保持；面板标题换「IT-013 数据拉取失败」+ 错误码 `ERR-ITER-500` | 同上；「重试」按当前所选迭代重新拉取；或直接切换其他迭代项（切换即隐式重试，不弹确认） |

- **自动重试**：首屏失败自动静默重试 1 次；迭代切换失败不自动重试（用户切走即放弃）。
- **优先级**：错误 > 空 > 加载完成。rejected 时三列一律出错误面板，禁止混排「错误列 + 空列 + 旧数据列」。

#### 行内/轻量错误（toast 与字段）

- 本页为纯读数看板（需求卡 hover-only、无写操作表单），不使用 toast 与字段级错误；一切拉取失败以「列身错误面板 + 右上重试」的区域级方式呈现。
- KPI 降级（数值「--」）属错误态的一部分，不单独立 toast——四卡同源同降，避免错误提示碎片化。

#### 降级与重试策略

- **网络级 vs 服务端**：网络级用 `wifi-off` + 错误码 `ERR-NET-408`；服务端用 `cloud-off` + `ERR-BOARD-503`/`ERR-ITER-500`。两档面板几何一致，仅图标与错误码区分。
- **重试回骨架**：「重试」或切换迭代均先回 5.8 骨架卡阵（列头常驻、卡身铺灰），禁止错误面板直接翻转到内容。
- **互斥关系**：骨架/卡片/空列虚线框/错误面板四态互斥；错误期间迭代条、hero 读数行保持直出（hero 为静态文案，KPI 数值位降级为「--」）。

#### 文案规范

- 首屏失败：面板「看板数据拉取失败」+ mono「`ERR-BOARD-503`」+ 按钮「重试」
- 迭代失败：面板「IT-013 数据拉取失败」+ mono「`ERR-ITER-500`」+ 按钮「重试」
- 降级读数：KPI 数值「--」+ 列头计数「--」（mono / `--text-faint`）

---

## 6. 工坊前台 · 组件画廊（designer-front.html）

### 6.1 页面定位

组件工坊对外的「画廊委托」页，面向设计师用自然语言下委托单生成组件、浏览组件馆藏。accent 为墨黑 `var(--app-designer)`（`#1c2530`，header 内联 `--app-accent: var(--app-designer)`，页面根 `.pg-root` 另定义 `--pg-accent: var(--app-designer)` 供私有样式引用）。报头 `DESIGNER · 组件工坊 / 定制生成`，导航「定制生成」激活。

### 6.2 页面结构

1. **报头**：品牌区 → 导航（designer-generate / designer-library）→ 动作区（返回总览 + 后台管理）
2. **主区（us-main / pg-root）**
   - 画廊 hero + 委托单（pg-hero-grid，7/5 非对称双栏）：
     - 左：mono 眉题「COMMISSION」+ 大标题「下一件展品，由你描述」+ 两段描述
     - 右（pg-commission-rail）：委托单表单卡（表头「委托单 / NO. 0128」→ 组件描述 textarea → 目标平台选择按钮 → 「生　成」提交按钮）+ 生成状态条（`GEN #128 · 排版中` + 进度条 62% + 「生成中」标签）
   - 组件馆藏（pg-exhibits，`id="exhibits"`）：3 列展品网格 6 卡（按钮/标签/输入框/表格 已发布，对话框/开关 草稿），每卡 = 预览区（图标 + 名称）+ 元数据行（slug + 版本 + 状态标签）
   - 展位说明（pg-booth）：三步流程「描述 · 生成 · 入库」
3. **页脚**：注记「描述需求，机器为你排版组件」+ 管理后台 + 版权

### 6.3 交互元素清单

| # | 元素 | DOM 标识/选择器 | 类型 | 触发行为 | 去向/反馈 |
|---|------|----------------|------|----------|-----------|
| 1 | 导航 · 定制生成 | `a[data-nav-key="designer-generate"]`（`data-active="true"`） | 链接 | 点击跳转 | `./designer-front.html`（当前页） |
| 2 | 导航 · 组件馆藏 | `a[data-nav-key="designer-library"]`（`data-active="false"`） | 链接 | 点击页内锚点 | `#exhibits`（滚动至馆藏区，六页中唯一的页内锚点导航） |
| 3 | 返回总览 | `a[data-dom-id="back-platform"]` | 链接 | 点击跳转 | `./index.html` |
| 4 | 后台管理 | `a[data-dom-id="link-admin"]` | 链接按钮 | 点击跳转 | `./designer-admin.html`，琥珀描边 + `wrench` |
| 5 | 组件描述输入 | `textarea#pg-desc`（`rows="4"`，label `for="pg-desc"`「组件描述」，placeholder 示例文案） | 多行输入 | 输入描述 | 聚焦墨黑描边 + 3px 墨蓝浅环；`resize: vertical` 可纵向拉伸 |
| 6 | 目标平台选择 | `button#pg-platform.pg-select`（`aria-labelledby="pg-platform-label"`、`aria-haspopup="listbox"`、`aria-expanded="false"`） | 下拉触发按钮 | 点击展开选项（设计稿态，未含面板实现） | 当前值「@mt/ui · React 18」+ `chevron-down` 图标；hover 边框加深 |
| 7 | 生成（提交） | `button.pg-submit`（`type="submit"`，表单 `form.pg-form[action="#"][method="post"]`） | 实心主按钮 | 提交委托单 | 文案「生　成」（全角空格间隔，注意 E2E 正则写 `/生\s*成/`）；墨黑实心 44px 高；hover 深墨，按压下沉 1px |
| 8 | 生成状态条 | `.pg-status`（`role="status" aria-label="生成状态"`）内含 `.pg-progress[role="progressbar"][aria-valuenow="62"][aria-valuemin="0"][aria-valuemax="100"]` | 进度状态 | 无操作 | 进度条 62% 墨黑填充，1.6s 透明度脉冲动画；右侧「生成中」info 标签 |
| 9 | 展品卡 ×6 | `article.pg-exhibit`（按钮 button v2.4.1 / 标签 tag v1.8.0 / 输入框 input v2.1.3 / 表格 table v3.0.0 已发布；对话框 dialog v1.2.0 / 开关 switch v0.9.4 草稿） | 展示卡 | 仅 hover 反馈 | hover 边框变 `--mt-ink-300` + `translateY(-2px)`，预览图标变墨黑 accent |
| 10 | 页脚 · 管理后台 | `a.us-footer-admin` | 链接 | 点击跳转 | `./designer-admin.html` |

注：展品状态标签（`.pg-tag-success` 已发布 / `.pg-tag-neutral` 草稿 / `.pg-tag-info` 生成中）与展位说明三步均为静态展示。

### 6.4 状态与反馈

- **悬停**：`.pg-select:hover` → 边框 `--mt-ink-400`；`.pg-exhibit:hover` → 边框 `--mt-ink-300` + `translateY(-2px)`（`--duration-base` 200ms），预览区图标由石墨灰变 `--pg-accent`
- **主按钮**：`.pg-submit` 背景 `--pg-accent`；`:hover` → `--app-designer-ink`；`:active` → `transform: translateY(1px)`（下沉按压感）
- **聚焦**：`.pg-textarea:focus` → `outline: none` + 边框 `--pg-accent` + `box-shadow: 0 0 0 3px var(--mt-ink-100)`；`.pg-select:focus-visible` / `.pg-submit:focus-visible` → `outline: 2px solid var(--mt-ink-500)`
- **进行中**：`.pg-progress-fill` 动画 `pg-progress-pulse`（opacity 1↔0.45，1.6s 无限循环）
- **动效令牌**：表单控件 `--duration-fast`，展品卡 `--duration-base`，均 `--ease-standard`

### 6.5 页面互跳

出向：

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
|---|---|---|---|
| 返回总览 | `a[data-dom-id="back-platform"]`（`.us-back-link`） | `./index.html` | `<a href>` |
| 后台管理（报头按钮） | `a[data-dom-id="link-admin"]`（`.us-admin-btn`） | `./designer-admin.html` | `<a href>` |
| 页脚 · 管理后台 | `a.us-footer-admin` | `./designer-admin.html` | `<a href>` |
| 导航 · 组件馆藏 | `a[data-nav-key="designer-library"]` | `#exhibits`（页内锚点，滚动至馆藏区） | `<a href>`（页内锚点） |
| 委托单表单 action | `form.pg-form` | `#`（占位，表单无实装提交端点） | `<form action>` 占位 |

入向：来自网关导航「工坊」与目录墙链接卡 `card-designer`。

### 6.6 可访问性与降级

- aria：textarea 有显式 label 关联（`for="pg-desc"`）；平台按钮带 `aria-labelledby` / `aria-haspopup="listbox"` / `aria-expanded="false"`（listbox 面板在设计稿中未实现，落地时需同步维护 expanded 值）；状态条 `role="status"`、进度条 `role="progressbar"` 且 valuenow/min/max 完整
- focus-visible：墨蓝 2px 环（select/submit）；textarea 用自定义聚焦环替代 outline
- `prefers-reduced-motion: reduce`：`.pg-progress-fill` 脉冲动画禁用；`.pg-exhibit / .pg-exhibit-preview svg / .pg-select / .pg-submit / .pg-textarea` 过渡禁用；`.pg-exhibit:hover { transform: none }` 取消浮起

### 6.7 响应式行为

- **≤920px**：hero 双栏（7/5）降单列；展品网格降 2 列；展位三步降单列（步骤间改上边线分隔，去左边线）
- **≤640px**：展品网格降 1 列；生成状态条允许换行（`flex-wrap: wrap`）；区块间距 `--space-7`→`--space-6`
- **≤920px / ≤640px**（UserShell 层）：报头换行导航置底 / 品牌限宽、页脚纵向堆叠

### 6.8 空态与加载态

空态作用于展品网格（`.pg-grid`）；加载态覆盖展品网格骨架与委托表单（`.pg-form`）的提交中状态。画廊 hero 文案、展位说明（`.pg-booth`）为常驻静态结构，不设空态。

#### 空态（Empty State）

| 触发条件 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 展品馆藏为空（`@mt/ui` 馆藏同步完成且为 0） | 展品网格 `.pg-grid` 整体替换（保留「组件馆藏」小节头） | 图标 `shapes`（data-lucide，与网关目录墙组件工坊卡同图标）32px / `--text-faint`；空态标题「馆藏还在布展」：`--font-display` / 15px / 600 / `--text-body`；描述「第一件展品将由你的委托单生成——在上方描述组件，生成后经评审入库」：`--font-body` / 13px / `--text-muted`；动作「回到委托单」accent 下划线链接（`--app-designer` / 13px / 600 / `text-underline-offset: 4px`，hover `--app-designer-ink`）；区域留白上下 `--space-7`，居中排布；空态外框用 `--mt-hairline-strong` 1px 虚线 + `--radius-lg`（与展品卡 `.pg-exhibit` 同族几何）或纯留白，禁止位图插画 | 点击平滑滚动回顶部委托表单（光标落 `#pg-desc`）；展品入库后网格自动出现 |
| 生成中无展品（首件展品尚在 `GEN #` 队列、馆藏为空） | 同上 | 同上结构，文案换为：标题「第一件展品正在排版」+ 描述「生成完成后会自动出现在这里，可稍后刷新查看」；动作改「查看生成状态」锚点链接（滚动至 `.pg-status`） | 生成完成后展品卡入列；或点击链接查看进度条 |

注：小节头 mono 注记 `.pg-section-note` 同步为「已发布 0 · 草稿 0」（`--text-faint`），与空态互为印证。

#### 加载态（Loading State）

- **展品网格骨架**：馆藏同步期间铺 6 张展品卡骨架，与真实 `.pg-exhibit` 同构（3 列 grid）——预览区块高 132px（`--surface-2` 底，含居中 30×30px 图标占位块与 64×16px 名称块）、元数据行块（slug 72×14px + 版本 40×14px + 状态标签 52×22px），卡壳 `--surface-1` 底 + `--mt-hairline-strong` 边框 + `--radius-lg`（边框保留、内容铺灰）
- **委托表单提交中**：点击「生　成」后进入提交中态——按钮文案保持「生　成」不变、背景由 `--pg-accent` 过渡为 `--mt-graphite-400`（禁用语义色）、`cursor: progress`、禁点；生成状态条 `.pg-status` 同步点亮：mono 编号「GEN #128 · 排版中」+ 进度条（3px 高、`--pg-accent` 填充、`pg-progress-pulse` 1.6s 透明度脉冲）+ info 标签「生成中」；进度数值以 mono 直显于编号行（如「62 / 100」），不闪烁
- **提交完成**：状态条转 success——标签换 `.pg-tag-success`「已入库」、脉冲停止、进度条满格停留 320ms（`--duration-slow`）后整条淡出（`--ease-standard`）；展品网格首列插入新卡（入场 `translateY(-2px)` → 0，`--duration-base`）
- **首屏 vs 局部**：hero 与委托表单首屏静态直出（无骨架）；展品网格为异步馆藏数据、首屏整体骨架（首屏可见，立即加载）；展位说明在网格之后、滚动到位静态呈现
- **动效**：骨架 shimmer 扫光 `linear-gradient(90deg, transparent, var(--surface-1) 50%, transparent)`，`--duration-slow`（320ms）+ `--ease-standard` 循环；禁止旋转 spinner（工房感不用转圈）
- **降级**：`prefers-reduced-motion: reduce` 时 shimmer 停止退为静态 `--surface-2` 块；进度脉冲停用（与既有 6.6 规则一致）；状态条淡出改为瞬时切换

#### 文案规范

- 馆藏空：标题「馆藏还在布展」+ 描述「第一件展品将由你的委托单生成——在上方描述组件，生成后经评审入库」+ 链接「回到委托单」
- 生成中空：标题「第一件展品正在排版」+ 描述「生成完成后会自动出现在这里，可稍后刷新查看」+ 链接「查看生成状态」
- 提交中：状态条「GEN #128 · 排版中」+ 标签「生成中」；完成「GEN #128 · 已入库」+ 标签「已入库」

### 6.9 错误态（Error State）

错误态作用于委托表单（`.pg-form`）的行内校验错误与提交失败；展品网格（`.pg-grid`）的馆藏拉取失败复用第 9 章区域级面板规格。与 6.8 的关系：提交 pending 走 6.8 提交中态（按钮禁用 + 进度条），提交 rejected 进入本节 toast + 状态条错误呈现；校验错误发生在提交前（客户端拦截，不出网络层）。

#### 区域级错误（可重试）

| 错误场景 | 承载区域 | 视觉构成 | 恢复动作 |
|---|---|---|---|
| 展品馆藏拉取失败（`@mt/ui` 馆藏同步 rejected / 非 2xx） | 展品网格 `.pg-grid` 整体替换（保留「组件馆藏」小节头） | 图标 `cloud-off`（data-lucide）18px / `--state-error-text`；错误面板：`--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-lg`（与展品卡 `.pg-exhibit` 同族几何），跨满 3 列网格宽，留白上下 `--space-7`、居中；标题「馆藏目录没能加载」：`--font-body` / 14px / 600 / `--text-strong`；描述「同步 @mt/ui 馆藏失败（`ERR-LIB-502`），生成不受影响」：12.5px / `--text-muted`，错误码 mono；重试按钮复用本页次级语言（`--surface-1` 底 + `--mt-hairline-strong` 描边 + `--radius-md`，hover 墨黑描边 `--app-designer`），`refresh-cw` 图标 14px + 文案「重试」；小节头 mono 注记 `.pg-section-note` 同步「已发布 -- · 草稿 --」（`--text-faint`） | 点击「重试」→ 网格回到 6.8 定义的 6 张展品卡骨架（3 列同构）→ 成功出卡、失败回错误面板；委托表单不受影响（错误不阻塞提交通路） |

- **自动重试**：馆藏同步失败自动重试 1 次；面板出现后手动入口唯一。
- **优先级**：错误 > 空 > 加载完成——同步 rejected 时不出 6.8 的「馆藏还在布展」空态。

#### 行内/轻量错误（toast 与字段）

- **委托表单校验错误（字段级）**：
  - **组件描述为空或过短**（`#pg-desc` 提交时为空 / 少于 10 字）：textarea 换 1px `--state-error` 描边（覆盖聚焦态的墨黑描边与 3px 浅环，重新聚焦时描边保持 error 直至校验通过）+ `aria-invalid="true"`；字段下方错误文案「描述太简短，至少 10 字——说说形态、交互或边界」：`--font-body` / 12px / `--state-error-text`，位于 `.pg-label` 与控件之间的既有留白下方 `--space-1`（4px）；校验通过即刻撤描边与文案（不待提交）。
  - **目标平台未就绪**（`#pg-platform` 选项源 rejected）：按钮描边换 `--state-error` + `aria-invalid="true"`，按钮值文案换「平台清单加载失败」；下方 12px 错误文案「目标平台没能获取（`ERR-PLAT-503`），请重试或稍后再选」；此为降级而非用户错误，提交按钮同步禁用。
- **提交失败 toast**：`form.pg-form` 提交 rejected（`ERR-GEN-500` 等）时——toast：`--surface-1` 底 + 左侧 3px `--state-error` 竖条 + `--radius-md` + `--shadow-2`，文案「委托单提交失败 · `ERR-GEN-500`，描述已保留，可直接重试」（`--font-body` / 13px / `--text-body`，错误码 mono），右上角 mono 时间戳（`--font-mono` / 11px / `--text-faint`，如 `14:52:36`）；停留 3s 自动消失；**同时生成状态条 `.pg-status` 转错误呈现**——进度条填充换 `--state-error`、脉冲停止、mono 编号行换「GEN #128 · 提交失败 · `ERR-GEN-500`」、标签换 error 底「提交失败」（`--state-error-bg` 底 + `--state-error-text` 文字）；「生　成」按钮恢复可用（回 `--pg-accent` 墨黑实心），textarea 内容保留不清空。
- **表单锚定**：多字段校验失败时，提交点击后焦点跳转第一个 `aria-invalid="true"` 的控件（textarea 优先），错误文案随焦点区可见。

#### 降级与重试策略

- **网络级 vs 服务端**：提交失败 toast 按错误码区分文案——网络级「网络中断，委托单未能送出（`ERR-NET-408`）」；服务端「委托单提交失败 · `ERR-GEN-500`」。字段校验错误为客户端判定，无错误码、无网络语义。
- **自动重试**：提交失败不自动重试（生成有成本，等用户确认）；textarea 内容保留即零成本手动重试。馆藏同步失败自动 1 次。
- **互斥关系**：校验错误（提交前）与提交失败（提交后 rejected）不同时出现——校验失败拦截提交、不发请求；错误态期间 6.8 提交中态让位；空态与错误态在 `.pg-grid` 内互斥。

#### 文案规范

- 校验：字段「描述太简短，至少 10 字——说说形态、交互或边界」（12px / `--state-error-text`）
- 提交失败：toast「委托单提交失败 · `ERR-GEN-500`，描述已保留，可直接重试」+ 状态条「GEN #128 · 提交失败 · `ERR-GEN-500`」+ 标签「提交失败」
- 馆藏失败：面板「馆藏目录没能加载」+「同步 @mt/ui 馆藏失败（`ERR-LIB-502`），生成不受影响」+ 按钮「重试」

---

## 7. 前台共性交互契约（UserShell）

以下行为在 6 页共享的 `us-shell-style` 中统一定义，逐页核实一致：

### 7.1 报头导航（us-nav）

- 结构：品牌区（mono 眉题 + 衬线应用名）→ 居中主导航（`aria-label="主导航"`）→ 右侧动作区；内容最大宽 1080px，报头高 72px，底部 1px 发丝线（不用投影）
- **几何不变激活**：所有导航链接常驻 `border-bottom: 2px solid transparent` 占位；`a[data-active="true"]` 仅将文字色与下边线色切换为 `--app-accent`（各页经 header 内联 style 注入：网关 `--mt-ink-600`、求职 `--app-applicant`、书库 `--app-scholar`、助手 `--app-assistant`、交付 `--app-manager`、工坊 `--app-designer`），激活前后高度零位移
- hover：`.us-nav a:hover` → 文字变 `--mt-ink-700`（不换 accent 色）
- 过渡：color / border-color，`--duration-fast`（120ms）+ `--ease-standard`
- 溢出：`.us-nav` 自身 `overflow-x: auto; scrollbar-width: thin`

### 7.2 返回总览链接（us-back-link）

- 六页全部存在，统一 `data-dom-id="back-platform"`，`href="./index.html"`，图标 `data-lucide="arrow-left"`（14px）+ 文案「返回总览」
- hover 文字变 `--mt-ink-700`；focus-visible `outline: 2px solid var(--mt-ink-500)`

### 7.3 后台管理按钮（us-admin-btn）

- **5 个业务前台**均存在于报头动作区，统一 `data-dom-id="link-admin"`，`href` 指向各自后台页（applicant→`./applicant-admin.html` / scholar→`./scholar-admin.html` / assistant→`./assistant-admin.html` / manager→`./manager-admin.html` / designer→`./designer-admin.html`），`wrench` 图标 + 文案「后台管理」
- **网关页（index.html）报头无此按钮**，仅保留返回总览；管理后台入口退居页脚
- 视觉契约：36px 高、`--surface-1` 底、1px 琥珀描边（`--mt-amber-500`）+ `--mt-amber-600` 文字；hover 描边加深为 `--mt-amber-600` 且底变 `--surface-0`；active 底变 `--surface-2`；focus-visible 琥珀 2px 环（`--mt-amber-600`，区别于其余控件的墨蓝环）

### 7.4 页脚（us-footer）

- 三段式：mono 注记（各页文案不同）→ 管理后台链接（`.us-footer-admin`，5 个业务前台指向各自后台页（同 7.3），网关页为 `href="#"` 占位（网关页无单一后台归属），`arrow-right` 图标 13px，hover 变 `--mt-ink-700`）→ 版权行「© 2026 MagicTools · 墨蓝石墨工房」（六页统一）
- 顶部 1px 发丝线；最大宽 1080px

### 7.5 导航分组差异（实测口径）

| 页面 | 导航项数 | 激活标记方式 | 非激活项标记 |
|------|----------|--------------|--------------|
| index / manager | 6（全局组：首页/求职/书库/助手/交付/工坊） | `data-active="true"` | index 全部显式 `data-active="false"`；manager 省略该属性 |
| applicant | 3（wall/resume/review，应用私有组） | `data-active="true"` | 显式 `data-active="false"` |
| scholar | 3（catalog/graph/inbox） | `data-active="true"` | 显式 `data-active="false"` |
| assistant | 2（chat/feedback） | `data-active="true"` | 显式 `data-active="false"` |
| designer | 2（designer-generate/designer-library） | `data-active="true"` | 显式 `data-active="false"`；馆藏项为页内锚点 `#exhibits` |

### 7.6 焦点、动效与降级（六页统一）

- focus-visible：导航链接 / 返回总览 / 页脚管理后台 → `outline: 2px solid var(--mt-ink-500); outline-offset: 2px`；后台管理按钮 → `outline: 2px solid var(--mt-amber-600)`
- 动效令牌：`--duration-fast: 120ms` / `--duration-base: 200ms` / `--duration-slow: 320ms`；`--ease-standard: cubic-bezier(0.4,0,0.2,1)`
- `prefers-reduced-motion: reduce`：UserShell 四类链接/按钮过渡全部禁用；各页私有规则另禁用卡片浮起（applicant / designer 取消 `translateY(-2px)`）、打字动画（assistant 降级静态三点）、进度脉冲（designer）
- 布局断点：≤920px 报头换行、导航整行置底（order:3）主区 padding 收窄；≤640px 品牌区限宽 58%、admin 按钮收窄、页脚纵向堆叠

### 7.7 图标体系

全部图标走 `data-lucide` + 页尾 `lucide.createIcons()` 渲染，装饰性图标一律 `aria-hidden="true"`。实测出现的图标：`arrow-left`（返回总览）、`wrench`（后台管理）、`arrow-right`（页脚管理后台 / 查看图谱）、`arrow-up-right`（查看详情 / 进入工坊）、`briefcase` `book-open` `bot` `layout-dashboard` `shapes` `globe` `search` `clipboard-check`（网关八卡）、`move-right`（事件流向）、`terminal`（服务状态）、`pen-tool`（简历工坊）、`plus`（新对话）、`message-square` / `send`（输入区）、`chevron-down`（平台选择）、`network`（知识图谱）、`rectangle-horizontal` `tag` `text-cursor-input` `table` `panel-top` `toggle-left`（六件展品）。

---

## 8. 空态与加载态共性规范

汇总 1.8–6.8 六节的共性口径，适用于全部 6 个前台页面的新增实现；各页私有差异以各节为准。

### 8.1 空态三层构成

空态统一由三层构成，按信息密度递减可裁剪后两层：

| 层 | 规格 | 必选/可选 |
|---|---|---|
| 图标 | `data-lucide` 线性图标，24–32px，默认 `--text-faint`；有明确 accent 语义时用应用 accent（如书库 `--app-scholar`、助手 `--app-assistant`）；`aria-hidden="true"`，禁止位图插画与照片 | 可选（结构容器类空态可免，如泳道空列） |
| 标题 | `--font-display` / 15px / 600 / `--text-body`，一行内说完结论 | 必选 |
| 动作 | 二选一：次级按钮（`--surface-1` 底 + `--mt-hairline-strong` 描边 + `--radius-md`，hover 变应用 accent 描边）或 accent 下划线链接（13px / 600 / `text-underline-offset: 4–5px`，hover 变 `-ink` 深色） | 可选（无恢复路径时不放，不放死链接） |

- 描述文案（标题下一行）：`--font-body` / 13px / `--text-muted`，最多两行；区分「用户操作所致」（给恢复动作）与「平台数据所致」（给时间预期）两种成因，文案互不通用
- 区域留白：上下 `--space-6`～`--space-7`；窄列容器（如会话侧栏）左对齐，宽容器（网格 / 看板）居中
- 空态外框：`--mt-hairline` / `--mt-hairline-strong` 1px 虚线 + 与真实内容同族圆角（`--radius-md` / `--radius-lg`），或纯留白二选一；禁止实线框、禁止投影

### 8.2 骨架块统一令牌

- 底色：`--surface-2`；圆角：`--radius-sm`（行内文字块）/ 与真实容器同族圆角（卡壳）
- shimmer 扫光：`linear-gradient(90deg, transparent, var(--surface-1) 50%, transparent)`，时长 `--duration-slow`（320ms），缓动 `--ease-standard`，无限循环
- 禁止旋转 spinner：工房感不用转圈，一切加载指示以骨架块、三点气泡（assistant 既有 `pg-typing-bounce`）、进度条（designer 既有 `pg-progress-pulse`）呈现
- 骨架块行高与真实内容行高一致（文字行块取「真实字号 × 1.4」向上取整的块高），关键容器高度锚定真实高度：岗位卡约 160px、目录行 72px、需求卡约 88px、展品预览区 132px、会话项骨架含双行块

### 8.3 加载中文案规范

- 进度可计数时用 mono 字体直显进度：`--font-mono` / 12px / `--text-muted`，格式「载入中 · 12/48」（中文动词 + 间隔号 + `已载/总数`，tabular-nums）；总数未知时显示「载入中 · 12」
- 进度文案置于加载区右上或骨架区外缘，不遮挡骨架块；加载完成即随骨架一并移除
- 不可计数的生成类等待（AI 回复、组件生成）不用百分比进度文案，改用状态短语 + 既有动效（「助手正在输入」三点气泡、「排版中」进度条）

### 8.4 空态与加载态互斥规则

- **加载完成后才判空**：任何区域在数据请求 pending 期间一律显示骨架（加载态），禁止在 pending 时先渲染空态再翻转——空态判定只发生在请求 fulfilled 且结果为空时
- 状态机顺序固定：`骨架（pending）→ 内容（fulfilled 且非空）｜ 空态（fulfilled 且空）`；请求失败按 error 降级处理（如网关状态条 error 徽标），不得以空态兜底错误
- 空态出现后新数据到达（筛选重置、新会话建档、展品入库），空态立即让位内容，无额外过渡；禁止空态与骨架同屏共存

### 8.5 骨架屏与最终布局尺寸一致原则

- 骨架占位必须与最终内容**同构**：同网格列数与列宽模板、同 gap、同容器 padding、同圆角族；禁止用通用 N 行灰条顶替结构化骨架
- 骨架数量与真实条数一致（首批数据条数已知时按实际数铺；未知时按该区域典型条数铺，如目录 6 行、会话 4 条、展品 6 卡）
- 骨架 → 内容切换时容器总高不跳变（行高/卡高按 8.2 锚定值铺），避免 CLS；局部重载（筛选、切换迭代、切换会话）只重铺目标区域，常驻结构（hero、筛选行、输入区、迭代条）保持静态直出
- 首屏整体骨架仅覆盖异步数据区（网格 / 列表 / 看板 / 状态条读数位）；静态内容区（hero、说明性横幅、展位说明）不铺骨架、不延迟加载

---

## 9. 错误态共性规范

汇总 1.9–6.9 六节的共性口径，适用于全部 6 个前台页面的新增实现；各页私有差异以各节为准。与第 8 章的关系：第 8 章定义 `pending → fulfilled（内容｜空态）`，本章补全第三分支 `rejected → 错误态`，三态共同构成完整状态机。

### 9.1 错误三级体系

按「影响面 × 承载容器」分为三级，逐级收窄，禁止跨级套用：

| 级别 | 承载容器 | 适用场景 | 视觉基调 |
|---|---|---|---|
| 区域级面板/错误条 | 替换或嵌入异步数据区（`.pg-wall` / `.pg-catalog-list` / `.pg-swimlane-cards` / `.pg-grid` / `.pg-stream` / 检索栏下错误条 / 网关状态条徽标） | 列表、看板、检索、会话消息等整区拉取失败 | `--state-error-bg` 底 + 1px `--state-error` 描边 + `--radius-md`（或与真实内容同族 `--radius-lg`），含图标 + 标题 + 描述 + 重试动作 |
| 行内 toast | 页面级轻量浮层（不做整区替换） | 收藏、投递、委托提交等单点写操作失败 | `--surface-1` 底 + 左侧 3px `--state-error` 竖条 + `--radius-md` + `--shadow-2`，停留 3s 自动消失 |
| 字段级 | 表单控件本体 + 紧邻下方文案位 | 表单校验失败（designer 委托单为当前唯一表单） | 控件 1px `--state-error` 描边 + `aria-invalid="true"` + 下方 12px 错误文案 |

- 选择规则：整区数据不可用 → 区域级；用户可立即改写的单点动作 → toast；提交前可就地修正 → 字段级。同一错误只出一级，禁止 toast 叠加区域面板重复播报。
- 对话类错误（assistant）为特殊第四形态——错误留在气泡内原位翻转（见 4.9），不适用区域面板整屏拦截。

### 9.2 错误令牌三件套

错误语义色统一由三枚令牌构成，禁止另起色值：

| 令牌 | 用途 | 典型位置 |
|---|---|---|
| `--state-error` | 描边、竖条、进度条填充、图标强调色（线/面同源） | 面板 1px 描边、toast 左侧 3px 竖条、气泡描边、状态条进度填充 |
| `--state-error-bg` | 错误容器底色 | 面板/错误条/错误徽标/错误气泡底 |
| `--state-error-text` | 错误文案与图标色 | 标题（或用 `--text-strong`）、描述中错误码、12px 字段错误文案、mono 错误码 |

- 面板文字分层：标题用 `--font-body` / 14px / 600 / `--text-strong`（或 `--state-error-text`）、描述用 12.5px / `--text-muted`；错误语义集中在底色 + 描边 + 错误码，正文不整段染红。
- 图标规格：`data-lucide` 线性图标 18px / `--state-error-text`；语义映射——网络级 `wifi-off`、服务端 `cloud-off`、通用告警 `alert-triangle`；重试入口配 `refresh-cw`（次级按钮）或 `rotate-ccw`（链接式）；一律 `aria-hidden="true"`，禁止位图插画。

### 9.3 错误优先级：错误 > 空 > 加载完成

- 状态机完整口径：`骨架（pending）→ 内容（fulfilled 且非空）｜ 空态（fulfilled 且空）｜ 错误态（rejected）`；rejected 分支优先判定，禁止以空态（「岗位 0」「命中 0 卷」「暂无需求」）兜底接口失败——空态承诺的是业务事实，错误态承诺的是技术故障，两者混用即误导。
- 错误期间同源读数一律降级为「--」（mono / `--text-faint`）：KPI 数值、列头计数、筛选计数、索引元数据；不得保留上一轮旧值。
- 错误不回滚用户操作状态：已选筛选胶囊（2.9）、已选迭代项（5.9）、已输入检索词（3.9）、textarea 内容（6.9）在错误态与重试全程保留。

### 9.4 重试回骨架规则

- 一切手动重试（区域级「重试/重新检索/重新加载」按钮或链接）点击后，目标区域**先回到第 8 章定义的同构骨架**，再等待结果；禁止错误面板直接翻转为内容（用户需感知到重新加载发生）。
- 骨架规格沿用 8.2/8.5：同网格、同 gap、同圆角、同高度锚定（岗位卡约 160px、目录行 72px、需求卡约 88px、展品预览区 132px、状态条行内块）；列头、小节头等常驻结构不参与重铺。
- 重试期间重试入口禁用（防连点）；失败后回到错误面板并刷新错误码与 mono 时间戳，不叠历史错误。
- 自动重试统一上限：同区域静默自动重试至多 1 次（网络级）；生成类/写操作类（AI 回答、委托提交、收藏投递）不自动重试；探活类（网关状态、模型路由、图谱入口）走静默轮询，轮询过程不对用户暴露。

### 9.5 错误码 mono 展示规范

- 错误码格式：`ERR-<域>-<码>`，如 `ERR-GW-504`、`ERR-JOB-503`、`ERR-SCHOLAR-500`、`ERR-NET-408`、`ERR-LLM-429`、`ERR-BOARD-503`、`ERR-GEN-500`；网络级统一域 `NET`。
- 展示：一律 `--font-mono` / 12px（toast/字段级可随正文 12–13px），色 `--state-error-text`，内嵌于中文描述括号内或独立 mono 行，格式「（`ERR-XXX-NNN`）」。
- **禁止纯英文报错**：用户可见文案全部中文（标题、描述、动作词均为中文），错误码只作为 mono 追溯线索；禁止把 `Internal Server Error`、`Failed to fetch` 等原始英文 message 直出给用户（可写入错误码映射表，由 `ERR-*` 码引用）。
- toast 时间戳：`--font-mono` / 11px / `--text-faint`，`HH:MM:SS` 制，供工单追溯。

### 9.6 可访问性：错误播报

- **区域级错误容器挂 `aria-live="assertive"`**（错误面板、检索错误条、模型路由错误条、看板错误区）——错误属高优先级变更，读屏需立即播报；toast 用 `role="status"`（`aria-live="polite"`）即可，不抢占。
- 字段级：控件 `aria-invalid="true"` + 错误文案以 `aria-describedby` 关联到控件（如 `#pg-desc` ↔ 描述错误文案节点）；错误出现即聚焦第一个无效控件（表单锚定）。
- 对话气泡错误：气泡容器 `role="alert"` 或沿用消息流 `aria-label` 语义补充「回答生成失败」播报；错误图标 `aria-hidden="true"`，语义由文字承载。
- `prefers-reduced-motion: reduce`：错误面板出入场不做位移动画，toast 淡入淡出（opacity）保留或瞬时切换；骨架回退规则沿用 8 章降级口径。

---

## 附录 A · 重试演示页（assistant-retry-demo.html）互跳

> 本页为《深度补充 · AI 回复失败气泡重试功能》的可交互演示页（Retry Lab），复用 UserShell 亮色壳与 `pg-*` 气泡体系，私有前缀 `rd-*`。此前分册未覆盖，此处补记其互跳事实（以下 href 均按 HTML 实测）。

出向：

| 入口元素 | DOM 标识 | 目标页面 | 实现方式 |
|---|---|---|---|
| 导航 · 首页 | `a[data-nav-key="home"]`（无 data-active） | `./index.html` | `<a href>` |
| 导航 · 助手（当前页，active） | `a[data-nav-key="assistant"][data-active="true"]` | `./assistant-front.html` | `<a href>` |
| 报头 · 查看规格 | `a.us-back-link`（注意：本页该链接文案为「查看规格」，**未挂 `data-dom-id="back-platform"`，不去网关**） | `#spec`（页内锚点，滚动至底部规格说明区 `section#spec`） | `<a href>`（页内锚点） |
| 控制台 · 完整规格文档 | `a.rd-console-link`（导演台右栏） | `#spec`（页内锚点） | `<a href>`（页内锚点） |
| 规格说明区 · 深度规格文档互链 | `.rd-spec-src a[href="../docs/deep-dive-assistant-retry.md"]` | `../docs/deep-dive-assistant-retry.md` | `<a href>` |
| 规格说明区 · 气泡基线页面 | `.rd-spec-src a[href="./assistant-front.html"]` | `./assistant-front.html` | `<a href>` |
| 页脚 · 返回助手前台 | `a.us-footer-admin`（本页文案为「返回助手前台」，非「管理后台」） | `./assistant-front.html` | `<a href>` |
| 系统提示条 · 可查看服务状态 | `.pg-sysbar a[href="./index.html"]`（S3 三次耗尽后由 `appendServiceWarning()` 注入，条件 `m.retryCount >= 3`） | `./index.html` | JS 注入 `<a href>`（`innerHTML` 拼接，注入后补跑 `lucide.createIcons()`） |
| 气泡引用来源 | `a.pg-cite`（预置消息与 JS 模板各 1 处） | `#`（占位） | `<a href>` 占位 |

入向：无实页链接指向本文件（网关与其余前台均不含指向 `./assistant-retry-demo.html` 的链接），属独立演示入口，仅经本地文件直接打开进入。

深度规格文档互链关系：本附录（前台分册）§4.9 错误态口径 ↔ `docs/deep-dive-assistant-retry.md`（状态机 / 错误码矩阵 / DOM 模板 / 验收清单完整版）；演示页内 `.rd-spec-src` 一段即该互链的落地文案。
