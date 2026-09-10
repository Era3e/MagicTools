# D-15 投递日历设计（Applicant 前台跨岗位视角）

> 来源：docs/memory/mvp-deferred.md D-15（规划遗漏，P2）——MVP 只有单岗位面试 Tab 列表 + InterviewPage 单份复盘，无跨岗位面试时间轴/日历。
> 状态：已评审（2026-09-10，方案 B 轻量 schema 扩展 + 前台日历页，用户拍板）。

## 1. 背景与目标

### 1.1 现状缺口

- `interviews` 表只有 `happened_at`（复盘语义、回顾性），无「计划中面试」概念；InterviewForm 不让用户填时间（落库取 now() 默认值），复盘时间 = 录入时间；
- `positions` 有六态 status（waiting/applied/written/interview/offer/rejected）但无 `applied_at` 投递时间戳，「投了多久没回音」无法计算；
- 面试复盘藏在单岗位路径 `/positions/:id/interviews` 下，无跨岗位聚合视角。

### 1.2 目标

1. 前台新增「投递日历」页：跨岗位的投递/面试全事件月历 + 时间线双视图；
2. 支持录入「计划面试」（未来时间），到点后标记完成并回填复盘；
3. 提供前瞻信号：KPI 读数（在投/面试流程中/未来 7 天面试/待跟进）+ 待跟进清单（投递超 7 天无进展）。

### 1.3 非目标（本期不做，见 §8 Backlog）

通知提醒、iCal 导出、面试结果多态状态机、服务端聚合/分页、复盘行内编辑。

## 2. 数据模型变更

migration 文件：`apps/applicant/server/migrations/002_delivery_calendar.sql`

```sql
ALTER TABLE positions ADD COLUMN IF NOT EXISTS applied_at timestamptz;

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'done';
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_status_check;
ALTER TABLE interviews ADD CONSTRAINT interviews_status_check CHECK (status IN ('scheduled','done'));
```

- `applied_at` 可空：`waiting`（未投）岗位为 NULL，语义干净；
- `interviews.status` 默认 `done`：存量复盘记录自动归 `done`，零数据迁移；`scheduled` = 计划中（`qa_notes` 允许空串）；
- repo 层同步：`PositionRow/PositionInput/mapRow` 补 `appliedAt`；`InterviewRow/mapRow` 补 `status`；`updatePosition` 的全列 UPDATE 语句与合并逻辑纳入 `applied_at`。

## 3. API 契约（applicant-server）

### 3.1 新增 `GET /interviews`（跨岗位面试列表）

响应：`InterviewWithPosition[]`，按 `happened_at DESC`：

```jsonc
[{ "id": "...", "positionId": "...", "round": 1, "happenedAt": "ISO",
   "qaNotes": "", "reflection": "", "analysis": null, "status": "scheduled",
   "company": "示例公司", "title": "前端工程师", "positionStatus": "interview" }]
```

实现：interview.repo 新增 `listAllWithPosition()`（JOIN positions 取 company/title/status）。个人工具量级，不做服务端分页/聚合，前端基于 `listPositions()` + `GET /interviews` 两接口组合出全部视图数据。

### 3.2 扩展 `POST /positions/:positionId/interviews`

body 从 `{ round, qaNotes, reflection }` 扩展为：

```jsonc
{ "round": 1, "happenedAt": "ISO 可选（缺省 now）", "qaNotes": "status=done 时必填",
  "reflection": "可选", "status": "scheduled | done，缺省 done" }
```

- 兼容性：status 缺省 done 且 qaNotes 必填——既有调用（e2e/前端原路径）行为不变；
- 校验：status ∈ {scheduled, done}；status=done 时 qaNotes 必填（BadRequest）；status=scheduled 时 qaNotes 可空（存空串）。

### 3.3 新增 `PATCH /interviews/:id`

