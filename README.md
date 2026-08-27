# MagicTools

面向个人使用的一体化 AI 工作工具平台，由 8 个业务子项目 + 1 个统一网关 + 6 个公共包组成，全栈 TypeScript。

## 子项目

| 子项目 | 定位 | 说明 |
|---|---|---|
| Applicant | 求职 | 岗位管理 / JD 解析 / 截图识别 / 面试复盘 / 简历管理（ClawCV 集成与降级） |
| Investigator | 调研 | 飞书 Bitable 源 / LLM 结构化 / 结果筛选与推送 |
| Assessor | 评审 | 需求分析 + 设计方案 + 人工审核 |
| Manager | 管理 | 需求全生命周期 / 迭代 / PR 联动 / Phantom 外部需求接入 |
| Gatherer | 采集 | RSS / JSON / 网页选择器采集 + 去重 + LLM 富化 |
| Scholar | 知识 | 知识收件箱 / 全文+向量检索 / 知识图谱 / Obsidian 同步 |
| Assistant | 助手 | 意图路由 / 圈定问答 / 数据查询 / 故障排查 / 反馈 |
| Designer | 设计 | 自然语言 / 图片 → 组件源码 → 沙箱预览 |

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Ant Design 5
- **后端**：Node.js 20 + NestJS 10 + TypeScript
- **数据库**：PostgreSQL 16 + pgvector + 全文检索 FTS
- **仓库**：pnpm workspace + Turborepo
- **LLM**：`@mt/model-client` 统一抽象（DeepSeek + 智谱，OpenAI 兼容协议）
- **测试**：Vitest（单元 / 集成）+ Playwright（E2E）+ 覆盖率门槛

## 架构要点

- **唯一入口**：所有外部访问经 `gateway`（路径路由 / 简单鉴权 / 健康检查聚合），端口唯一来源 [infra/ports.yaml](infra/ports.yaml)
- **服务间通信**：同步 REST + outbox 事件表（`@mt/db`）+ 幂等键
- **独立边界**：每个子项目 = 独立 `web + server` + 独立数据库（PG 单实例多库）
- **前端三外壳统一入口** `@mt/ui`：UserShell（前台 · 每应用独立审美主题）+ AdminShell（后台 · 全平台统一控制台风）+ AppShell（单一形态过渡外壳）+ 全局设计令牌 tokens

## 目录结构

```text
apps/              8 子项目（web + server）+ gateway
packages/          公共包：config / db / model-client / types / ui / utils
docs/              设计文档（superpowers/specs+plans）、记忆、UI 规范、迭代日志
infra/             docker-compose、ports.yaml、部署与工程化脚本
e2e/               Playwright 端到端测试
.github/workflows/ CI/CD 流水线
```

## 快速开始

```bash
# 前置：Node >= 20、pnpm 9、本地 PostgreSQL（跑冒烟 / E2E 需要）
pnpm install

# 开发（单子项目）
pnpm --filter @mt/applicant-web dev
pnpm --filter @mt/applicant-server dev

# 质量门禁（本地合入前）
pnpm qa:gate
```

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm build` / `pnpm test` | 构建 / 单元与集成测试 |
| `pnpm lint` | ESLint（typescript-eslint + react-hooks） |
| `pnpm coverage` | 覆盖率（公共包设 70/70/70/50 门槛） |
| `pnpm qa:gate` | 本地门禁：lint + build + test + coverage + infra + docs |
| `pnpm smoke [--only <服务>]` | 冒烟 |
| `pnpm new:app <name>` | 新建子项目 |
| `pnpm changeset` | 添加迭代日志 |

## 文档

- 设计文档：`docs/superpowers/specs/`（含各子项目设计）
- 实施计划：`docs/superpowers/plans/`
- 即时记忆：`docs/memory/`
- UI 规范：`docs/ui-spec.md`
- 迭代日志：`docs/CHANGELOG.md`
- Git 工作流：`docs/git-workflow.md`
- 外部集成：`docs/integrations/`（飞书 / ClawCV / cybercloud）

> **Windows 提示**：PowerShell 执行策略限制，pnpm 一律使用 `pnpm.cmd`。
