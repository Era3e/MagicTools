# Manager 内容修订与审批验收记录

日期：2026-09-11。分支：`feat-manager-P08-approval`，基于第一批 PR #69 的 `900bdc6d72df4eb09cb2193c1f42bea97d9f5ebf`。

本批交付 P08 的内容修订与审批部分。原规划还包含执行预算与自动领取门禁，需在执行队列阶段补齐，因此不将原规划标记为全部完成。当前始终保持 manual。

## 独立测试智能体验收

| 验收智能体 | 验证内容 | 结果 |
|---|---|---|
| approval_backend_review | 独立 PostgreSQL 中的迁移、快照、内容失效、并发、凭证、身份防伪、审计分页与旧导入哈希兼容 | 23/23，通过；修复空白验收条件和越界游标后复验通过 |
| approval_frontend_review | 独立新增组件行为 12 条及 API transport 3 条；TypeScript 检查 | 15/15，通过 |
| approval_frontend_review | agent-browser 桌面与 390px：内容编辑保存、历史版本切换、只读比较、关闭及几何/控制台检查 | 发现 1 项、修复 1 项、0 遗留；长范围文本换行复验通过 |

独立前端用例保存在 `apps/manager/web/src/pages/RequirementApproval.review.test.tsx` 与 `apps/manager/web/src/api.review.test.ts`。后端专用套件包含 `requirement-revisions.e2e.test.ts`、`import-batch.e2e.test.ts`、`requirement-foundation.e2e.test.ts`。

## 本地门禁与真实浏览器

| 检查 | 结果与证据 |
|---|---|
| `pnpm qa:gate` | 最终退出 0：构建/测试 46/46 任务，公共包 coverage、infra 14/14、文档校验、设计检查 126 PASS 及 Manager 专用集成通过 |
| Manager 单元与组件测试 | Server 单元 18/18；Web 28/28，其中独立新增 15 条 |
| Manager 专用 PostgreSQL 集成 | 23/23，零跳过 |
| `pnpm smoke` | 17/17 HTTP 探针通过 |
| Manager 功能 E2E | 7/7：长范围手机换行、1440/390px 审批闭环、候选导入、原有主线与页面导航 |
| 既有 Manager 视觉快照 | 2/2，未修改基线 |
| 既有 Manager 响应式 | 4/4：375/768px 前台看板与后台列表 |

审批 E2E 使用临时随机凭证，走实际请求头校验；编辑、审批、撤销均等待服务端响应并检查页面或数据库返回的业务状态。未使用绕过审批的测试开关。E2E 文件为 `e2e/tests/manager-approval.spec.ts`。

长范围缺陷的回归遵循 RED→GREEN：修复前 390px 页面宽度 1581px；加入详情层换行保护后测试通过，独立智能体使用同一条第 5 版记录复验，范围段落宽度等于 scrollWidth。没有通过截断文字或隐藏横向内容掩盖问题。

## 验证边界

- 本地使用 Node 20.20.2 和本轮独立 PostgreSQL 16（55432）；未操作机器原有 5432 数据库。
- 便携数据库没有 pgvector：既有 Scholar 18 条、Assistant 11 条与 DB/outbox 3 条仍依原逻辑跳过，不代表这些数据库能力已验证。HTTP 健康探针通过也不代表 Scholar 数据库迁移完成。
- CI 使用仓库已有 pgvector PostgreSQL 服务；远端 quality、smoke、e2e 的实际状态应查看本次草稿 PR。
- 桩模式与本地演示不等于真实 LLM 效果、产品验收或生产部署。
- 所有真实凭证、进程脚本、日志和临时演示数据均不进入 Git。

## 文档与交付范围

已同步功能说明、历史 MVP 文档的当前行为入口、CODE_WIKI Manager 章节、coverage-matrix M12/M13、平台 CHANGELOG、docs/memory 和空 changeset。新增配置仅在模板与 Compose 透传，默认未配置拒绝审批。

本批未修改 App 路由或 USER_NAV/ADMIN_NAV，设计导航映射没有变化；新功能复用当前详情页和 @mt/ui 主题。后续执行队列仍需实现依赖核验、预算、原子领取与租约、工作区隔离、检查报告及结果回写。
