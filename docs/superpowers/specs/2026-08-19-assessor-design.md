# Assessor（评审者）子系统设计（MVP）

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-19
- 状态：✅ 已确认（2026-08-19 用户确认 A1~A4 四项默认值）
- 上游：docs/superpowers/specs/2026-08-18-magictools-platform-design.md（5.3 节）；Investigator 事件契约 researcher.response.push

## 1. 定位

需求分析设计系统（需求主线第二环）：消费 Investigator 推送的结构化调研结果，人工补充上下文（文本 + GitHub 代码仓库）后调用 LLM 生成「需求分析 + 可落地设计方案」，人工审核通过后推送 Manager 创建需求记录。

## 2. 功能模块

### 2.1 分析请求收件箱（消费 Investigator）
- 轮询 investigator 库 outbox 的 researcher.response.push 事件（单实例 PG 跨库读，复用 @mt/db processOutbox）
- 每次推送批次聚合为一个「分析请求」（analysis_requests）：关联 survey 名 + 若干条结构化 responses
- 列表展示：来源主题、条数、状态（pending/draft/review/approved/rejected）

### 2.2 上下文补充
- 手动补充：需求背景文本（自由编辑）
- GitHub 仓库：维护仓库地址（owner/repo）→ 拉取仓库元信息（README + 目录树 + 主语言）作为 LLM 上下文
- MVP：公开仓库走 GitHub API（无需 token）；可选 GITHUB_TOKEN 提升限流（60 次/时 → 5000）

### 2.3 LLM 分析与方案生成
- 一键生成：输入 = 结构化调研结果 + 手动上下文 + 仓库上下文 → 输出两份 markdown：
  1. **需求分析**：背景/目标用户/核心问题/约束/风险
  2. **设计方案**：功能拆解/技术方案/验收标准/工作量估算
- 存储：analysis_requests.analysis_md / design_md；可重新生成（覆盖）

### 2.4 人工审核
- 状态流：pending → draft（已生成方案）→ review（提交审核）→ approved / rejected
- 审核页：并排展示调研数据、上下文、两份文档；通过/驳回 + 驳回意见

### 2.5 推送 Manager（主线第二环打通）
- approved 后一键推送 → 写 outbox 事件 requirement.created（source=assessor，payload 含分析+方案+调研来源）→ 标记 pushed_at
- Manager 未实现前：前端显示「已推送待 Manager 接收」（与 Investigator 同模式）

## 3. 数据模型（PostgreSQL，assessor 库）

| 表 | 关键字段 |
|---|---|
| analysis_requests | id, survey_name, source_event_ids(jsonb), status, context_text, repo_url, repo_context(jsonb), analysis_md, design_md, review_comment, pushed_at, timestamps |
| analysis_items | id, request_id, response_id, structured(jsonb), sentiment, priority（分析请求的明细行） |
| outbox（@mt/db 复用） | 事件 requirement.created |

- 数据库自举（复用 Investigator 的 ensureDatabase 模式）

## 4. API 设计（NestJS，前缀 /api/assessor）

| 方法/路径 | 说明 |
|---|---|
| POST /inbox/poll | 触发拉取 investigator outbox 未消费事件（可重复，幂等） |
| GET /requests?status= | 分析请求列表 |
| GET /requests/:id | 详情（含 items、上下文、文档） |
| PATCH /requests/:id | 更新上下文（context_text / repo_url） |
| POST /requests/:id/generate | 生成/重新生成分析与方案（LLM，桩模式支持） |
| POST /requests/:id/review | 审核：{ approve: boolean, comment? } |
| POST /requests/:id/push | 推送 Manager（outbox requirement.created） |
| GET /meta/github-status | GitHub token 配置状态 |

## 5. 技术要点

1. **跨库消费**：assessor 服务另建一个指向 investigator 库的连接池（INVESTIGATOR_DATABASE_URL），processOutbox 消费 researcher.response.push → 写入本地 analysis_requests（以 event id 去重，幂等）。复用 @mt/db 的 processOutbox（消费后标记 done，天然 at-least-once + 幂等）。
2. **GitHub 上下文**：GET /repos/{owner}/{repo}/readme（base64 解码）+ GET /repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1（截断目录树前 200 条）+ 语言占比；GITHUB_STUB=1 桩模式（CI/E2E）。
3. **LLM**：@mt/model-client + MT_LLM_STUB（分析/方案两类桩）。
4. **端口**：assessor web 4003 / server 5003（已登记）；独立库 assessor；loadRootEnv 已就位（PR #6）。
5. **CI**：smoke/e2e 的 assessor 服务加 MT_LLM_STUB=1 + GITHUB_STUB=1 + INVESTIGATOR_DATABASE_URL 指向同库 investigator；E2E 全流程（poll → 补上下文 → generate → review → push）。

## 6. 已确认的决策（2026-08-19 用户确认）

- **A1**：消费方式 = Assessor 轮询 investigator 库 outbox（跨库连接池 + 幂等），同步 REST 回调留 Backlog
- **A2**：GitHub 仓库上下文 MVP 支持公开仓库 + 可选 GITHUB_TOKEN（私有仓库）
- **A3**：一次推送批次 = 一个分析请求；LLM 一次生成分析+方案；状态流 pending→draft→review→approved/rejected
- **A4**：推送 Manager 用 outbox 事件 requirement.created（Manager 建成前仅标记已推送）

## 7. 验收标准（DoD）

1. inbox 轮询消费 investigator 事件幂等入库（重复 poll 不产生重复请求）
2. GitHub 仓库上下文拉取（桩模式 E2E）
3. LLM 生成需求分析 + 设计方案（桩模式 E2E）；审核状态流完整
4. approved 推送落 requirement.created 事件，契约供 Manager 消费
5. CI 全绿 + docs/迭代日志同步 + 合并 main
