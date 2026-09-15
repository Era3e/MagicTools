# 工程化与运行

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 11. 工程化与 CI/CD

> 📎 **§11.1 脚本命令表与 [AGENTS.md](../../AGENTS.md) §常用命令、README.md 有重合。脚本新增/改名请优先改 package.json + AGENTS.md。§11.4 CI 流水线章节为主原创内容。**

### 11.1 根 package.json 脚本

| 命令 | 实际执行 | 说明 |
|---|---|---|
| `pnpm build` | `turbo run build` | 全 Monorepo 构建（^build 拓扑依赖，先公共包后子项目），输出 dist/ |
| `pnpm test` | `turbo run test` | 全量 Vitest 运行（dependsOn build） |
| `pnpm test:affected` | `turbo run test --affected` | ⭐ 回归层：只跑变更影响的包 |
| `pnpm coverage` | `turbo run coverage` | Vitest 覆盖率，输出 coverage/（公共包门槛 70/70/70/50） |
| `pnpm lint` | `eslint .` | 全局 ESLint（typescript-eslint + react-hooks 规则集） |
| `pnpm test:infra` | `node infra/scripts/test-infra.mjs` | Node 原生测试 infra 脚本 |
| `pnpm smoke [--only <服务>]` | `node infra/scripts/smoke.mjs` | 冒烟：读取 ports.yaml 探活所有服务健康检查 |
| `pnpm images:smoke` | images-smoke.mjs | 17镜像构建与独立容器全流程回归 |
| `pnpm images:build` / `images:publish` / `images:release` | 制品构建及仓库digest核验 | 干净提交发布，验证工作树须明确标记 |
| `pnpm qa:gate` | quality-gate.mjs：lint + build/unit + coverage + infra + docs + design + test:db | ✅ 本地与 CI 共用；生成候选/checkout/run 绑定的阶段证据 |
| `pnpm test:db` | test-database.mjs：按声明清单初始化隔离库并直接运行关键 Vitest 文件 | ✅ 真实 PostgreSQL/pgvector、skip=0、无缓存；成功清理本次库，失败保留诊断 |
| `pnpm new:app <name>` | `node infra/scripts/new-app.mjs` | 复制模板 + 分配端口 + 写 ports.yaml |
| `pnpm ws:create <项目> <任务ID>` / `ws:cleanup` | `workspace.mjs` | Git worktree 管理 |
| `pnpm changeset` / `release` | changesets CLI | 迭代日志 / 版本号自动生成 |

### 11.2 Turbo 管道（turbo.json）

```json
{
  "build":    { "dependsOn": ["^build"], "outputs": ["dist/**"] },
  "test":     { "dependsOn": ["build"] },
  "coverage": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
  "lint":     { "dependsOn": ["^build"] },
  "dev":      { "cache": false, "persistent": true }
}
```

- ^build = 先构建上游 workspace 依赖包（config/types/db/ui/model-client/utils）
- CI 用 actions/cache 缓存 `.turbo` 目录中的构建和普通单测结果。数据库测试从普通配置移出并直接强制运行，不复用缓存；桩模式开关进入普通单测环境/hash。配置、文件标记、清单、失败策略和候选证据见 [质量门禁说明](features/quality-evidence.md)。

### 11.3 四层测试体系

| 层 | 工具 | 范围 | 命令 | CI Job |
|---|---|---|---|---|
| 1 单元 | Vitest | 公共包核心逻辑 + Service 单测 | `pnpm test` | quality |
| 2 冒烟 | Docker Compose + HTTP/SQL | 17镜像冷启动、数据库恢复、业务与持久化 | `pnpm images:smoke`（本地源码探活仍可用 `pnpm smoke`） | smoke |
| 3 回归 | Turbo --affected | 仅构建变更影响的包 + 跑对应测试 | `pnpm test:affected` | 本地（CI 全量） |
| 4 E2E | Playwright chromium | 17 个 spec 全流程真实交互；视觉基线 20 张，样板页带核心业务断言 | `@mt/e2e playwright test` | e2e |