body：`{ happenedAt?: string, status?: "scheduled" | "done" }`（均可选，至少一项）。用途：计划面试改期 / 标记完成。标记完成时 `happened_at` 不动（保持计划时间），复盘内容回填仍走后续编辑路径（本期不做行内编辑，见非目标）。

### 3.4 扩展 `PATCH /positions/:id`

- `PositionInput` 增 `appliedAt?: string | null`；
- **自动落库规则**（PositionService.update）：patch.status === "applied" 且当前 appliedAt 为空且 patch 未显式携带 appliedAt → 自动置 now()；手动传入的 appliedAt 永远优先，自动逻辑不覆盖既有值（幂等）。

## 4. 前端设计

### 4.1 路由与导航

- 新页 `CalendarPage`，前台路由 `/calendar`；
- `App.tsx` USER_NAV 增第三项 `{ key: "/calendar", label: "投递日历" }`。

### 4.2 CalendarPage（杂志风主题语言，useTheme 取色，遵循 ui-spec 强制规则）

结构自上而下：

1. **报头**：eyebrow `CALENDAR · 投递日历` + 刊名式标题（对齐 PositionWall Hero 风格）；
2. **MtKpiRow 四读数**：在投（status ∈ applied/written/interview 的岗位数）/ 面试流程中（status=interview）/ 未来 7 天面试（status=scheduled 且 0 ≤ happenedAt − now ≤ 7d）/ 待跟进（见下）；
3. **视图切换条**：月历 / 时间线（Segmented 或等价自绘，遵循无硬编码色值规则）；
4. **月历视图（默认）**：7 列 CSS Grid 月网格（手写实现，零外部日历库，与 @mt/ui patterns 零依赖风格一致），周一起始；格内事件标记三类——投递（砖红圆点，取 appliedAt）/ 计划面试（琥珀块）/ 已完成面试（墨点）；今日格描边高亮；月首尾补位灰格；`‹ ›` 切月 + 「回到本月」；点格子弹当日事件清单（Popover 或下方面板），点事件跳 `/positions/:id`（投递/岗位维度）或 `/positions/:id/interviews`（面试维度）；
5. **时间线视图**：全事件倒序等宽时间线（JetBrains Mono 日期 + 公司 · 岗位 + 事件类型 + MtStatusTag 状态），对齐「飞行日志」mono 时间线语言；
6. **待跟进区**：`appliedAt` 距今超 7 天、status 仍为 applied、且无任何面试记录的岗位清单（公司 · 岗位 · 已等 N 天 · 跳转详情）；
7. **空态**：无岗位/无事件时 MtEmptyState，actionText「去岗位博览」跳 `/positions`。

### 4.3 InterviewForm 扩展

- 增「面试时间」DatePicker（默认当前时刻，dayjs 为 antd 既有传递依赖，不新增包依赖）；
- 双提交路径：**保存复盘**（status=done，qaNotes 必填，现有行为）与**记为计划**（status=scheduled，qaNotes 免填、可留空，happenedAt 接受未来时间）。

### 4.4 InterviewPage 适配

- scheduled 条目：MtStatusTag「待进行」+ 「标记完成」按钮（调 PATCH status=done，成功后刷新）；
- scheduled 条目不渲染 AnalysisView（复盘分析无意义，待完成后可用）。

### 4.5 PositionDetail 适配

信息行补「投递于 YYYY-MM-DD」（appliedAt 非空时）。

### 4.6 api.ts 扩展

- `Position` 增 `appliedAt?: string | null`；`Interview` 增 `status: "scheduled" | "done"`；
- 新增 `listAllInterviews()`、`updateInterview(id, { happenedAt?, status? })`；`createInterview` 入参扩展。

## 5. 视觉与规范遵循

- 全部取色走 useTheme() + @mt/ui tokens，禁硬编码（ESLint no-hardcoded-colors 门禁）；
- 数字/日期 mono + tabular-nums（ui-spec §二 v2 规则 3）；状态标签用 MtStatusTag（规则 4）；
- 响应式断点遵循 v2.3 收尾轮体系（640/860/920/960）：月历格最小宽约 44px，920px 以下事件标记收纳为计数点、时间线单列。

