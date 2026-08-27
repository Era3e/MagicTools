# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目设计文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。
> 本文件定位「当前状态快照」，历史细节见 docs/CHANGELOG.md 与 docs/superpowers/specs/、plans/。

## 当前状态快照（2026-08-25）

- **交付状态**：8 子项目全部交付。需求主线三环（Investigator → Assessor → Manager）、知识主线（Gatherer → Scholar → Assistant）、Designer（降级版）均完成；Assistant 意图路由扩至 6 类并完成 cybercloud 真实对接（testcybercloud-dev 实测打通）。
- **工程化基座**：Monorepo（pnpm + turbo）+ 网关 + outbox + 幂等 + CI/CD + Docker 部署链路；main 分支保护（required checks: quality/smoke/e2e）。
- **本轮改造（2026-08-22，PR #26，已合并 main 8c4c045）**：
  - 前端统一外壳 `@mt/ui` 的 `AppShell`（侧边导航 + 顶栏 + 跨应用切换），8 子项目全部接入，替换原先 3 处重复的深色 Menu 外壳与 5 处裸 Card；
  - 前端交互补全：9 页 loading/空态/错误态，合并 applicant 冗余 api 层，ChatPage 自动滚动，清理硬编码色值，修复简历改写误作用首份简历与 gatherer/scholar e2e 文案撞车；
  - 测试可信度：接入 ESLint（typescript-eslint + react-hooks）、覆盖率门槛（`@vitest/coverage-v8`，5 个 DB 无关公共包 70/70/70/50）、统一 scholar e2e skip 守卫；
  - 后端健壮性：`@mt/model-client` 新增健壮 `parseJson`（容错无引号键/代码围栏/夹杂文字），5 服务替换裸 `JSON.parse`；`@mt/db` outbox 失败达上限进入 dead 终态；
  - 工程化：CI 合并重复 build 步骤并缓存 turbo 构建（`.turbo`）；新增 `pnpm test:affected`（`turbo run test --affected`）补齐「回归层」；
  - 文档：README 重写、memory 去重、AGENTS.md 对齐。
- **网关首页导航（2026-08-25，PR #27，已合并 main 5e65a36）**：根路径新增 landingPage()，8 应用卡片（名称+简介），替代裸反代的 Cannot GET /。
- **前后台双外壳打样（2026-08-25，PR #28，已合并 main d12386d）**：`@mt/ui` 新增 UserShell（前台，杂志风默认主题 MAGAZINE_THEME，主题可按应用定制）与 AdminShell（后台，统一控制台风 ADMIN_TOKENS）；applicant 前台改杂志风岗位墙 PositionWall，表格管理挪至 /admin/positions；e2e 补前后台路由拆分覆盖；ui-spec 增补双外壳规范。方向已确认：前台各异、后台统一。
- **双外壳铺开（2026-08-25，PR #29，已合并 main 668c8e9）**：其余 7 应用全部接入双外壳（主题见 ui-spec 对照表）；管理页统一 /admin/* 路由，旧路径 redirect 兼容；gatherer/investigator/assessor 无前台形态默认直跳后台；UserShell 新增 footerNote；8 应用信息架构「前台各异、后台统一」全部落地。
- **前台内容页深度设计（2026-08-25，PR #30，已合并 main ee8239d）**：scholar 书目检索（图书馆目录卡片）、assistant ChatPage（极简双栏气泡）、manager 前台需求台（FLIGHT DECK 七泳道看板）、designer 定制生成（画廊委托单+展品展位）；四页主题化深度设计落地。
- **剩余前台页主题化收官（2026-08-25，PR #31，已合并 main 7f25a9e）**：scholar EntryList 馆藏目录（书卷列表+书签式圈定）/GraphPage 类目卡片墙、manager RequirementDetail 飞行日志、applicant PositionDetail 特稿版式/InterviewPage 对开复盘/ResumeCenter 工坊。**8 应用前台主题化全部完成**。
- **操作闭环补齐 D1/D3（2026-08-25，分支 fix-d1-d3-push-editing）**：
  - D1 推送去向可见：gatherer ItemList 推送成功提示至 Scholar 收件箱（knowledge.item.collected）并说明拉取步骤；investigator SurveyDetail 推送成功提示至 Assessor 收件箱（researcher.response.push）并说明拉取步骤；assessor RequestDetail 推送 Manager 文案补收件箱（requirement.created）与拉取步骤；
  - D3 编辑入口补齐：gatherer SourceList 新增「编辑」列与 Modal（PATCH /sources/:id）；investigator SurveyList 新增「编辑」列，SurveyForm 扩展 initialValues/title 支持编辑模式；scholar EntryList 馆藏条目右侧新增「编辑」按钮与 Modal，覆盖 title/summary/content/category/tags 五项（PATCH /entries/:id 前端字段扩展）；
  - 本地构建 lint + 四应用单测全部通过（scholar 9/9、gatherer 3/3、investigator 3/3、assessor 3/3）；changeset 已加 fix-d1-d3-push-to-edit.md。