### 11.4 CI流水线（.github/workflows/ci.yml）

quality、smoke、e2e保留原required check名称。三个检查全部通过后，main的images任务才发布制品。

```mermaid
flowchart LR
    Trigger[PR或main/dev推送] --> Quality[quality: 完整qa:gate]
    Quality --> Smoke[smoke: 构建17镜像并实际冷启动]
    Smoke --> E2E[e2e: 浏览器交互与视觉回归]
    E2E --> Registry{main且仓库已配置}
    Registry -->|是| Images[images: SHA构建与digest推送回读]
    Registry -->|否| Unpublished[记录未发布]
    Images --> Artifact[release.json及运行配置制品]
```

#### quality

使用真实pgvector测试服务，执行 `pnpm qa:gate`，包含lint、构建/单测、覆盖率、infra、文档、设计映射和关键数据库验证。成功与失败均保存候选提交/checkout/run绑定的quality-evidence。

#### smoke

执行 `pnpm images:smoke`。从实际checkout构建17个独立镜像，在单独Compose项目及数据库卷中启动18容器，检查应用身份、迁移、Web、业务读写、预览编译、数据库断连恢复与容器重建持久化。此任务不使用宿主源码服务代替镜像，结束后清理本轮资源。runtime-evidence包含构建及运行回执，失败也保留。

#### e2e

使用自己的PostgreSQL服务，构建并启动17个源码进程。安装Chromium与CJK字体，先运行视觉回归：套件会通过公开 API 幂等初始化 Manager 详情、Assistant 长对话与 Scholar 帮助目录样板，并在截图前断言核心业务文案；随后运行其余交互测试。外部模型与集成采用明确桩模式，真实模型效果另行评测。

#### images

仅main且配置REGISTRY_HOST时执行 `pnpm images:release --registry <host>/magictools`。使用干净源码SHA构建并验收同一批镜像，逐一推送17镜像并从registry按digest拉回核验，保存release清单与运行配置文件校验和。失败回执也上传；未配置仓库时明确记录未发布。

### 11.5 运行镜像与发布边界

应用镜像的Node运行时为固定digest的Node 22，开发/quality仍覆盖Node 20。生产目录通过pnpm deploy装配，Node服务以UID1000运行；业务镜像包含迁移，Gateway/Assistant带ports.yaml，Designer带动态预览依赖。

业务health为存活，health/ready检查数据库与迁移；Gateway的/ready聚合八个后端和八个Web。迁移成功后才监听，运行中断连返回503并可恢复。制品与回执入口见 [运行镜像说明](features/runtime-images.md)，本地独立验证见 [P03验收](validation/2026-09-12-runtime-images.md)。P05部署入口为deploy-release.mjs/deploy-ssh.mjs，核验固定制品、公开配置与就绪，成功回执先于状态提交并全程持锁；原env不覆盖，快照用于失败恢复与正常回退。详见 [部署说明](features/deployment-receipts.md)，cc03f42→5355139两版实际升级、故障恢复与回退已通过，独立验收确认八库数据、env及PG实例保持；该验收绑定上述两份源码，后续收尾候选另由CI验证。

---

## 12. Git 工作流与分支管理

> 📎 **本节主文档为 [docs/git-workflow.md](../../docs/git-workflow.md) + [AGENTS.md](../../AGENTS.md) 分支/收尾部分。本节为速查摘要版：分支模型、worktree、四层清理、收尾协议。若涉及 worktree 脚本、分支命名规则、仓库保护配置变更，请先修改对应主文档。**
>
> 🔴 **硬性纪律（AGENTS.md 硬约 #1）**：TDD 先行 — 先写**失败的**测试用例再补实现代码；禁止在最终源码中留 TODO/TBD 占位符（可写分支说明，禁止合入 main）。

### 12.1 分支模型

```
main（生产，受保护：PR + quality/smoke/e2e 三检查必须通过；合并触发：images 打镜像 + changesets 版本发布）
  ↑
dev（集成，同 main 保护配置）— PR 合并目标
  ↑
feat-<project>-<taskId>-<desc>（开发分支：绑任务不绑对话，多会话可复用）
```

