# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目设计文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。
> 本文件定位「当前状态快照」，历史细节见 docs/CHANGELOG.md 与 docs/superpowers/specs/、plans/。

## 当前状态快照（2026-08-22）

- **交付状态**：8 子项目全部交付。需求主线三环（Investigator → Assessor → Manager）、知识主线（Gatherer → Scholar → Assistant）、Designer（降级版）均完成；Assistant 意图路由扩至 6 类并完成 cybercloud 真实对接（testcybercloud-dev 实测打通）。
- **工程化基座**：Monorepo（pnpm + turbo）+ 网关 + outbox + 幂等 + CI/CD + Docker 部署链路；main 分支保护（required checks: quality/smoke/e2e）。
- **本轮改造（2026-08-22，尚未合并）**：
  - 前端统一外壳 `@mt/ui` 的 `AppShell`（侧边导航 + 顶栏 + 跨应用切换），8 子项目全部接入，替换原先 3 处重复的深色 Menu 外壳与 5 处裸 Card；
  - 接入 ESLint（typescript-eslint + react-hooks），根 `lint` = `eslint .`；
  - 接入覆盖率门槛（`@vitest/coverage-v8`，5 个 DB 无关公共包 70/70/70/50），纳入 `pnpm qa:gate`；
  - 统一 scholar-server 四个 e2e 套件的 skip 守卫（与其它服务一致），本地无 DB 也能稳定绿灯。

## 关键决策

- 全栈 TypeScript（React+NestJS+PostgreSQL+pgvector），pnpm Monorepo + Turborepo；
- 8 子项目 + gateway，端口唯一来源 infra/ports.yaml；
- LLM 统一入口 @mt/model-client（DeepSeek + 智谱，OpenAI 兼容协议）；
- 数据交互：网关 + 同步 REST + outbox + 幂等键；
- 部署：单台阿里云 ECS + Docker Compose；
- 分支绑任务不绑对话，四层清理机制。

## 关键事件契约

1. `researcher.response.push`（investigator → assessor）
2. `requirement.created`（assessor → manager，payload 含 analysisMd/designMd/repoUrl/reviewComment）
3. `knowledge.item.collected`（gatherer → scholar，payload 含 itemId/url/title/content/summary/category/keywords/publishedAt）

## 进行中任务

- 前端交互补全：各列表页 loading / 空态（MtEmptyState）/ 错误态，去掉裸 console.error；
- 文档落地：README 已重写、本快照已整理；子项目五类文档暂以 docs/superpowers/specs+plans 与 CHANGELOG 承载；
- 候选：部署上线（需 GitHub Secrets）、Designer 可视化编辑器。

## 已知问题

1. 本机 PowerShell 执行策略限制：pnpm/npx 一律用 pnpm.cmd；
2. 网络代理不稳定：沙箱代理与直连两种模式都可能失效，git 推送失败时两种都试；gh CLI 的 GraphQL 轮询（pr checks --watch）常被瞬断，改用 REST 轮询；
3. 本地 .env 在仓库根（从 .env.template 复制，gitignore 忽略），各服务经 @mt/config 的 loadRootEnv 自动加载，无需 export；
4. Docker Desktop 需手动启动（引擎就绪后 compose 正常）；
5. 镜像推送需先在 GitHub 配置 Secrets（REGISTRY_HOST/USERNAME/PASSWORD），未配置时 images job 自动跳过；
6. 智谱 ZHIPU_API_KEY 过期（401）时真实 LLM 功能受影响，本地以桩模式（MT_LLM_STUB）运行，待更新 Key 后恢复；
7. Node20/OpenSSL3 禁用 PKCS1 私钥解密，测试避免依赖私钥解密；
8. 子智能体委托（subagent/subagent_fork）在本环境不可用，多智能体协作需外部 CLI 环境。
