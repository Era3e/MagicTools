# 设计图 ↔ 前端实现 覆盖审计与偏移清单

> 审计范围：`apps/` 下 8 个子项目 web 前端全部路由（App.tsx 实测）↔ `magictools-ui-design/pages/` 设计图
> 审计日期：2026-09-11 · 审计后设计图 33 页，验证全绿
> 结论：**路由覆盖已补齐**（本轮新增 15 页）；**存在 14 处导航/命名偏移**待修复（见第三节）

---

## 一、覆盖矩阵（审计前 → 审计后）

| 子项目 | 真实路由（App.tsx） | 审计前设计图 | 本轮补充 | 现状 |
| --- | --- | --- | --- | --- |
| applicant | /positions 岗位墙 | applicant-front | — | ✅ |
| applicant | /positions/:id 详情 | **缺失** | applicant-position-detail | ✅ |
| applicant | /positions/:id/interviews | **缺失** | applicant-interview | ✅ |
| applicant | /calendar | applicant-calendar | — | ✅ |
| applicant | /resumes 简历中心 | **缺失**（设计为占位 #） | applicant-resume | ✅ |
| applicant | /admin/positions | applicant-admin | — | ✅ |
| scholar | /entries | scholar-front（对应 /entries） | — | ✅ |
| scholar | /search | **缺失** | scholar-search | ✅ |
| scholar | /graph | **缺失** | scholar-graph | ✅ |
| scholar | /admin/settings | **缺失**（设计侧栏占位） | scholar-settings-admin | ✅ |
| scholar | /admin/entries | scholar-admin | — | ✅ |
| assistant | /chat | assistant-front | — | ✅ |
| assistant | /admin/feedback | **缺失** | assistant-feedback-admin | ✅ |
| assistant | /admin/intent-logs | assistant-admin | — | ✅ |
| manager | /requirements 看板 | manager-front | — | ✅ |
| manager | /requirements/:id | **缺失** | manager-requirement-detail | ✅ |
| manager | /admin/requirements | manager-admin | — | ✅ |
| manager | /admin/iterations | **缺失**（设计侧栏占位） | manager-iteration-admin | ✅ |
| designer | /generate 定制生成 | **缺失** | designer-generate | ✅ |
| designer | /studio 画布工坊 | **缺失** | designer-studio | ✅ |
| designer | /components 前台馆藏 | designer-front（画廊定位相近） | — | ⚠️ 定位偏移见 D-13 |
| designer | /admin/components | designer-admin | — | ✅ |
| designer | /admin/history | **缺失** | designer-history-admin | ✅ |
| gatherer | /admin/sources | gatherer-admin | — | ✅ |
| gatherer | /admin/sources/:id | **缺失** | gatherer-source-detail | ✅ |
| gatherer | /admin/sources/:sourceId/items | （并入源详情条目表） | — | ✅ 合并覆盖 |
| investigator | /admin/surveys | investigator-admin | — | ✅ |
| investigator | /admin/surveys/:id | **缺失** | investigator-survey-detail | ✅ |
| assessor | /admin/requests | assessor-admin | — | ✅ |
| assessor | /admin/requests/:id | **缺失** | assessor-request-detail | ✅ |
| gateway | / 网关总览 | index | — | ✅ |

**审计前缺口 15 个路由，已全部补齐。**

---

## 二、本轮新增 15 页清单

前台亮壳 6 页：applicant-position-detail / applicant-interview / applicant-resume / scholar-search / scholar-graph / designer-generate / designer-studio（7 页）
后台暗壳 8 页：assistant-feedback-admin / manager-iteration-admin / designer-history-admin / scholar-settings-admin / manager-requirement-detail（前台壳）/ gatherer-source-detail / investigator-survey-detail / assessor-request-detail

全部通过：令牌零硬编码、lucide 渲染、暗壳 `.dark` 域、断点降级（沿用各应用母版刻度）、reduced-motion；浏览器抽检 3 页（图谱 SVG 节点 / 工作室三栏 / 源详情 KPI+表格）无溢出无缺陷。