### 12.2 并行开发：Git Worktree

一个任务一个 worktree，主仓库保持干净：

```bash
pnpm ws:create applicant 20260827-resume-rewrite-fix
# → 新建分支 feat-applicant-20260827-resume-rewrite-fix
# → 在 ../worktrees/applicant-20260827-resume-rewrite-fix/ 下 checkout
# → 可独立 pnpm install / dev / test

pnpm ws:cleanup applicant 20260827-resume-rewrite-fix
# → 删除 worktree + 本地分支（PR 合并后远程分支已被 GitHub 自动删除）
```

### 12.3 四层分支清理

1. **GitHub 自动**：设置 → Automatically delete head branches（PR 合并删远程）
2. **CI 定时**：branch-gc.yml（每周比对 open PR + Manager 任务状态，清理孤儿分支）
3. **会话收尾**：每个开发任务完成后执行 ws:cleanup
4. **任务联动**：分支名携带任务 ID，Manager 任务关闭时联动检查

### 12.4 会话收尾协议（AGENTS.md 强制）

```
✅ 代码已提交（pnpm qa:gate 全绿）
✅ 已推送并创建 PR
✅ PR 合并 → worktree 已清理
✅ docs/memory/state.md 即时追加
✅ pnpm changeset 添加变更日志
```

### 12.5 Conventional Commits 中文规范

```
动词开头，中文 subject，≤ 50 字
feat: 新增 applicant 简历改写对接 ClawCV
fix: 修复 outbox dead 终态未入库导致的永久重试
docs: 更新前后台双外壳主题对照表
test: 补齐 assistant 6 意图 E2E 覆盖
chore: 升级 turbo 至 2.1
```

---

## 13. 环境与配置

### 13.1 .env.template（22 项配置，.env 放仓库根，.gitignore 忽略）

| 变量 | 用途 | 子项目 |
|---|---|---|
| GATEWAY_TOKEN | 网关 X-Access-Token 鉴权（留空不鉴权） | gateway |
| DEEPSEEK_API_KEY | DeepSeek LLM 密钥 | 全部 LLM 服务 |
| ZHIPU_API_KEY | 智谱 LLM 密钥（过期→桩模式） | 全部 LLM 服务 |
| DATABASE_URL | 单项目本地默认库 | 各子项目 server 启动时覆盖 |
| FEISHU_APP_ID / APP_SECRET / BOT_WEBHOOK / BOT_SECRET | 飞书开放平台 | investigator |
| CLAWCV_API_KEY + BACKEND_URL | 超级简历 API | applicant |
| CYBERCLOUD_BASE_URL / API_KEY / AGENT_ID / USERNAME / PASSWORD / JWT | cybercloud 智能体平台 | assistant |
| MT_LLM_STUB / FEISHU_STUB / GITHUB_STUB / CYBERCLOUD_STUB / FEED_STUB / ACTION_STUB | **桩模式开关（CI 用，=1 跳过真实外部调用）** | CI/smoke/e2e |
| MT_PROD | 生产网关 host 解析（=1 时用 Docker Compose 服务名） | gateway |
| <NAME>_DATABASE_URL | 跨库直连上游 outbox（INVESTIGATOR_/ASSESSOR_/GATHERER_）；Assistant→Scholar 检索走 Gateway HTTP | assessor/manager/scholar |

### 13.2 数据库连接约定（本地单实例多库）

```bash
# 本地默认（docker-compose.dev.yml 启动 postgres 5432）
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/<dbname>
# 每个子项目启动时覆盖：applicant 用 applicant 库，scholar 用 scholar 库...
# 跨库消费额外配置：如 assessor 需要连接 investigator 的 outbox
INVESTIGATOR_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/investigator
```

---

## 14. 项目运行方式

> 📎 **本节为 [README.md](../../README.md) §快速开始的扩展完整版：包含 worktree 模式、全栈联调步骤、E2E 运行、new:app 新建子项目等细分命令。通用命令变更请同步 README.md。**

### 14.1 前置条件

