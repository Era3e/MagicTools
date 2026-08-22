# MagicTools AI 协作开发入口指令（AGENTS.md）

## 会话启动协议（每次会话必做）

1. 读本文件；
2. 读 docs/memory/ 下全部记忆文件（当前状态、关键决策、进行中任务、已知问题）；
3. 读任务涉及子项目的相关文档：docs/superpowers/specs/（设计）、docs/superpowers/plans/（实施计划）、docs/CHANGELOG.md（迭代日志）；
4. 之后才能开始任何开发动作。

## 项目速览

- Monorepo（pnpm + turbo）：apps/ 下 8 子项目（web+server）+ gateway；packages/ 公共包（config/utils/types/model-client/ui/db）
- 全栈 TypeScript：React 18 + Vite + AntD 5 / NestJS 10 / PostgreSQL 16 + pgvector
- 端口唯一来源 infra/ports.yaml；服务间同步 REST + outbox（@mt/db）+ 幂等键
- LLM 唯一入口 @mt/model-client（DeepSeek + 智谱，可扩展）

## 硬性约定

1. TDD：先写失败测试再实现；禁止 TODO/TBD 占位符
2. 提交遵循 Conventional Commits（中文 subject，动词开头，不超过 50 字）
3. 每个任务完成即刻更新 docs/memory/ 与 changeset（迭代日志），禁止事后补记
4. 分支命名 feat-<项目>-<任务ID>-<描述>；一个任务一个 worktree；会话收尾必须执行收尾协议（见 docs/git-workflow.md）
5. 质量门禁：合入前本地跑 pnpm qa:gate，冒烟 pnpm smoke，全绿才可提交
6. 开发与测试分拆不同智能体（0 bug loop）：开发 agent 完成后必须由测试 agent 独立验收
7. 前端必须使用 @mt/ui（MtThemeProvider + tokens），禁止硬编码颜色值

## 常用命令

- pnpm install / pnpm build / pnpm test / pnpm lint / pnpm coverage / pnpm test:infra
- pnpm new:app <name>（新子项目）
- pnpm smoke [--only <服务>]（冒烟）
- pnpm qa:gate（本地门禁）
- pnpm ws:create <项目> <任务ID> / pnpm ws:cleanup <项目> <任务ID>（worktree）
- pnpm changeset（添加迭代日志）

> 本机 Windows 环境提示：PowerShell 执行策略限制，pnpm 一律使用 pnpm.cmd。