---

## 三、设计 ↔ 实现偏移清单（待修复，按影响排序）

### D-01 求职导航项文案不一致（P0 · 导航层）

实现 `USER_NAV`：**岗位博览 / 投递日历 / 简历工坊**（3 项）
设计图（applicant-front + calendar）：**岗位墙 / 日历 / 简历中心 / 面试复盘**（4 项）
差异：① 三项文案全部不同；② 设计多「面试复盘」项（对应 /positions/:id/interviews 深层路由，实现未入导航）。
**修复方向（选一）**：实现向设计对齐（4 项，interviews 依赖岗位上下文可跳最新一条）；或设计向实现对齐（改回 3 项文案，面试复盘并入岗位详情内页）。

### D-02 书库导航结构偏移（P0 · 导航层）

实现：前台 `馆藏条目 / 书目检索 / 知识图谱`（/entries /search /graph），后台 `知识库设置 / 条目编目`
设计：scholar-front 侧为「馆藏检索」单页叙事 + 侧栏图谱入口；本轮新页已按实现三项导航制作，但 scholar-front 本身的导航仍是旧版（检索/图谱/类目锚点式）。
**修复方向**：改 scholar-front 导航为三项路由式，与 scholar-search/graph 互链；后台侧栏两页（scholar-admin / scholar-settings-admin）导航项补齐互链。

### D-03 助手后台导航偏移（P0 · 导航层）

实现 `ADMIN_NAV`：**反馈处理 / 意图日志**（默认落 feedback）
设计 assistant-admin：业务导航为「意图日志/模型路由/提示词模板」（意图日志 active），反馈处理页（本轮新增）与意图日志页导航组不一致，且「模型路由/提示词模板」无对应实现。
**修复方向**：两页侧栏统一为 反馈处理 / 意图日志 两项，删除无实现的占位项。

### D-04 交付后台导航偏移（P0 · 导航层）

实现 `ADMIN_NAV`：**需求管理 / 迭代管理**
设计 manager-admin：侧栏为「需求管理/迭代排期/交付看板」三项占位；iteration-admin（新增）为「需求管理/迭代管理」两项。
**修复方向**：manager-admin 侧栏改为两项与实现对齐（删除占位）。

### D-05 工坊前台导航偏移（P0 · 导航层）

实现 `USER_NAV`：**定制生成 / 画布工坊 / 组件馆藏**（/components 前台复用 ComponentList）
设计 designer-front：画廊叙事页（展品网格 + 委托表单），导航旧版；generate/studio（新增）已用三项导航但「组件馆藏」指向 admin 页。
**修复方向**：统一三页导航为 定制生成 / 画布工坊 / 组件馆藏；「组件馆藏」前台项应指向独立前台列表设计（现缺，见 D-13）。

### D-06 工坊后台导航偏移（P0 · 导航层）

实现：**组件馆藏 / 生成历史** 两项
设计 designer-admin：侧栏「组件馆藏/委托管理/发布历史」占位三项；history-admin（新增）为「组件馆藏/生成历史」。
**修复方向**：designer-admin 侧栏对齐两项。

### D-07 采集后台导航偏移（P1 · 导航层）

实现：单页 `/admin/sources`（导航「信息源管理」），detail 路由存在但不在导航
设计：侧栏「信息源管理/采集任务/入库历史」占位 + source-detail 侧栏三占位。
**修复方向**：侧栏收敛为「信息源管理」单项（+详情返回），或实现补导航项。

### D-08 调研后台导航偏移（P1 · 导航层）

实现：单页「主题档案管理」；设计占位「调研列表/问卷管理/访谈记录」。
**修复方向**：同 D-07 收敛。

### D-09 评审后台导航偏移（P1 · 导航层）

实现：单页「分析请求审批」（评审工坊 / Assessor Bureau）；设计 assessor-admin 侧栏「评审请求/评审标准/分析文档」占位 + 页头命名「评审请求」。
**修复方向**：侧栏单项对齐 + 页头标题改「分析请求审批」。

