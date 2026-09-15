# 决策记录与交接

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 16. 关键决策记录与已知问题

> 📎 **本节主文档为 [docs/memory/state.md](../../docs/memory/state.md)（AI 即时记忆，每次合入都会追加）。本节是当前版本发布时的**精选快照**，实时性较弱。做新开发前请务必先读 state.md 获取最新状态/进行中任务/新发现的 Bug。**

### 16.1 工程决策（已写入 docs/memory/state.md）

| # | 决策 | 理由 |
|---|---|---|
| 1 | 全栈 TypeScript + 单语言 Monorepo | 降低心智负担、AI 生成代码质量高、包共享便捷 |
| 2 | PostgreSQL 单实例多库（不拆容器） | 个人使用成本最低，outbox 跨库直连无网络开销 |
| 3 | outbox + 轮询（不上 MQ） | 复杂度 0 上线，`SKIP LOCKED` 并发安全，dead 终态防无限重试；量大后可平滑升级 Kafka |
| 4 | 原生 SQL + Zod（不 ORM） | 零黑盒、pgvector/FTS 支持最直接、迁移可控 |
| 5 | LLM 供应商双活（DeepSeek + 智谱） | 一家挂了另一家顶上；统一 client 屏蔽差异 |
| 6 | `parseJson` 四级降级（子项目禁裸 JSON.parse） | LLM 脏输出是常态，集中容错避免 5 处重复修 |
| 7 | 前后台双外壳（UserShell vs AdminShell） | 工具类前台不能长得像后台表格；终端用户体验与管理效率解耦 |
| 8 | Turbo 缓存 + CI 合并重复 build | 32 步 build → 1 步，节省 70%+ 时间 |
| 9 | 四层测试（单元→冒烟→回归→E2E） | 每一层成本/覆盖/反馈速度合理分工；回归层用 turbo --affected 不造轮子 |
| 10 | 0 bug loop（开发 vs 测试分智能体） | 对抗性验收发现隐蔽 Bug；流程纪律仍需加强（目前无落地产物） |
| 11 | 端口唯一来源 infra/ports.yaml | 网关路由、新建子项目、smoke 启动 统一读取；禁止业务代码硬编码端口号 |
| 12 | 部署：单台阿里云 ECS + Docker Compose | 个人使用成本最优；images job 推送 ACR + deploy.ps1 脚本闭环 |

### 16.2 已知问题（docs/memory/state.md 持续更新）

1. **PowerShell 执行策略**：Windows 下 pnpm/npx 必须用 `pnpm.cmd` / `npx.cmd`
2. **网络代理不稳定**：git 推送偶尔失败。**操作要点**：① 必须**同时设置** `http.proxy` **与** `https.proxy`（只配 http 会卡死）；② 完全断网时切换 GitHub API（MCP push_files 分批推送）；③ 本地未装 gh CLI 时，CI check 走 GitHub App pull_request_read(get_check_runs)，日志经 REST 下载。
3. **智谱 API Key 偶发 401**：过期时自动退回 MT_LLM_STUB=1，真实 LLM 功能降级
4. **Node 20 OpenSSL3 PKCS1 限制**：测试避免依赖私钥解密（cybercloud 集成已走 SPKI DER 公钥方案）
5. **子智能体委托不可用**：本地沙箱不支持 subagent_fork，0 bug loop 对抗性验收需外部 CLI 环境
6. **镜像推送需 Secrets**：未配置 REGISTRY_HOST 时 images job 自动跳过（有守卫），首次上线前需手工配置
7. **环境变量加载约定**：本地 `.env` 位于**仓库根**（从 `.env.template` 复制，已 `.gitignore`）；各子项目通过 `@mt/config` 的 `loadRootEnv` 自动向上最多 10 层查找加载，无需手工 export。
8. **Docker 本地说明**：Docker Desktop 引擎需手动启动；本地已验证通过 `pgvector/pgvector:pg16` 容器方案，单实例内含 9 个数据库（8 业务 + mt_test），支持跑全量测试与 smoke，不再是无 DB 环境。
9. **0 bug loop 流程纪律**：开发/测试分拆不同智能体的对抗性验收机制**目前无落地的"测试验收记录"产物**；流程纪律问题非代码可修，需在 Manager 中以任务状态 + PR comment 形式补可追溯证据。

---

## 17. 参考文档索引

> 📎 **本节与 [README.md](../../README.md) §文档导航 有重合，此处为更细粒度的章节级索引（含外部官方文档）。新增主文档时请两侧同步。**

### 仓库内必读文档

