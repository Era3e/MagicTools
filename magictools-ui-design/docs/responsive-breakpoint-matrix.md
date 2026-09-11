# MagicTools 响应式断点行为表（测试用）

> 适用范围：`pages/` 下全部 17 页（6 前台 + 8 后台 + 3 演示）
> 数据来源：逐页 CSS `@media` 块提取（选择器 + 行号级核实），部分高风险点经 Chrome DevTools 实测复核
> 用途：前端改造时的回归测试基线。每条行为均「可测试」——DevTools 切换设备宽度或拖拽窗口至指定像素，按行为描述逐条勾验
> 配套令牌：动效降级统一走 `prefers-reduced-motion`，见各页 `@media (prefers-reduced-motion: reduce)` 块

---

## 目录

1. [断点刻度全景](#一断点刻度全景)
2. [前台页行为表（6 页）](#二前台页行为表)
3. [后台页行为表（8 页）](#三后台页行为表)
4. [演示页行为表（3 页）](#四演示页行为表)
5. [跨页风险清单（测试重点）](#五跨页风险清单测试重点)
6. [回归测试建议用例集](#六回归测试建议用例集)

---

## 一、断点刻度全景

### 前台（UserShell 壳层统一 920 / 640，私有刻度分四套）

| 页面 | 壳层刻度 | 私有刻度 | 全部刻度 |
| --- | --- | --- | --- |
| index | 920 / 640 | 920 / 640 | **920 / 640** |
| applicant-front | 920 / 640 | 860 / 720 | **920 / 860 / 720 / 640** |
| applicant-calendar | 920 / 640 | 860 / 720 | **920 / 860 / 720 / 640** |
| scholar-front | 920 / 640 | 860 | **920 / 860 / 640** |
| assistant-front | 920 / 640 | 920 / 640 | **920 / 640** |
| manager-front | 920 / 640 | 920 / 640 | **920 / 640** |
| designer-front | 920 / 640 | 920 / 640 | **920 / 640** |

### 后台（AdminShell 壳层统一 960，小屏刻度三种）

| 页面 | 壳层刻度 | 私有刻度 | 全部刻度 |
| --- | --- | --- | --- |
| applicant-admin | 960 | 720 | **960 / 720** |
| scholar-admin | 960 | 720 | **960 / 720** |
| assistant-admin | 960 | 1100 / 720 | **1100 / 960 / 720** |
| manager-admin | 960 | 960 / 640 | **960 / 640** |
| designer-admin | 960 | 960 / 640 | **960 / 640** |
| gatherer-admin | 960 | 960 | **960** |
| investigator-admin | 960 | 960 | **960** |
| assessor-admin | 960 | 960 | **960** |

### 演示页

| 页面 | 壳层刻度 | 私有刻度 | 全部刻度 |
| --- | --- | --- | --- |
| assistant-retry-demo（亮壳） | 920 / 640 | 960 / 640 | **960 / 920 / 640** |
| gatherer-pause-demo（暗壳） | 960 | 960 | **960** |
| assessor-batch-demo（暗壳） | 960 | 960 | **960** |

---

## 二、前台页行为表

### 2.1 index.html · 平台总览

| 断点 | 层 | 行为（可测试） |
| --- | --- | --- |
| ≤920px | 壳+私有 | **同刻度同帧切换**：顶栏换行 + 导航沉底整行 + 目录墙 `.pg-grid` 4→2 列 + 事件流 `.pg-flow` 三栏→单栏 + main padding 收窄（R1 修正后，921-960 空档错位区已消除） |
| ≤640px | 壳 | 品牌区 `.us-brand` 限宽 58%；后台按钮 padding→`0 12px`；页脚纵向堆叠（column + flex-start） |
| ≤640px | 私有 | 目录墙 2 列→1 列；页面节距 `--space-7`→`--space-6`；小节头纵向（`.pg-sec-head` column） |

### 2.2 applicant-front.html · 岗位墙

| 断点 | 层 | 行为 |
| --- | --- | --- |
| ≤920px | 壳 | 同壳层标准（顶栏换行 / 导航沉底 / main padding 收窄） |
| ≤860px | 私有 | 特稿 hero 纵向（`.pg-hero` row→column，gap 36→22px，标题 40→32px） |
| ≤860px | 私有 | 头条岗位双栏→单栏；统计分隔线左线→顶线（`.pg-hero-stats` column→row） |
| ≤720px | 私有 | 岗位墙 `.pg-wall` 2 列→1 列；头条岗位标题 26→22px；行动按钮拉满宽（`width:100%`） |
| ≤640px | 壳 | 品牌限宽 / 页脚堆叠（同标准） |

### 2.2a applicant-calendar.html · 投递日历（D-15）

| 断点 | 层 | 行为 |
| --- | --- | --- |
| ≤860px | 私有 | 两栏棋盘 `.pg-board`（时间轴 1.9fr + 月历 1fr）→单列；月历栏 `.pg-rail` `order:-1` 移至时间轴上方、sticky→static（浏览器实测 railTop 353 < timelineTop 780 确认） |
| ≤720px | 私有 | 节点行四段→三列两行堆叠（D-day 徽标 88px 保持，实测 nodeCols=3/nodeRows=2，无横溢） |
| ≤920px / ≤640px | 壳 | 壳层标准（顶栏换行 / 品牌限宽 / 页脚堆叠） |

### 2.3 scholar-front.html · 馆藏检索

| 断点 | 层 | 行为 |
| --- | --- | --- |
| ≤920px | 壳 | 同壳层标准 |
| ≤860px | 私有 | 目录行第三列收窄 200→150px（`.pg-entry` 列宽调整，不堆叠——微调级断点） |
| ≤640px | 私有 | 检索栏纵向（`.pg-search-bar` column，高级按钮 42px 靠右） |
| ≤640px | 私有 | 目录行去第三列，元信息移至主信息下方横向标签行（`.pg-entry-meta` column→row + wrap） |
| ≤640px | 壳 | 品牌限宽 / 页脚堆叠 |

### 2.4 assistant-front.html · 智能对话

| 断点 | 层 | 行为 |
| --- | --- | --- |
| ≤920px | 壳+私有 | **同刻度双触发**：顶栏换行 + 对话区双栏并单栏（`.pg-chat` `260px 1fr`→`1fr`）+ 会话侧栏折叠为横滑条带（`.pg-session-list` column→row + `overflow-x:auto`，条目固定 `200px` 宽）一次全变 |
| ≤640px | 私有 | 消息流 padding 20→16px；页头纵向；发送按钮隐藏文字仅留图标（`.pg-send span` `display:none`） |
| ≤640px | 壳 | 品牌限宽 / 页脚堆叠 |

### 2.5 manager-front.html · 需求看板

| 断点 | 层 | 行为 |
| --- | --- | --- |
| ≤920px | 壳+私有 | **同刻度同帧切换**：顶栏换行 + KPI 带 4→2 列（`.pg-kpis`）+ 泳道看板 3 列→纵向堆叠、分隔线左线→顶线（`.pg-swimlane`）（R1 修正后与壳层对齐） |
| ≤640px | 私有 | KPI 2 列→1 列；页面节距收窄；小节头纵向 |
| ≤640px | 壳 | 品牌限宽 / 页脚堆叠 |

### 2.6 designer-front.html · 组件画廊

| 断点 | 层 | 行为 |
| --- | --- | --- |
| ≤920px | 壳+私有 | 顶栏换行 + 表单区双栏并单栏（`.pg-hero-grid` `7fr 5fr`→`1fr`）+ 展品网格 3→2 列 + 流程步骤 3→1 列（步骤分隔左线→顶线）**三网格同帧切换** |
| ≤640px | 私有 | 展品网格 2→1 列；状态条允许换行（`.pg-status` `flex-wrap:wrap`） |
| ≤640px | 壳 | 品牌限宽 / 页脚堆叠 |

---

## 三、后台页行为表

### 3.1 AdminShell 壳层统一行为（8 页 + 2 暗壳演示页共享）

| 断点 | 行为 |
| --- | --- |
| ≤960px | KPI 行 `.as-kpirow` 4 列→2 列；分隔线重排（奇数列清左线、偶数列加左线、第 3 项起加上边线） |
| 全断点 | 侧栏 `.as-sider` 固定 240px sticky，**任何断点不收起/隐藏** |
| reduced-motion | 壳层交互元素（nav/btn/badge/kpi）transition:none |

### 3.2 各页私有行为

| 页面 | 断点 | 行为 |
| --- | --- | --- |
| applicant-admin | ≤720px | 工具栏 padding 收窄；分页条纵向（column + flex-start） |
| scholar-admin | ≤720px | 同 applicant-admin |
| assistant-admin | ≤1100px | 意图分布卡与混淆矩阵卡两栏→单列（`.as-grid-2` `1.15fr .85fr`→`1fr`） |
| assistant-admin | ≤720px | 混淆矩阵行头列 96→70px、字号 12.5→11px；日志表字号 13→12px、单元格 padding 收窄 |
| manager-admin | ≤960px | 表格字号 13→12px、padding 收窄；进度条列 min-width 120→80px |
| designer-admin | ≤960px | 表格字号/padding 收窄（同 manager-admin） |
| designer-admin | ≤640px | 批量动作条纵向（`.as-actionbar` column + stretch） |
| gatherer-admin | ≤960px | 工具栏 gap/padding 收窄；搜索框独占整行（`flex:1 1 100%`）；分页条纵向 |
| investigator-admin | ≤960px | 同 gatherer-admin 工具栏模式 |
| assessor-admin | ≤960px | 同上 + 分析文档面板纵向（`.as-doc-panel` column，按钮靠右） |

### 3.3 表格溢出策略（测试必读 · R4 修正后统一）

| 模式 | 页面 | 说明 |
| --- | --- | --- |
| 始终滚动 | applicant/scholar-admin（min-width 760px）、assistant-admin（820px，R4 修正补齐）、manager-admin（760px）、designer-admin（720px）、gatherer-admin（880px）、investigator/assessor-admin（860px） | 容器基础样式即 `overflow-x:auto` + 表格 `min-width`，任意宽度窄于 min-width 即容器内横滚 |

**R4 修正记录（2026-09-09）**：assistant-admin 补 `overflow-x:auto` + `min-width:820px`（原无任何处理）；manager-admin / designer-admin 滚动启用点从 ≤640px 提升为基础样式（原 641-960px 存在挤压换行中间态）。至此 8 个后台页溢出策略完全统一为「始终容器内滚动」。

---

## 四、演示页行为表

| 页面 | 断点 | 行为 |
| --- | --- | --- |
| assistant-retry-demo | ≤960px | 两栏（对话 1fr + 控制台 300px）→单列堆叠，控制台移至对话下方；控制台 sticky→static |
| assistant-retry-demo | ≤920px / ≤640px | 壳层标准（顶栏换行 / 品牌页脚）；640 另含对话区收窄 + 发送按钮去文字 |
| gatherer-pause-demo | ≤960px | 两栏（1fr + 320px）→单列；导演台 sticky→static；壳层 KPI 2 列 |
| assessor-batch-demo | ≤960px | 同上（两栏堆叠 + sticky 失效）；表格容器横滚（min-width:720px） |

---

## 五、跨页风险清单（测试重点）

### R1 · 前台 921-960px 空档错位区 ✅ 已修正（2026-09-09）

**原风险**：index / manager-front 私有断点 960 早于壳层 920，该区间内容已降级但顶栏仍单行，6 项导航可能横滚。
**修正**：两页私有断点 960→920，与壳层刻度对齐。940px 实测为「4 列 + 单行」一致态，910px 为「2 列 + 换行」同帧切换，空档错位区消除。
**测试点**：920/921 临界双截屏对比（保留为回归用例 T1/T2）。

### R2 · 窄桌面 961-1080px 空档区 ✅ 已修正（2026-09-09）

**原风险**：所有断点不触发的最挤状态——1000px 视口 4 列卡片仅 222px 宽，`/investigator · :3017 · 控制台` 路由行溢出被 ellipsis 裁切（需 212px 实际 188px）。
**修正**：纯后台三卡（gatherer/investigator/assessor）路由文案去掉端口号，缩短为 `/xxx · 控制台`。1000px 实测 8 卡路由 0 裁切；5 张前台卡保留端口（文案短无风险）。
**测试点**：1024px 宽度走查 8 卡路由行完整显示（T12）。

### R3 · assistant-front 920px 断崖式三变

私有与壳层同刻度：顶栏换行 + 对话并单栏 + 会话栏横滑**同帧切换**。
**测试点**：920/921 两像素点对比；会话条带横滑是否顺畅（`overflow-x:auto` 生效）。

### R4 · 后台表格策略分裂 ✅ 已修正（2026-09-09）

**原风险**：三种溢出模式并存；assistant-admin 无任何滚动处理（≤720px 八列强制挤压），manager/designer-admin 在 641-960px 有「列压缩换行」中间态。
**修正**：统一为「始终容器内滚动」——assistant-admin 补 `overflow-x:auto` + `min-width:820px`（700px 视口实测：容器 397px、表格撑 820px、scrollable=true）；manager/designer-admin 滚动提升为基础样式。详见 3.3 节修正记录。
**测试点**：T7 更新为验证统一模式（800px 档三页均应横滚可用）。

### R5 · 侧栏 240px 恒定 ✅ 已修正（2026-09-09）

**原风险**：10 个 as-* 页面侧栏固定 240px 在所有断点不收起——375px 视口内容区仅 120px（33%），页面横向溢出（scrollWidth 529 > 375），叠加表格 min-width 必然双层滚动。
**修正**：统一注入 ≤720px 侧栏降级——侧栏 240→56px 图标列（品牌缩为首字、导航/底链只留图标居中、隐藏文字标签与分组名、面包屑只留当前级、内容 padding 收窄）。375px 实测：侧栏 56px、内容区 304px（84%）、**页面溢出消除**（360 ≤ 375）、导航图标全可见；1200px 桌面态无回归（240px、标签完整）。
**测试点**：375/720/721 三档走查侧栏形态切换与导航可用性（T8 更新）。

### R6 · assistant-retry-demo 母子页刻度不对齐

演示页 960px 才堆叠，母页 assistant-admin 1100px 即堆叠；且表格策略相反（演示可滚 / 母页不可）。属演示页独立实现，不影响业务页，但跨页对比测试时注意口径。

### R7 · applicant-front 独有 720px 刻度

岗位墙 1 列化早于其他页（641-720px 区间 applicant 已单列、其他页仍 2 列）；页脚堆叠 640 才发生，此区间「内容已单列、页脚仍横排」的状态需走查。

### R8 · scholar-front 860px 微调断点

仅收窄第三列（200→150px）不堆叠；851-920px 区间目录行三列挤压，长书名 ellipsis 截断需验证。

---

## 六、回归测试建议用例集

| # | 用例 | 宽度档位 | 页面 | 断言要点 |
| --- | --- | --- | --- | --- |
| T1 | 壳层换行临界 | 920 / 921 | 全前台 + retry-demo | 顶栏换行/单行切换无跳变残留 |
| T2 | 壳层换行临界（R1 修正后） | 920 / 921 / 940 | index、manager-front | 921-960 全区间内容与顶栏状态一致（R1 已修正，验证无回退） |
| T3 | 卡片墙列数阶梯 | 1280 / 910 / 600 | index（4→2→1）、designer-front（3→2→1） | 列数随档位正确切换，无半列卡 |
| T4 | 泳道堆叠 | 930 / 910 | manager-front | 3 列→堆叠 + 分隔线换向（920 临界同帧） |
| T5 | 对话区断崖 | 920 / 921 | assistant-front | R3 三变同帧；会话横滑可用 |
| T6 | KPI 阶梯 | 1200 / 950 / 600 | 任一后台 | 4→2 列分隔线重排正确（偶列左线、3+ 上边线） |
| T7 | 表格策略统一验证（R4 修正后） | 1280 / 800 / 600 / 375 | applicant-admin、assistant-admin、manager-admin | 三页 800px 档均应容器内横滚可用（统一「始终滚动」模式，验证无回退） |
| T8 | 侧栏降级（R5 修正后） | 375 / 720 / 721 / 1200 | 任一后台 + 暗壳演示页 | ≤720 侧栏 56px 图标列、导航图标可点、页面无横溢；721/1200 桌面态 240px 无回归 |
| T9 | 工具栏降级 | 950 | gatherer/investigator/assessor-admin | 搜索框独占整行、分页纵向 |
| T10 | 演示页堆叠 | 960 / 921 | 三个演示页 | 两栏堆叠 + 控制台 sticky 失效 |
| T11 | 动效降级 | 任意宽度 + reduced-motion | 全 17 页 | typing/shimmer/回弹/闪烁全部静态化 |
| T12 | 窄桌面路由完整性（R2 修正后） | 1024 / 1000 | index | 8 张应用卡路由行完整显示无 ellipsis 裁切 |

---

*本文档为交付快照。若后续前端改造调整任一 `@media` 块，须同步更新对应行为行与风险项；断点刻度全景表为回归的入口索引。*
