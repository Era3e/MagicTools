# MagicTools 全线 UI/UE 设计图 · 交付总索引

> 设计系统：墨蓝石墨·工房感 v2.2（令牌源 `colors_and_type.css`）
> 画布入口：`magictools-ui-design.design`（15 页节点，9 个分组）
> 交付日期：2026-09-08 · 验证状态：工作区验证与交付就绪检查全部通过

---

## 一、设计页面（15 页）

### 网关（画布组 0）

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 平台总览 | [pages/index.html](./pages/index.html) | 编辑部目录式八应用卡片墙 + 事件流向 + 服务状态，全站互跳枢纽 |

### 前台 · UserShell 亮色壳（各应用专属 accent）

| 应用 | 页面 | 文件 | accent | 核心构图 |
| --- | --- | --- | --- | --- |
| 求职工坊 | 岗位墙 | [pages/applicant-front.html](./pages/applicant-front.html) | 赤陶 #a8522e | 特稿 hero + 岗位杂志网格 + 简历工坊入口 |
| 学者书库 | 馆藏检索 | [pages/scholar-front.html](./pages/scholar-front.html) | 松绿 #2f5a3b | 检索栏 + 目录卡列表 + 图谱入口 |
| 智能助手 | 智能对话 | [pages/assistant-front.html](./pages/assistant-front.html) | 瓷青 #4a688c | 气泡流 + 引用来源 + 会话侧栏 |
| 交付管理 | 需求看板 | [pages/manager-front.html](./pages/manager-front.html) | 靛蓝 #3a5f84 | FLIGHT DECK 泳道看板 + KPI 读数行 |
| 组件工坊 | 组件画廊 | [pages/designer-front.html](./pages/designer-front.html) | 墨石 #1c2530 | 画廊 hero + 委托表单 + 展品网格 |

### 后台 · AdminShell 石墨深色控制台（统一壳）

| 应用 | 页面 | 文件 | 核心模块 |
| --- | --- | --- | --- |
| 求职后台 | 岗位管理 | [pages/applicant-admin.html](./pages/applicant-admin.html) | KPI 行 + 筛选工具栏 + 岗位表格 |
| 书库后台 | 馆藏管理 | [pages/scholar-admin.html](./pages/scholar-admin.html) | 馆藏表格 + 来源/状态双 badge |
| 助手后台 | 意图日志 | [pages/assistant-admin.html](./pages/assistant-admin.html) | 意图分布堆叠条 + 5×5 混淆矩阵 + 日志表 |
| 交付后台 | 需求驾驶舱 | [pages/manager-admin.html](./pages/manager-admin.html) | 需求表格 + 优先级 badge + 进度条 |
| 工坊后台 | 组件馆藏 | [pages/designer-admin.html](./pages/designer-admin.html) | 组件表格 + 版本 mono + 批量发布动作条 |
| 采集后台 | 采集源管理 | [pages/gatherer-admin.html](./pages/gatherer-admin.html) | 采集源表 + Cron mono 列 + CSS 启停开关 |
| 调研后台 | 调研管理 | [pages/investigator-admin.html](./pages/investigator-admin.html) | 调研表 + 调度状态 + 飞书推送列 |
| 评审后台 | 评审请求 | [pages/assessor-admin.html](./pages/assessor-admin.html) | 评审表 + 双 badge 体系 + 分析文档入口 |

### 交互演示（画布组 3 附页）

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 重试演示 | [pages/assistant-retry-demo.html](./pages/assistant-retry-demo.html) | AI 回复失败重试状态机可交互演示：5 场景注入 + 实时状态仪表 |

---

## 二、交互说明文档（docs/）

| 分册 | 文件 | 覆盖内容 |
| --- | --- | --- |
| 前台分册 | [docs/interaction-spec-frontend.md](./docs/interaction-spec-frontend.md) | 网关 + 5 前台：结构 / 交互元素 / 空态 / 加载态 / 错误态 / 互跳 / 可访问性 / 响应式，9 章共性规范 + 附录 A |
| 业务分册 | [docs/interaction-spec-admin-business.md](./docs/interaction-spec-admin-business.md) | 求职/书库/助手/交付后台：同构十节 + AdminShell 契约 + 空/载/错共性规范 |
| 运营分册 | [docs/interaction-spec-admin-ops.md](./docs/interaction-spec-admin-ops.md) | 工坊/采集/调研/评审后台：同构十节 + 第 5/6/7 章三级共性规范 |
| 深度补充 | [docs/deep-dive-assistant-retry.md](./docs/deep-dive-assistant-retry.md) | 重试状态机 / 错误码矩阵 / 重试时序 / DOM 模板 / 11 项验收清单 |
| 断点行为表 | [docs/responsive-breakpoint-matrix.md](./docs/responsive-breakpoint-matrix.md) | 17 页断点刻度全景 / 逐页行为表 / 8 项跨页风险 / 11 条回归用例（测试用） |

每页统一章节：页面定位 → 结构 → 导航/交互元素清单 → 数据状态组件 → 互跳 → 空态与加载态 → 错误态 → 可访问性 → 响应式。

---

## 三、设计系统资产

| 资产 | 文件 | 说明 |
| --- | --- | --- |
| 品牌令牌 | [colors_and_type.css](./colors_and_type.css) | 墨蓝/石墨/琥珀十阶 + 语义色 + 八应用 accent 派生 + 排版/间距/圆角/投影/动效 |
| 用户壳片段 | partials/user-shell.html | 报头式水平导航 + 琥珀描边后台入口 + 页脚（us-*） |
| 管理壳片段 | partials/admin-shell.html | 石墨侧栏 + 毛玻璃顶栏 + AdminPageHead 七槽位（as-*） |
| 生成树 | generation-tree.json | 2 共享分支 + 15 叶子的页面生成谱系 |
| 编排摘要 | runtime-orchestration-summary.json | 流程证据 / 生成树引用 / 互跳 wiringPlan |

### 双壳契约速览

- **前台壳**：亮色纸面，应用专属 accent（导航激活下划线 + 卡片顶边），衬线大标题编辑部气质
- **后台壳**：统一石墨深色（八后台不个性化），AdminPageHead 七槽位（eyebrow/标题/badges/描述/动作/KPI），琥珀单强调
- **贯穿锚点**：mono 等宽读数（时间戳/计数/ID）· 语义 badge（底 50 阶 + 字 700 阶）· 前后台互跳闭环（后台管理按钮 ↔ 返回前台）

---

## 四、建议阅读顺序

1. 本索引 → 建立全局认知
2. `pages/index.html`（画布）→ 总览全站结构与互跳
3. 任一前台页 + 对应后台页 → 体会双壳差异与闭环
4. `docs/interaction-spec-frontend.md` 第 7-9 章 → 掌握三大共性契约（壳 / 空载错态 / 错误体系）
5. `pages/assistant-retry-demo.html` → 交互演示关键态
6. 需要深度实现时 → `docs/deep-dive-assistant-retry.md` §10 开发对接要点

---

## 五、验证记录

- `validate-design-workspace.mjs`：通过（15 HTML 全部有效，0 错误）
- `validate-finish-readiness.mjs`：通过（success: true, errors: []）
- 全站 26+ 内部链接经脚本核验无死链；图标 CDN（lucide@1.8.0）经网络验证可用