- **质量三角闭环（2026-08-25，分支 qa-triangle-closure）**：
  - **低阶 Bug 防御线**：E2E 新增 4 类副作用断言（URL 跳转 / Modal 开 / 列表增改 / 接口请求拦截 URL+method）+ 16 页视觉快照基线 `_visual.spec.ts`（Playwright toHaveScreenshot，阈值 0.02）；package.json 新 `pnpm e2e:visual:update` / `pnpm e2e:visual` 脚本；PR 模板新增 UI Checklist + 0 bug loop 智能体验收记录两段；
  - **功能缺口可追溯**：新增 `docs/superpowers/coverage-matrix.md`（规格-代码-测试三维映射，跨 8 子项目）与 `docs/memory/mvp-deferred.md`（明确写 MVP 有意推迟项、原因、重启触发条件）——区分「未实现」vs「不做」；
  - **UI 规范工程化**：`@mt/ui` 新增三种页面模式（MagazineList/ControlTable/DetailHero）+ `ThemeContext` 与 `useTheme` 钩子；`infra/eslint/rules/no-hardcoded-colors.mjs` 自定义 ESLint 规则生效——禁止业务页硬编码色值（仅豁免 tokens.ts、应用顶层 *_THEME、AdminShell/UserShell 专用键）；5 子项目共 11 个前台页（manager RequirementBoard/Detail、scholar EntryList/SearchPage/GraphPage、applicant PositionWall/PositionDetail/InterviewPage/ResumeCenter、assistant ChatPage、designer GeneratePage）全部迁移 `useTheme()` 取色；applicant 新增 `APPLICANT_THEME` 显式传入 UserShell，assistant/designer 扩展主题键；
  - 本地验证：`pnpm lint` 0 err（仅 2 any warning）、`pnpm test:affected` 24/24 任务通过、MtEmptyState 扩展 description 兼容 patterns 类型。

## 关键决策