## 6. 测试策略

### 6.1 server e2e（interview.e2e.test.ts / position.e2e.test.ts 扩展）

1. 计划面试全链路：POST status=scheduled（qaNotes 空）→ GET /interviews 带 position 信息 → PATCH 改期 → PATCH status=done；
2. 校验拒绝：POST status=done 且 qaNotes 缺失 → 400；PATCH 非法 status → 400；
3. appliedAt 自动落库：PATCH status=applied（不带 appliedAt）→ appliedAt 有值；再次 PATCH → 不被覆盖；显式传 appliedAt → 手动值优先；
4. 既有用例回归：POST 缺省 status 行为不变。

### 6.2 web 单测

- `CalendarPage.test.tsx`：月历渲染（当月事件落格）/ 视图切换 / KPI 计算（含未来 7 天窗口）/ 待跟进清单（7 天阈值、无面试记录条件）/ 空态；
- `InterviewForm` 计划模式：切计划后 qaNotes 免填、提交 payload 含 status=scheduled 与所选时间。

### 6.3 Playwright e2e（applicant.spec.ts 新用例，遵守 E2E 校准纪律：锚点全部对照源码实证）

- 前台导航「投递日历」→ /calendar 渲染报头与 KPI；
- 时间线视图可见已构造的投递/面试事件（数据经 API 构造，断言唯一键而非位置）；
- 副作用断言等完成事件（waitForResponse）。

### 6.4 视觉基线与响应式

- `e2e/fixtures/pages.ts` PAGES 清单增 `/calendar`（anchor 定 `投递日历|每一次投递` 类报头文案，实施时按页面源码实证定稿）→ 视觉基线 16 → 17 张；注意 USER_NAV 加项后 `front-applicant-position-wall` 基线必然漂移，本地清库态全量重生成 win32（基线生成前必须清库——state.md 既有教训），合入后 dispatch visual-baseline 重生成 linux；
- responsive.spec 自动纳管新页（375/768 两档巡检）。

## 7. 文档与流程收尾（合 main 前完成）

1. coverage-matrix 补 A14 行（投递日历，实际实现文件写仓库全路径——drift guard 校验 ✅ 行路径真实性）；
2. mvp-deferred D-15 → ✅（注明 PR 号与降级说明列内容）；统计摘要 18 项中真延期 4→3；
3. changeset（applicant 双包为私有包，纯私有 changeset 不参与发布，参考 #54 后清理经验——本次直接不加发布包行）；
4. docs/CHANGELOG.md 追加条目；CODE_WIKI §6.1 核对（前台页面清单与路由表补 /calendar）；
5. state.md 更新；PR body 勾选「0 bug loop 验收记录」+「沉淀层文档已同步」两项 CI 强制检测。

## 8. Backlog（明确不做，触发条件留档）

| 项 | 说明 | 重启触发 |
|----|------|---------|
| 提醒通知 | 面试前/待跟进超期提醒（需通知通道） | 用户提出具体通道（邮件/飞书）需求时 |
| iCal 导出 | 日历订阅外部日程 | 与移动端日程联动需求出现时 |
| 面试结果状态机 | passed/failed 细分 | 求职流程管理深化时 |
| 服务端聚合分页 | 数据量大时性能优化 | 岗位+面试记录 > 数千条时 |

## 9. 验收标准

1. server e2e / web 单测 / Playwright e2e 全绿（新用例零 skip）；
2. qa:gate 全绿（lint 0 err / build / test / coverage / infra / docs 0 err）；
3. 视觉基线 17 张重生成且全量通过（win32），responsive 巡检含新页全绿；
4. smoke 17 服务 PASS；
5. 文档收尾五项完成（§7 清单）。
