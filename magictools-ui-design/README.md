# MagicTools 全线 UI/UE 设计图 · 交付总索引

> 设计系统：墨蓝石墨·工房感 v2.2（令牌源 `colors_and_type.css`）
> 画布入口：`magictools-ui-design.design`（15 页节点，9 个分组）
> 交付日期：2026-09-08 · 验证状态：工作区验证与交付就绪检查全部通过

---

## 一、设计页面（35 页，含 3 演示页）

### 网关（画布组 0）

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 平台总览 | [pages/index.html](./pages/index.html) | 编辑部目录式八应用卡片墙 + 事件流向 + 服务状态，全站互跳枢纽 |

### 前台 · UserShell 亮色壳（各应用专属 accent）

| 应用 | 页面 | 文件 | accent | 核心构图 |
| --- | --- | --- | --- | --- |
| 求职工坊 | 岗位博览 | [pages/applicant-front.html](./pages/applicant-front.html) | 赤陶 #a8522e | 特稿 hero + 岗位杂志网格 + 简历工坊入口 |
| 求职工坊 | 投递日历 | [pages/applicant-calendar.html](./pages/applicant-calendar.html) | 赤陶 #a8522e | D-day 时间轴清单 + 月历格 + 岗位进度横带（跨岗位视角） |
| 求职工坊 | 岗位详情 | [pages/applicant-position-detail.html](./pages/applicant-position-detail.html) | 赤陶 #a8522e | 岗位概览头 + 招聘流程侧栏 + JD 关键词 chips |
| 求职工坊 | 面试管理 | [pages/applicant-interview.html](./pages/applicant-interview.html) | 赤陶 #a8522e | 面试时间轴 + 二面复盘 + 自评星级 |
| 求职工坊 | 简历工坊 | [pages/applicant-resume.html](./pages/applicant-resume.html) | 赤陶 #a8522e | 简历版本 + 上传拖放区 + 解析匹配环（82%）+ 能力缺口 chips |
| 学者书库 | 馆藏条目列表 | [pages/scholar-front.html](./pages/scholar-front.html) | 松绿 #2f5a3b | 馆藏条目列表 + 类型/来源筛选 + 收藏星标（D-14 重构） |
| 学者书库 | 书目检索 | [pages/scholar-search.html](./pages/scholar-search.html) | 松绿 #2f5a3b | 检索 hero + 高级筛选行 + 结果列表 + 检索辅助侧栏 |
| 学者书库 | 知识图谱 | [pages/scholar-graph.html](./pages/scholar-graph.html) | 松绿 #2f5a3b | 图谱工具条（布局切换）+ 图谱写布 + 节点详情侧栏 + 统计条 |
| 智能助手 | 智能对话 | [pages/assistant-front.html](./pages/assistant-front.html) | 瓷青 #4a688c | 气泡流 + 引用来源 + 会话侧栏 |
| 智能助手 | 使用反馈 | [pages/assistant-feedback.html](./pages/assistant-feedback.html) | 瓷青 #4a688c | 反馈类型单选 + 反馈表单 + 我的反馈历史（不在导航内，对话页「反馈」入口进入） |
| 交付管理 | 需求台 · 交付驾驶舱 | [pages/manager-front.html](./pages/manager-front.html) | 靛蓝 #3a5f84 | FLIGHT DECK 泳道看板 + KPI 读数行 |
| 交付管理 | 需求详情 | [pages/manager-requirement-detail.html](./pages/manager-requirement-detail.html) | 靛蓝 #3a5f84 | 需求头部（编号 + P1/开发中 badge）+ 动态时间线 + 需求信息卡（前台壳） |
| 组件工坊 | 组件画廊 | [pages/designer-front.html](./pages/designer-front.html) | 墨石 #1c2530 | 画廊 hero + 委托表单 + 展品网格 |
| 组件工坊 | 定制生成 | [pages/designer-generate.html](./pages/designer-generate.html) | 墨石 #1c2530 | 生成表单 + 参数侧栏（温度/尺寸）+ 生成中进度 + 代码预览 |
| 组件工坊 | 画布工坊 | [pages/designer-studio.html](./pages/designer-studio.html) | 墨石 #1c2530 | 画布工具条（撤销/重做/预览/保存）+ Palette 面板 + 组件画布 |
| 组件工坊 | 组件馆藏前台 | [pages/designer-components.html](./pages/designer-components.html) | 墨石 #1c2530 | 组件卡片网格（8/86 在架）+ 分类/状态 chip 筛选 + mono 读数行 |

### 后台 · AdminShell 石墨深色控制台（统一壳）

