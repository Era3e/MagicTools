---
---

## 文档治理：新增 CODE_WIKI 工程 Wiki + 修复跨文档事实冲突

**新增：docs/CODE_WIKI.md（完整工程师上手速查手册 v1.1）**
- 17 章节覆盖：项目概述 / 目录结构 / 端口约定 / 6 个公共包详解 / 需求+知识两条主线 / 前端规范与 8 应用主题对照表 / NestJS 服务层规范 / gateway 路由表 / 工程化脚本 / Git 工作流 / CI/CD / 运行方式 6 场景 / Docker 镜像清单 / 关键决策 12 条 / 已知问题 9 条 / 文档索引。
- 内嵌 6 张 Mermaid 可视化图：系统分层架构图、Outbox 状态机图、需求主线时序图、知识主线时序图、前端三外壳组件结构图、CI/CD 流水线管道图。
- 与 ui-spec.md / AGENTS.md / git-workflow.md / README.md / state.md 建立 📎 交叉引用声明（CODE_WIKI 为速查摘要版，规范变更请先改主文档），消除冗余。

**P0 事实冲突修复（2 处）：**
- README.md §架构要点：将落后一代的单一 `AppShell` 表述，升级为「三外壳统一入口（UserShell/AdminShell/AppShell + 全局设计令牌 tokens）」，与 PR #28/#29 后实际代码 + ui-spec.md 对齐。
- docs/memory/state.md §关键决策：补记「数据库 ORM 选型：原生 SQL + Zod 校验，不引入 TypeORM/Prisma」—— 此架构在各 NestJS server 中早已落地，但 state.md 此前漏记。
- docs/CODE_WIKI.md §16.1 决策表：补决策 #11「端口唯一来源 infra/ports.yaml」 + #12「部署：单台阿里云 ECS + Docker Compose」，与 state.md 双向对齐。

**P1 摘要缺项补齐（6 处）：**
- §8.1：`MtEmptyState` 扩写调用约束（title 必填 + actionText/onAction 两参数）。
- §8.2：补两条硬约束（AdminShell 不接受 theme 参数 + 三外壳受控组件，@mt/ui 零 react-router 依赖）。
- §12：加 🔴 TDD 先行硬约声明；分支模型 main 行加注「合并触发：images 打镜像 + changesets 版本发布」副作用。
- §16.2 已知问题：扩写网络代理三要点（http.proxy + https.proxy 同设 / 断网切 push_files / 无 gh 走 App check_runs）；补 3 条新问题（.env 仓库根 + loadRootEnv / Docker Desktop + pgvector 9 库 / 0 bug loop 缺验收落地产物）。
