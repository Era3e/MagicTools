# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。

## 当前状态快照（2026-08-18 晚）

- **项目阶段**：Phase 1 · 需求主线第一棒 Investigator 实现完成（T1~T9 提交 dev，本地验证：qa-gate 绿、双栈冒烟 PASS、E2E 6/6、server 16 测试 + web 2 测试全绿），待 PR dev→main 合并。
- **下一步**：Investigator PR 合并 → Assessor（消费 researcher.response.push 事件）→ Manager。
- **关键事件契约**：researcher.response.push（source=investigator，payload 含 surveyId/responseId/structured/sentiment/priority），Assessor 消费。
- **Applicant 能力清单**：岗位 CRUD/六状态看板/JD 文本解析/截图视觉识别（glm-4v）/投递话术/面试复盘分析/复盘→简历改写闭环/ClawCV 集成+无 Key 降级。
- **仓库就绪度（2026-08-19 核实）**：main 分支保护已启用（required checks: quality/smoke/e2e；0 审批；禁止强推/删除）；GitHub Secrets 尚未配置（ClawCV/镜像仓库均未配，降级路径与 images 跳过守卫已覆盖）；main 最近 CI 全部 success。
- **ClawCV 调研结论**：后端 api.wondercv.com + Bearer API Key；免费额度 10 PDF/20 改写/20 分析每月；已从 npm 包 clawcv@1.1.0 源码逆向出全部端点与请求体契约（/cv/v1/mcp/{session,analyze,rewrite,match,ai-mentor,pdf}，详见 docs/integrations/clawcv-setup.md），adapter 实现无风险。
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
2. 沙箱会向 git 注入 HTTP_PROXY=127.0.0.1 等代理环境变量，代理软件未运行时 git 无法联网（报 "over proxy 127.0.0.1"）；**推送前需清空**：`$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:ALL_PROXY=''; $env:NO_PROXY='*'`（gh CLI 不受影响，可直接用）；
3. Docker Desktop 需手动启动（引擎就绪后 compose 正常）；
4. 镜像推送需先在 GitHub 配置 Secrets（REGISTRY_HOST/USERNAME/PASSWORD），未配置时 images job 自动跳过；
5. 子智能体委托（subagent/subagent_fork）在本环境不可用，多智能体协作需外部 CLI 环境（见 executing-plans 技能说明）。