| 应用 | 页面 | 文件 | 核心模块 |
| --- | --- | --- | --- |
| 求职后台 | 岗位管理 | [pages/applicant-admin.html](./pages/applicant-admin.html) | KPI 行 + 筛选工具栏 + 岗位表格 |
| 书库后台 | 馆藏管理 | [pages/scholar-admin.html](./pages/scholar-admin.html) | 馆藏表格 + 来源/状态双 badge |
| 书库后台 | 知识库设置 | [pages/scholar-settings-admin.html](./pages/scholar-settings-admin.html) | LLM 设置（摘要模型 + 温度）+ Obsidian 同步 + 采集入库阈值 |
| 助手后台 | 意图日志 | [pages/assistant-admin.html](./pages/assistant-admin.html) | 意图分布堆叠条 + 5×5 混淆矩阵 + 日志表 |
| 助手后台 | 反馈处理 | [pages/assistant-feedback-admin.html](./pages/assistant-feedback-admin.html) | 反馈筛选工具栏 + 反馈表格 + 处理状态流转 |
| 交付后台 | 需求驾驶舱 | [pages/manager-admin.html](./pages/manager-admin.html) | 需求表格 + 优先级 badge + 进度条 |
| 交付后台 | 迭代管理 | [pages/manager-iteration-admin.html](./pages/manager-iteration-admin.html) | 迭代列表 + 需求摘要区 |
| 工坊后台 | 组件馆藏 | [pages/designer-admin.html](./pages/designer-admin.html) | 组件表格 + 版本 mono + 批量发布动作条 |
| 工坊后台 | 生成历史 | [pages/designer-history-admin.html](./pages/designer-history-admin.html) | KPI 1,284/36/91%/24s + 生成任务表（任务 ID mono + 模型列） |
| 采集后台 | 采集源管理 | [pages/gatherer-admin.html](./pages/gatherer-admin.html) | 采集源表 + Cron mono 列 + CSS 启停开关 |
| 采集后台 | 源详情 | [pages/gatherer-source-detail.html](./pages/gatherer-source-detail.html) | 源信息卡（启停开关）+ 采集条目表 + 采集日志 |
| 调研后台 | 调研管理 | [pages/investigator-admin.html](./pages/investigator-admin.html) | 调研表 + 调度状态 + 飞书推送列 |
| 调研后台 | 调研详情 | [pages/investigator-survey-detail.html](./pages/investigator-survey-detail.html) | 调研信息 + 问卷题目 + 回收趋势柱图 + 访谈记录 |
| 评审后台 | 分析请求审批 | [pages/assessor-admin.html](./pages/assessor-admin.html) | 评审表 + 双 badge 体系 + 分析文档入口 |
| 评审后台 | 请求详情 | [pages/assessor-request-detail.html](./pages/assessor-request-detail.html) | 请求信息卡（通过/驳回）+ 意见时间线 + 趋势面板 |

### 交互演示（画布组 3 附页）

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 重试演示 | [pages/assistant-retry-demo.html](./pages/assistant-retry-demo.html) | AI 回复失败重试状态机可交互演示：5 场景注入 + 实时状态仪表 |
| 暂停演示 | [pages/gatherer-pause-demo.html](./pages/gatherer-pause-demo.html) | 采集源连续失败自动暂停状态机：场景注入 + 导演控制台 + 规格说明 |
| 批量演示 | [pages/assessor-batch-demo.html](./pages/assessor-batch-demo.html) | 批量分配部分成功复合反馈：勾选表 + 场景注入 + 复合 toast |

---

## 二、交互说明文档（docs/）

| 分册 | 文件 | 覆盖内容 |
| --- | --- | --- |
| 前台分册 | [docs/interaction-spec-frontend.md](./docs/interaction-spec-frontend.md) | 网关 + 5 前台：结构 / 交互元素 / 空态 / 加载态 / 错误态 / 互跳 / 可访问性 / 响应式，9 章共性规范 + 附录 A |
| 业务分册 | [docs/interaction-spec-admin-business.md](./docs/interaction-spec-admin-business.md) | 求职/书库/助手/交付后台：同构十节 + AdminShell 契约 + 空/载/错共性规范 |
| 运营分册 | [docs/interaction-spec-admin-ops.md](./docs/interaction-spec-admin-ops.md) | 工坊/采集/调研/评审后台：同构十节 + 第 5/6/7 章三级共性规范 |
| 深度补充 | [docs/deep-dive-assistant-retry.md](./docs/deep-dive-assistant-retry.md) | 重试状态机 / 错误码矩阵 / 重试时序 / DOM 模板 / 11 项验收清单 |
| 断点行为表 | [docs/responsive-breakpoint-matrix.md](./docs/responsive-breakpoint-matrix.md) | 17 页断点刻度全景 / 逐页行为表 / 8 项跨页风险（4 项已修正）/ 16 条回归用例 + R3/R6/R7/R8 专项 14 条（测试用） |
| 覆盖审计 | [docs/design-impl-audit.md](./docs/design-impl-audit.md) | 8 子项目 30 路由 ↔ 33 页设计图覆盖矩阵 / 14 项偏移清单（D-01~14）与修复批次（审计用） |

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

- `validate-design-workspace.mjs`：通过（35 HTML 全部有效，0 错误）
- `validate-finish-readiness.mjs`：通过（success: true, errors: []）
- 全站内部链接经脚本核验无死链；图标 CDN（lucide@1.8.0）经网络验证可用
