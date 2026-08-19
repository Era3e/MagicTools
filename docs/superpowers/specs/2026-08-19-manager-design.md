# Manager（管理者）子系统设计（MVP）

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-19
- 状态：✅ 已确认（2026-08-19 用户确认 M1~M4 四项默认值）
- 上游：docs/superpowers/specs/2026-08-18-magictools-platform-design.md（5.4 节）；Assessor 事件契约 requirement.created

## 1. 定位

项目管理系统（需求主线收官）：对需求开发全生命周期进行管理。三来源（Assessor 推送 / 手动录入 / 第三方同步）以标签区分；需求 ↔ 分支 ↔ PR 关联，状态随 PR 联动；简单迭代管理。Phantom = 外部需求接入框架（adapter 模式）的代号。

## 2. 功能模块

### 2.1 需求收件箱（消费 Assessor）
- 轮询 assessor 库 outbox 的 requirement.created 事件（跨库读，幂等，模式同 Assessor）
- 事件 → 需求记录：source=assessor，source_ref=requestId，source_payload=完整事件（分析/方案/仓库/审核意见），状态=待分析

### 2.2 需求全生命周期
- 需求 CRUD + 状态流：待分析 → 设计中 → 待开发 → 开发中 → 测试中 → 待验收 → 已完成
- 三来源自动标签：assessor（推送）/ manual（手动录入）/ github（同步）/ cybercloud（预留）
- 手动录入：标题/描述/优先级（P0/P1/P2）
- 状态流转：手动 + PR 状态辅助（见 2.3）

### 2.3 分支/PR 关联
- 需求详情维护分支名（feat-<项目>-<任务ID> 规范）与 PR 链接
- 「刷新 PR 状态」：GitHub API 查 PR → open=开发中、merged=待验收、closed=待开发（自动更新状态 + 记录时间线）
- webhook 实时联动留 Backlog（需公网回调，部署后再做）

### 2.4 第三方同步（Phantom adapter 框架）
- adapter 接口：fetchRequirements() → 规范化需求（title/description/source_ref/labels）
- MVP 实现 GitHub Issues adapter（按仓库拉 issues，source=github，含 labels）；cybercloud adapter 留接口（待其 API 文档）
- 手动触发同步（按钮/接口），定时同步留 Backlog

### 2.5 迭代管理
- 迭代 CRUD：名称 + 起止日期；需求挂迭代；迭代视图（按状态分组计数）

## 3. 数据模型（PostgreSQL，manager 库）

| 表 | 关键字段 |
|---|---|
| requirements | id, title, description, source(assessor/manual/github/cybercloud), source_ref, source_payload(jsonb), status, priority(P0/P1/P2), iteration_id?, branch, pr_url, labels(jsonb), timeline(jsonb), timestamps |
| iterations | id, name, start_date, end_date, timestamps |
| outbox（@mt/db 复用） | 本 MVP 仅消费 requirement.created（不产出事件） |

- 数据库自举（复用 ensureDatabase 模式）

## 4. API 设计（NestJS，前缀 /api/manager）

| 方法/路径 | 说明 |
|---|---|
| POST /inbox/poll | 消费 assessor 库 requirement.created（幂等） |
| GET/POST /requirements?status=&source=&iterationId= | 需求列表 / 新建（手动） |
| GET/PATCH /requirements/:id | 详情 / 更新（状态/优先级/分支/PR 链接/迭代） |
| POST /requirements/:id/refresh-pr | 拉取 PR 状态并联动更新需求状态 |
| GET/POST /iterations | 迭代列表 / 新建 |
| POST /sync/github | 同步 GitHub Issues（Phantom adapter 首个实现） |
| GET /meta/github-status | GitHub token 状态 |

## 5. 技术要点

1. **跨库消费**：assessor 库只读连接池（ASSESSOR_DATABASE_URL）+ processOutbox，event id 去重幂等
2. **GitHub adapter**：复用 Assessor 的 GitHub 客户端模式（issues 列表 + PR 状态查询；GITHUB_STUB=1 桩模式）
3. **状态联动规则**（refresh-pr）：open → 开发中；merged → 待验收；closed(未合并) → 待开发；不可回退已验收/已完成
4. **LLM**：Manager 本 MVP 不调用 LLM（无生成类功能）；预留 llm.ts 占位不引入
5. **端口**：manager web 4004 / server 5004（已登记）；独立库 manager；loadRootEnv 就位
6. **CI**：smoke/e2e 的 manager 服务加 GITHUB_STUB=1 + ASSESSOR_DATABASE_URL；E2E 全流程（poll → 手动建 → 关联 PR → refresh → 迭代）

## 6. 已确认的决策（2026-08-19 用户确认）

- **M1**：消费方式 = Manager 轮询 assessor 库 outbox（幂等），与 Assessor 消费 Investigator 同模式
- **M2**：Phantom 框架 MVP 实现 GitHub Issues adapter 作为首个实例；cybercloud adapter 留接口；定时同步留 Backlog
- **M3**：PR 状态联动用「手动触发刷新」（GitHub API 拉取）；webhook 实时联动留 Backlog
- **M4**：Manager MVP 不调用 LLM；状态流 7 态手动流转 + PR 状态辅助映射

## 7. 验收标准（DoD）

1. inbox 消费 requirement.created 幂等入库（source=assessor 标签）
2. 需求 CRUD + 7 态状态流 + 三来源标签；手动录入
3. 分支/PR 关联 + refresh-pr 状态联动（桩模式 E2E）
4. GitHub Issues 同步（Phantom adapter 首个实现，桩模式 E2E）
5. 迭代 CRUD + 需求挂迭代
6. CI 全绿 + docs/迭代日志同步 + 合并 main（Phase 1 三环全部打通）
