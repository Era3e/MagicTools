# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。

## 当前状态快照（2026-08-18 晚）

- **项目阶段**：Phase 1 启动（目标已建立）。Appellant 试点为第一棒，正在澄清需求（待用户确认：岗位收集图片识别场景等 4 个问题）。
- **下一步**：Applicant 澄清完成 → spec → plan → 实现 → CI 全绿 → 合并 main；随后需求主线（Investigator→Assessor→Manager）。
- **ClawCV 调研结论**：后端 api.wondercv.com + API Key 鉴权；免费额度 10 PDF/20 改写/20 分析每月；能力 analyze_resume / rewrite_resume_section / match_resume_to_job 与 Applicant 直接联动；手册见 docs/integrations/clawcv-setup.md。
- **仓库状态**：GitHub 远端 https://github.com/Era3e/MagicTools（main 为默认分支）；本地 main 已同步 origin/main；dev 分支与 worktree 已按流程清理。
- **关键文档**：docs/superpowers/specs/2026-08-18-magictools-platform-design.md；docs/superpowers/plans/2026-08-18-phase0-foundation.md
- **外部集成手册**：docs/git-workflow.md（GitHub 仓库设置操作步骤）；docs/integrations/feishu-setup.md（飞书开放平台接入步骤）

## 关键决策（摘要，详见设计文档）

- 全栈 TypeScript（React+NestJS+PostgreSQL+pgvector），pnpm Monorepo；
- 8 子项目 + gateway；端口注册表 infra/ports.yaml；
- LLM：DeepSeek + 智谱，@mt/model-client 统一抽象；
- 数据交互：网关 + 同步 REST + outbox + 幂等键；
- 部署：单台阿里云 ECS + Docker Compose；
- Applicant 为 Phase 1 并行试点；Designer 降级版；Assistant MVP 3 意图；
- 分支绑任务不绑对话，四层清理机制。

## 进行中任务

- 无

## 已知问题

1. 本机 PowerShell 执行策略限制：pnpm/npx 一律用 pnpm.cmd；
2. Docker Desktop 需手动启动（引擎就绪后 compose 正常）；
3. 镜像推送需先在 GitHub 配置 Secrets（REGISTRY_HOST/USERNAME/PASSWORD），未配置时 images job 自动跳过；
4. 子智能体委托（subagent/subagent_fork）在本环境不可用，多智能体协作需外部 CLI 环境（见 executing-plans 技能说明）。