| 依赖 | 版本 | 验证命令 |
|---|---|---|
| Node.js | >= 20（LTS） | `node -v` |
| pnpm | 9.12.0（packageManager 指定） | `pnpm -v` |
| Docker Desktop | 任意支持 compose 的版本 | `docker --version` + `docker compose version` |
| PostgreSQL 客户端 | （可选，调试用） | `psql --version` |

> ⚠️ **Windows PowerShell 限制**：pnpm 命令一律用 `pnpm.cmd`（否则被 ExecutionPolicy 拦住）。本 Wiki 示例用 pnpm，Windows 下替换。

### 14.2 本地从零开始

```bash
# 1. 克隆仓库
git clone <MagicTools repo>
cd MagicTools

# 2. 安装依赖
pnpm install          # Windows: pnpm.cmd install

# 3. 复制环境变量（从模板，LLM Key 按需填真实值或留空用桩）
copy .env.template .env
# 编辑 .env：本地 DATABASE_URL 默认 postgres://postgres:postgres@127.0.0.1:5432/<各子项目自己的名>

# 4. 启动 PostgreSQL（pgvector 扩展）
docker compose -f infra/docker-compose.dev.yml up -d
# 5432 端口暴露，自动挂载持久卷 pgdata
# 如需自动建库，执行 infra/postgres-init.sql（内含 9 CREATE DATABASE）

# 5. 跑一次全量构建 + 测试（验证环境）
pnpm build
pnpm test      # 桩模式无需真实 LLM Key（MT_LLM_STUB=1）

# 6. 跑质量门禁（合入前必过）
pnpm qa:gate
```

### 14.3 单项目开发（推荐用 worktree）

```bash
# 方法 A：worktree 隔离
pnpm ws:create scholar 20260827-graph-ui-fix
cd ../worktrees/scholar-20260827-graph-ui-fix
pnpm install    # worktree 需要首次装依赖

# 前端：Vite HMR 热更新
pnpm --filter @mt/scholar-web dev
# → http://127.0.0.1:4006/scholar/ （Vite 严格端口，与 ports.yaml 一致）

# 后端：tsx watch 热重载
pnpm --filter @mt/scholar-server dev
# → NestJS 监听 5006，全局前缀 /api/scholar

# 方法 B：主仓库单子项目
pnpm --filter @mt/applicant-web dev
pnpm --filter @mt/applicant-server dev
```

### 14.4 全栈联调（所有服务 + gateway）

```bash
# 1. 先 build 所有包
pnpm build

# 2. 逐个启动（Windows 用多个 PowerShell 窗口）：
# gateway
node apps/gateway/dist/index.js &

# applicant
PORT=5008 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/applicant MT_LLM_STUB=1 node apps/applicant/server/dist/main.js &
(cd apps/applicant/web && node node_modules/vite/bin/vite.js preview --port 4008 --strictPort) &
# （其余 7 服务参照 .github/workflows/ci.yml smoke job 的完整启动命令）

# 3. 冒烟检查
pnpm.cmd smoke
# → PASS applicant-server (200ms) / applicant-web / ... 共 17 项

# 4. 访问
open http://127.0.0.1:3000/       # 网关首页（8 应用卡片导航）
open http://127.0.0.1:3000/scholar/  # 直接访问某子项目
```

### 14.5 E2E 测试

```bash
pnpm install
pnpm build
pnpm --filter @mt/e2e exec playwright install chromium   # 首次装浏览器
# 启动全服务（见 14.4 步骤 2）
pnpm --filter @mt/e2e exec playwright test
```

### 14.6 新建子项目（pnpm new:app）

```bash
pnpm new:app translator
# 效果：
# 1. 复制 infra/templates/server + web → apps/translator/{server,web}
# 2. ports-lib allocPorts 分配下一组空闲端口 web 4009 / server 5009（预注册的 8 个已占用）
# 3. 写入 infra/ports.yaml → translator: { web: 4009, server: 5009 }
# 4. 提示接下来：重命名包名、补 AppModule controllers、写迁移、加路由
```

---
