# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。

## 当前状态快照（2026-08-18）

- **项目阶段**：设计已评审通过；Phase 0（工程化基座）实施计划已完成（13 个任务 + DoD），待选择执行方式。
- **下一步**：执行 Phase 0 计划（执行方式二选一：subagent-driven / inline）。
- **仓库状态**：git 已初始化（main 分支）；已提交：设计文档（1cf1a0b）、记忆机制（b96941c）、Phase 0 计划。
- **关键文档**：docs/superpowers/specs/2026-08-18-magictools-platform-design.md；docs/superpowers/plans/2026-08-18-phase0-foundation.md

## 关键决策（摘要，详见设计文档）

- 全栈 TypeScript（React+NestJS+PostgreSQL+pgvector），pnpm Monorepo；
- 8 子项目 + gateway；端口注册表 infra/ports.yaml；
- LLM：DeepSeek + 智谱，@mt/model-client 统一抽象；
- 数据交互：网关 + 同步 REST + outbox + 幂等键；
- 部署：单台阿里云 ECS + Docker Compose；
- Applicant 为 Phase 1 并行试点；Designer 降级版；Assistant MVP 3 意图；
- 分支绑任务不绑对话，四层清理机制。

## 进行中任务

- 无（等待 Phase 0 实施计划）

## 已知问题

- 无