### D-10 求职前台命名偏移（P1 · 文案层）

实现页面标题「岗位博览」（USER_NAV label）；设计「岗位墙」。同 D-01 一并处理。

### D-11 助手前台缺口（P1 · 页面层）

实现 `/feedback` 直接重定向到 /admin/feedback（用户前台无反馈页）；设计交互文档 §4 前台分册记载前台有「使用反馈」入口。
**修复方向**：确认产品口径——反馈仅后台则更新文档删除前台反馈描述。

### D-12 交付前台命名偏移（P1 · 文案层）

实现 UserShell title「交付驾驶舱」+ 导航「需求台」；设计 manager-front 标题「交付管理」+ hero「交付驾驶舱」。
**修复方向**：统一 title 为「交付驾驶舱」或导航项改「需求看板」，择一口径。

### D-13 工坊前台「组件馆藏」路由缺独立设计（P2 · 页面层）

实现 `/components`（前台壳渲染 ComponentList front 模式）与 `/admin/components`（后台壳）同组件双形态；设计仅有后台 designer-admin，前台形态（画廊网格 + 委托叙事）由 designer-front 近似覆盖但非列表页。
**修复方向**：补一页 designer-components-front（前台列表形态），或确认画廊页即前台形态并更新文档。

### D-14 学者书库前台路由基础偏移（P2 · 结构层）

实现前台首页落 `/entries`（馆藏条目列表 = EntryList）；设计 scholar-front 为「馆藏检索」检索+目录卡叙事页，与本轮 scholar-search 定位重叠。
**修复方向**：明确 scholar-front 对应 /entries（列表）还是 /search（检索）；建议 front 页转为条目列表形态，检索页保持本轮新版。

---

## 四、修复批次建议

| 批次 | 内容 | 涉及 | 状态 |
| --- | --- | --- | --- |
| 批次 1（导航对齐） | D-01/02/03/04/05/06 六组侧栏与导航统一为真实路由口径 | 19 页导航区 | ✅ 已完成（2026-09-11）：求职 5 页、书库 5 页、助手 2 页、交付 2 页、工坊 5 页全部替换为实现口径（岗位博览/投递日历/简历工坊 · 馆藏条目/书目检索/知识图谱 · 反馈处理/意图日志 · 需求管理/迭代管理 · 定制生成/画布工坊/组件馆藏 · 组件馆藏/生成历史），旧占位项（面试复盘/模型路由/提示词模板/迭代排期/交付看板/委托管理/发布历史/馆藏管理组）零残留；Grep 逐组核验 + validate 全绿 |
| 批次 2（文案对齐） | D-10/12 标题命名 + D-09 页头 | 5 页局部 | ✅ 已完成（2026-09-11）：D-10 求职工坊壳名「求职工坊」+ 简历页「简历工坊」；D-12 交付壳名「交付驾驶舱」+ 导航收敛单项「需求台」自指；D-09 评审页头/面包屑/侧栏统一「分析请求审批」（顺带完成 D-07/08 同类收敛的评审侧：占位组换为 分析请求审批/请求详情 互链）。validate 全绿 |
| 批次 3（口径确认） | D-11 反馈归属、D-13 前台馆藏、D-14 书库基础页定位 | 补/改 3 页 | ✅ 已完成（2026-09-11 决策落地）：D-11 新增 assistant-feedback 前台反馈页（类型三 chip + 表单 + 历史，补实现侧 /feedback 前台形态）；D-13 新增 designer-components 前台组件列表页（网格 + 筛选 + CTA 闭环）；D-14 scholar-front 重构为馆藏条目列表（检索职责移交 scholar-search，表单 action 指向）。画布 35 页，浏览器抽检 + validate 全绿 |

---

*审计依据：各 App.tsx 路由与 USER_NAV/ADMIN_NAV 实测读取（2026-09-11）；偏移修复后须同步更新三册交互文档的导航章节与本清单状态列。*