| 文档 | 路径 | 适合场景 |
|---|---|---|
| ✅ AI 入口指令（新会话第一读） | [AGENTS.md](../../AGENTS.md) | 每次 AI 协作开发启动 |
| ✅ 即时记忆（当前状态/决策/进行中/已知问题） | [docs/memory/state.md](../../docs/memory/state.md) | 续做任务/了解项目最新进展 |
| 平台顶层设计（MVP 架构 + 子项目边界 + Roadmap） | [docs/superpowers/specs/2026-08-18-magictools-platform-design.md](../../docs/superpowers/specs/2026-08-18-magictools-platform-design.md) | 新人上手 / 架构评审 |
| 各子项目独立设计文档（共 10 份） | [docs/superpowers/specs/*.md](../../docs/superpowers/specs/) | 进入具体子项目开发前 |
| 对应实施计划（共 10 份） | [docs/superpowers/plans/*.md](../../docs/superpowers/plans/) | 开发任务拆解参考 |
| 平台级迭代日志（里程碑级） | [docs/CHANGELOG.md](../../docs/CHANGELOG.md) | 版本演进 / 回溯决策 |
| UI 规范（设计令牌 + 双外壳 + 8 主题表） | [docs/ui-spec.md](../../docs/ui-spec.md) | 前端开发必读 |
| Git 工作流 + 分支管理 + 仓库配置 | [docs/git-workflow.md](../../docs/git-workflow.md) | 新建分支 / 配置 GitHub / PR 前 |
| 端口注册表（唯一来源） | [infra/ports.yaml](../../infra/ports.yaml) | 启动服务 / 排查连接问题 |
| 外部集成手册（三份） | [docs/integrations/](../../docs/integrations/) | 配置飞书 / ClawCV / cybercloud |
| Changesets 变更历史（包版本级） | [.changeset/](../../.changeset/) | 查某次改动具体内容 |
| 精简版项目说明（对外展示） | [README.md](../../README.md) | 新人快速了解 |

### 外部官方文档

| 组件 | 文档链接 |
|---|---|
| NestJS 10 | https://docs.nestjs.com/ |
| React 18 | https://react.dev/ |
| Ant Design 5 | https://ant.design/docs/react/introduce-cn |
| Vite 5 | https://vitejs.dev/ |
| Turborepo 2 | https://turbo.build/repo/docs |
| Vitest 2 | https://vitest.dev/ |
| Playwright | https://playwright.dev/ |
| PostgreSQL 16 + pgvector | https://www.postgresql.org/docs/16/ + https://github.com/pgvector/pgvector |
| pnpm workspace | https://pnpm.io/workspaces |
| OpenAI Chat Completions（@mt/model-client 协议） | https://platform.openai.com/docs/api-reference/chat |

---

> 📌 本 Code Wiki 为活文档，随代码迭代同步更新。每次合入 main 时，如文档涉及范围有变动（新增公共包/接口/配置项/子项目），请在 PR 中同步修改本文件对应章节，由 review 环节把关一致性。

## 备份恢复与应用交接

恢复应用交接由`backup-handoff.mjs`生成deployment-config/2，`recovery-database.mjs`检查实际PG/容器/卷/网络并原子领取claim，`recovery-attachment.mjs`在部署锁下保存reserved→initial-verified。`recovery-connections.mjs`绑定八主库和三上游（P19 后 Assistant 检索走 Gateway HTTP，不再恢复 Scholar 直连），部署器仅管理17应用，业务网内部隔离，网关独占受控ingress。`recovery-receipt.mjs`负责SSH回读的DB/claim/首次证明/11连接核对；v1的序列化和快照回退保持兼容。实际操作与阶段验收分别见[恢复应用](features/restored-deployment.md)和[验证记录](validation/2026-09-12-restored-deployment.md)。

`backup:create`、`backup:verify`、`backup:restore`由infra/scripts/backup.mjs调度，backup-local.mjs组织源检查、物理备份/原生验证、加密和独立恢复；backup-docker.mjs管理专属资源及进程退出。backup-source.mjs/backup-config-files.mjs同时检查运行与启动生效的配置依赖，backup-crypto.mjs负责文件认证和清单HMAC，backup-metrics.mjs使用微秒计算本机恢复区间。实现与边界见 [备份说明](features/backup-recovery.md) 和 [核心验收](validation/2026-09-12-backup-core.md)。

`backup-store.mjs`统一目录标识、私有文件隔离和锁归属；`backup-retention.mjs`默认保留15份，并在删除前验证全部候选密文，自动创建固定保护本次制品。`backup-alerts.mjs`提供持久失败事件、受限HTTP投递和独立投递回执；CLI前置失败也进入事件路径。`backup-ssh.mjs`上传公开脚本并检查指纹，`backup-export.mjs`/`backup-transfer.mjs`持源锁导出、下载到隔离store、原生恢复验证后发布副本；已验证副本与任务清理失败分别记录。

`backup.ps1`/`restore.ps1`已替换旧单库dump流程，通过静态backup-powershell.mjs以Base64数据传递参数并保留PowerShell文本流；systemd样例与漏跑排查见[定时备份说明](features/backup-scheduling.md)，不自动启用生产任务。本机保留、HTTP告警和同机SSH传输已实测与独立复核；恢复部署正式入口validate-recovery-deployment.mjs完成11项实机及清理，独立18项回读通过，CI以显式config-change复用当前验证制品，完整记录见[恢复验收](validation/2026-09-12-restored-deployment.md)。回执不能代表物理异地或生产保障。P03/P05已合并，main发布run34651552771的17镜像来源、固定digest及推拉日志已独立核验，生产环境部署未验证。