- 全栈 TypeScript（React+NestJS+PostgreSQL+pgvector），pnpm Monorepo + Turborepo；
- 8 子项目 + gateway，端口唯一来源 infra/ports.yaml；
- LLM 统一入口 @mt/model-client（DeepSeek + 智谱，OpenAI 兼容协议）；
- 数据交互：网关 + 同步 REST + outbox + 幂等键；
- 数据库 ORM 选型：原生 SQL + Zod 校验（不引入 TypeORM/Prisma），兼顾 pgvector 向量操作、全文检索 FTS 支持最直接，零黑盒、迁移可控；
- 部署：单台阿里云 ECS + Docker Compose；
- 分支绑任务不绑对话，四层清理机制；
- LLM 解析统一走 `@mt/model-client` 的 `parseJson`（逐级降级容错），禁止服务内裸 `JSON.parse`；
- outbox 失败达 `maxAttempts` 进入 `dead` 终态（status 为无约束文本列，无需迁移）；
- 四层测试的「回归层」由 `turbo run test --affected` 实现，不另造轮子；
- CI 用 `actions/cache` 缓存 `.turbo`，smoke/e2e 的 16 条 build 合并为 `pnpm build`。
- 前端信息架构走「前后台双外壳」：用户前台每应用独立审美主题（UserShell + UserShellTheme，默认杂志风），配置后台全平台统一控制台风（AdminShell）；路由以 `/admin` 前缀划分，前后台经页脚/侧栏互跳；AppShell 保留为单一形态应用的过渡外壳。
- 前台色值取用统一走 `ThemeContext` + `useTheme()`：应用主题仅在各自 `App.tsx` 顶层 `*_THEME` 常量中定义（含扩展键），`@mt/ui tokens.ts` 为状态/语义色唯一来源；业务页禁止硬编码色值，由 `@mt/rules/no-hardcoded-colors` ESLint 工程化门禁保障。
- 质量治理三角机制（长期有效）：
  1) E2E 「副作用断言 + 视觉快照」双保险，捕获样式/交互退化；
  2) coverage-matrix + mvp-deferred 文档体系，消除「功能缺失」歧义；
  3) 可复用 UI 模式 + 主题上下文 + ESLint 硬编码拦截，确保 ui-spec 落地不退化。

## 关键事件契约

1. `researcher.response.push`（investigator → assessor）
2. `requirement.created`（assessor → manager，payload 含 analysisMd/designMd/repoUrl/reviewComment）
3. `knowledge.item.collected`（gatherer → scholar，payload 含 itemId/url/title/content/summary/category/keywords/publishedAt）

## 进行中任务

- 已完成（PR #31，7f25a9e）：剩余六前台页主题化（scholar 馆藏目录/图谱、manager 飞行日志、applicant 特稿/对开/工坊），前端主题化工程全部收官（双外壳 + 8 应用前台深度设计）；
- 进行中（分支 qa-triangle-closure）：质量三角机制落地（E2E 副作用断言+视觉快照、可追溯文档、UI 规范工程化），已通过 lint+单测，待 e2e 基线更新与 PR；
- 候选：部署上线（需 GitHub Secrets）、Designer 可视化编辑器、智谱 Key 更新。

## 已知问题

1. 本机 PowerShell 执行策略限制：pnpm/npx 一律用 pnpm.cmd；
2. 网络代理不稳定：沙箱代理与直连两种模式都可能失效，git 推送失败时两种都试；git 需同时配置 http.proxy 与 https.proxy（只配 http 会卡死推送）；本地网络完全中断时改走 GitHub API（MCP push_files）分批推送，内容以本地 git 提交为准；gh CLI 未安装，CI 状态查 GitHub App 的 pull_request_read(get_check_runs)，Actions 日志经 REST API 下载；
3. 本地 .env 在仓库根（从 .env.template 复制，gitignore 忽略），各服务经 @mt/config 的 loadRootEnv 自动加载，无需 export；
4. Docker Desktop 需手动启动（引擎就绪后 compose 正常）；本地已有 pgvector/pgvector:pg16 容器（9 库：8 业务 + mt_test），本地可跑全量测试与 smoke，不再是无 DB 环境；
5. 镜像推送需先在 GitHub 配置 Secrets（REGISTRY_HOST/USERNAME/PASSWORD），未配置时 images job 自动跳过；
6. 智谱 ZHIPU_API_KEY 过期（401）时真实 LLM 功能受影响，本地以桩模式（MT_LLM_STUB）运行，待更新 Key 后恢复；
7. Node20/OpenSSL3 禁用 PKCS1 私钥解密，测试避免依赖私钥解密；
8. 子智能体委托（subagent/subagent_fork）在本环境不可用，多智能体协作需外部 CLI 环境；
9. 「0 bug loop」机制在 PR 模板里已植入「独立测试智能体验收记录」表格字段，合入前由测试智能体填写，实现流程纪律落地（不再是纯口头约定）。
