# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。

## 当前状态快照（2026-08-18）

- **项目阶段**：设计已评审通过，待转入实施计划（writing-plans）。
- **下一步**：产出 Phase 0（工程化基座）实施计划。
- **仓库状态**：git 已初始化（main 分支），首个提交 1cf1a0b 为平台总体设计文档。

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
