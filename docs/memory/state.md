# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目设计文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。
> 本文件定位「当前状态快照」，历史细节见 docs/CHANGELOG.md 与 docs/superpowers/specs/、plans/。

## 当前状态快照（2026-08-28）

- **交付状态**：8 子项目全部交付。需求主线三环（Investigator → Assessor → Manager）、知识主线（Gatherer → Scholar → Assistant）、Designer（降级版）均完成；Assistant 意图路由扩至 6 类并完成 cybercloud 真实对接（testcybercloud-dev 实测打通）。
- **工程化基座**：Monorepo（pnpm + turbo）+ 网关 + outbox + 幂等 + CI/CD + Docker 部署链路；main 分支保护（required checks: quality/smoke/e2e）。
- **本轮改造（2026-08-28，分支 feat-investigator-cron-d11-d16-d17）**：
  - **D-07 P0 兑现**：Investigator 增加 node-cron 定时调度——migrations 003 给 surveys 加 cron 列、package.json 加 node-cron + @types/node-cron、scheduler.ts（参考 gatherer 模式，cron 校验 + 注册 active 调研自动 sync + 状态查询）、main.ts listen 后 startScheduler(app.get(SurveyService))、SurveyService.create/update 校验 cron 合法性、controller 新增 GET meta/scheduler-status API、scheduler.test.ts 3 用例；本地 lint 0 err + test 10/19 pass/skip；
  - **D-11 P0 兑现**：CI quality job 开头新增条件 step（仅 PR 事件触发）检查 0 bug loop 验收记录复选框是否勾选——未勾选则阻断 CI 并提示；PR 模板原已含复选框，此次补自动检测形成闭环；
  - **D-16 P2 兑现**：Designer 前台 USER_NAV 加「组件馆藏」入口 + Route 从 Navigate 改为直接渲染 ComponentList；tsc --noEmit 通过；
  - **D-17 P2 确认已修复**：Assistant ADMIN_NAV 已有「意图日志」菜单（/admin/intent-logs + IntentLogPage 路由存在），2026-08-27 显式 skip 后代码已补齐，无需额外改动；
  - 本地验证：pnpm lint 0 err（2 any warning 遗留）、pnpm test:affected 10/10 成功。

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
- **质量三角闭环（2026-08-25→2026-08-27，PR #35，已合并 main acae500）**：
  - **低阶 Bug 防御线**：E2E 新增 4 类副作用断言（URL 跳转 / Modal 开 / 列表增改 / 接口请求拦截 URL+method）+ 16 页视觉快照基线 `_visual.spec.ts`（Playwright toHaveScreenshot，阈值 0.02）；package.json 新 `pnpm e2e:visual:update` / `pnpm e2e:visual` 脚本；PR 模板新增 UI Checklist + 0 bug loop 智能体验收记录两段；
    - 2026-08-27 基线更新：`infra/scripts/start-services.mjs` 修复 Windows 下「父脚本 process.exit 连带杀死 shell:true 子进程」的根因（移除强制 exit，shell 仅用于 .cmd/.bat），全量重启服务 17 进程、smoke 17/17 PASS，执行 `pnpm e2e:visual:update` → 16/16 视觉快照全部生成写入 `e2e/snapshots/`，随后 `pnpm e2e:visual` 验证 16/16 PASS；
  - **功能缺口可追溯**：新增 `docs/superpowers/coverage-matrix.md`（规格-代码-测试三维映射，跨 8 子项目）与 `docs/memory/mvp-deferred.md`（明确写 MVP 有意推迟项、原因、重启触发条件）——区分「未实现」vs「不做」；
  - **UI 规范工程化**：`@mt/ui` 新增三种页面模式（MagazineList/ControlTable/DetailHero）+ `ThemeContext` 与 `useTheme` 钩子；`infra/eslint/rules/no-hardcoded-colors.mjs` 自定义 ESLint 规则生效——禁止业务页硬编码色值（仅豁免 tokens.ts、应用顶层 *_THEME、AdminShell/UserShell 专用键）；5 子项目共 11 个前台页（manager RequirementBoard/Detail、scholar EntryList/SearchPage/GraphPage、applicant PositionWall/PositionDetail/InterviewPage/ResumeCenter、assistant ChatPage、designer GeneratePage）全部迁移 `useTheme()` 取色；applicant 新增 `APPLICANT_THEME` 显式传入 UserShell，assistant/designer 扩展主题键；
  - 本地验证：`pnpm lint` 0 err（仅 2 any warning）、`pnpm test:affected` 24/24 任务通过、MtEmptyState 扩展 description 兼容 patterns 类型、scholar API 经 gw POST 201（修复根 .env 全局 DATABASE_URL 覆盖导致的服务错连库问题）。
- **P1 全量 e2e 清零（2026-08-27，PR #35）**：三轮迭代从 38/53 → 41/53 → 45/53 → 51 passed / 2 skipped / 0 failed（10 workers 并发）。根因与修法（全部按「先取证再修」流程）：
  - **A 桩环境缺失（8 条 API 链路）**：本地 start-services.mjs 未带 CI 同款桩开关，gatherer 真拉 RSS（404/500）、investigator 真调飞书（502，下游 assessor×3/manager 三环 resps[0] undefined 全是连锁）、assistant data_query 返回「未配置」。修法：SERVER_ENV 按 ci.yml:86-98 对齐（FEED_STUB/FEISHU_STUB/GITHUB_STUB/CYBERCLOUD_STUB/ACTION_STUB/CLARIFY_STUB_CONFIDENCE + MT_LLM_STUB），spawn 显式注入 env。验证：gatherer test 201/collect new=2、investigator sync fetched=2、assistant 桩回复含 12345；
  - **B 测试缺陷（12 处）**：① strict mode 双命中（manager 看板「交付驾驶舱」h1+span、applicant Modal 标题+label）→ 收敛为 heading 角色/精确文案；② assistant 输入框 disabled 竞态（会话列表加载中回车被吞）→ toBeEnabled 前置等待；③ 气泡计数 selector 匹配不到纯内联样式 div → 改断言唯一 marker 文本渲染；④ designer 按钮名「生 成」带字间空格 → 正则 \s*；⑤ manager/assessor 后台列表链接实际指向前台详情 → 修正 URL 期望；⑥ manager 第 3 步在前台详情页找迭代菜单 → 先回后台；⑦ assessor 列表展示 surveyName 非 title；⑧ gatherer items 真实路由是 /sources/:id/items（/admin/* 会重定向）+ 推送需先勾选行 + 按钮文案「推送选中（N）」；⑨ investigator 详情标题「调研 · 名」+ 推送需勾选；⑩ assistant-routing logBody[0] 被并发插队 → 按 sessionId 查找；
  - **C 视觉快照稳定性（5 条）**：fullPage 画布高度=页面高度，动态列表行数随并发写库而变 → 画布尺寸不同必失败；计数文本（在册 N 卷/TOTAL N）在 mask 外。修法：改视口截图（1440x900 与页高解耦）+ mask 扩展（board-lanes/board-total/entry-rows/entry-count/requirement-table/source-table 六个 data-testid 锚点），基线 16/16 重生成；
  - **经验沉淀**：视觉基线更新流程 = 改前端→rebuild→带桩重启→pnpm e2e:visual:update→全量验证；spec 里「if count==0 则 return」的防御式跳过会掩盖按钮文案/路由失配（本轮 gatherer/investigator 编辑按钮的 warn 就是信号，功能存在但定位失败）。
- **空转绿治理（2026-08-27 第二轮，PR #35）**：**51 passed / 2 skipped / 0 failed**（skip 显式计入汇总）。
  - **探针实证空转绿根因**：Playwright 无头浏览器直查 DOM——gatherer/investigator 表格行内按钮真实存在，accessible name 为「编 辑」（AntD 双字按钮字间空格），`/编辑/` 命不中 → guard-skip 静默 pass，**这两个 D3 用例自诞生起从未真正验证过**（与 designer「生 成」同源缺陷）；
  - **guard-skip 全面清零**：8 个 spec 约 20 处 `if(count==0) return` 全部改为 `test.skip(cond, "原因")`——skip 计入汇总行、HTML 报告可查、CI 可见，定位失败从「日志里的 warn」升级为「报告里的一等公民」；
  - **显式 skip 立刻暴露 2 个真缺口**（记入 mvp-deferred D-16/D-17）：designer 前台无「组件馆藏」导航入口、assistant 反馈页侧栏无「意图日志」菜单——这两个用例在「53/53 全绿」轮其实是空转绿，是 skip 治理让它们现形；
  - **顺带修复 3 个测试契约**：gatherer/investigator 编辑 Modal 走 AntD onOk（页脚「确 定」而非表单内「保 存」）、investigator Modal 标题+label strict 双命中（收敛 .ant-modal-title 锚点）、manager 详情页「FLIGHT LOG」是 span 非 heading、assistant-routing 改用唯一 message 文本匹配日志行（intent_logs 表无 sessionId 列）；
  - **AGENTS.md 硬性约定 8（E2E 校准纪律）**：新交互用例必须读组件源码或 codegen 校准；双字按钮正则一律 \s* 形式；禁止静默跳过；副作用断言等完成事件；并发禁 [0] 位置断言；批量用例首跑逐条核对 skip/warn。
- **PR #35 合并与分支清理（2026-08-28，已合并 main acae500）**：
  - CI 首跑 e2e 失败根因：snapshotPathTemplate 含 {platform}，仓库仅有本机生成的 **win32** 基线，linux CI 找 `-linux.png` 必 snapshot-missing——修法为 `_visual.spec.ts` 加 CI 守卫（`test.skip(isCi, ...)`，本地实测 CI=1 时 16 条全部显式 skip、不设则照常跑），跨平台像素基线记 **mvp-deferred D-18**（linux 基线生成路径已写入行内）；修后 CI 三段全绿（quality/smoke/e2e）；
  - 推送降级链路再次验证：git push 挂起（代理抖动）→ MCP push_files 走 GitHub API 分批提交（28fcfaf 守卫 + a931ea7 D-18 文档），内容与本地一致；
  - 分支清理：PR squash 合并后远程分支由「自动删除 head branches」回收；本地 5 个历史分支（feat-all-apps-dual-shell / feat-frontend-content-pages / feat-remaining-front-pages / fix-admin-front-path / fix-d1-d3-push-editing）**逐一内容级取证后删除**——squash 合并使 `--merged` 判定全部失效，改用「main 中验证功能存在 + 三点 diff 为空/分支侧文件皆已进入 main」判定（fix-d1-d3 的编辑列已在 main，深度设计四页在 main，PR #30/31/32 皆为 squash 后的本地遗留）；`fetch --prune` 清掉 5 个陈旧跟踪引用，最终本地/远程仅剩 main（acae500）。

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

- 已完成（PR #35，acae500）：质量三角机制全部落地合并 main（E2E 副作用断言+视觉基线+空转绿治理、coverage-matrix/mvp-deferred 追溯体系、UI 规范工程化）；CI 全绿后 squash 合并，分支已清理（本地/远程仅剩 main）；
- **D-09 意图路由在线学习落地（2026-08-28，PR #43 已合并 main 5eae2a3）**：三层闭环——① few-shot 在线注入（IntentService 从纠错样本均衡采样构造示例注入 system prompt，每意图 3 条/总数 12 封顶，60s TTL 缓存，纠错落库即清缓存即时生效）；② 评估闭环（EvaluationService：混淆矩阵 + 回放评估命中率，`GET /intent-logs/evaluation[/replay]`）；③ 数据集导出（OpenAI 兼容 JSONL，`GET /intent-logs/export` + 前端 Blob 下载）。前端 IntentLogPage 新增「路由评估」卡片。真 LoRA 微调继续延期（导出格式已就绪）。同批含 D-06/D-08/D-12/D-13。**CI 修复两轮**：① obsidian.controller D-06 重写时丢失显式 @Inject（vitest/esbuild 不产装饰器元数据，隐式构造注入在测试内 DI 失败）——已恢复并本地真实执行验证（scholar 29/29、gatherer 19/19）；② 误移除视觉快照 CI 守卫（linux 无 -linux.png 基线必 snapshot-missing，装 CJK 字体≠有基线）——已恢复守卫。教训：turbo 缓存会复用「DB 未启动时的 skip 轮」结果，e2e 类改动必须本地起库真实执行后再推。squash 合并后分支已清理（内容级验证：evaluation.service/useResponsive 等关键文件在 main）；
- **D-07/D-11/D-16/D-17 兑现（2026-08-28，PR #36 已合并 main 2934264）**：Investigator node-cron 自动调度（scheduler.ts + surveys.cron 列 + startScheduler 挂载 + meta/scheduler-status API + 3 单测）；CI quality job 新增 0 bug loop 验收记录复选框检测（仅 PR 事件触发）；Designer 前台「组件馆藏」导航入口（/components 直达 ComponentList）；D-17 经核实 main 已含意图日志入口（确认已修复）。**分支更新三轮**：merge main 解 state.md 冲突；修 mvp-deferred 表格列数 MD056（9 列→8 列）；designer e2e 断言收敛唯一锚点「组件库」（D-16 直渲染后宽正则 strict mode 3 元素冲突——E2E 校准纪律的典型场景）；
- **D-10 兑现（2026-08-28，PR #37 已合并 main d3481f3）**：Gateway 统一健康监控仪表盘——probeAllServices 聚合探测（3s 超时容错）+ `GET /api/health` 聚合 JSON + `GET /status` Chart.js 暗色仪表盘（服务健康表/延迟柱状图/可用性趋势，5s 轮询）+ 2 单测。分支更新走服务端零冲突路径（mergeable_state: behind → update_pull_request_branch 一键 merge），对比 #36 的本地三轮修复——「behind 可服务端更新 vs conflict 须本地解」成为剩余 PR 的快速通道判据；
- **D-03/D-14/D-05 三连合并（2026-08-28，PR #41 → c9d43fa / #40 → 248ba8f / #38 → 58a3e97）**：分支更新流程已成熟成三条路径——① 服务端一键（mergeable_state: behind 且零冲突，#37/#41/#38）；② 本地 merge 解冲突（mvp-deferred/state.md 语义合并，#36/#40）；③ 竞态救援（close/reopen PR 触发 reopened 事件重跑 CI，#40）。关键纪律：**更新分支前先补 PR body 的 0 bug loop 勾选**（#36 引入的 CI 检测正则 `\[x\]\s*\*\*0 bug loop 验收记录\*\*`，旧格式 body 必被拦）。#40 顺带统一了 mvp-deferred 完成标记格式并修正错误 PR 号引用（D-10 实为 #37 非 #35）；
- **D-04 兑现（2026-08-29，PR #42 已合并 main 5a940ff）**：Designer 组件一键 PR 到 @mt/ui——GitHubClient 三步流（createBranch/createFile/createPr，PAT + GITHUB_STUB 桩）+ publish.service（4 单测）+ `POST /components/:id/publish` + ComponentList「一键 PR」按钮/结果 Modal。分支更新服务端零冲突一次到位（body 先补勾选 + merge 40d06fa + designer-server 26/26 + web 7/7 + CI 三段全绿）。**mvp-deferred 18 项至此 16 项兑现合并**，仅剩 D-01/D-02（Designer 拖拽编辑器，P2）、D-09 LoRA 层（P3）、D-15（投递日历，P2）、D-18（linux 视觉基线，P1）四项真延期（触发条件见 mvp-deferred 各行）；
- 剩余 open PR：仅 **#39**（cleanup-d16-lint，D-16 主体已被 #36 合并、lint 修复已被 #41/#43 包含，仅 coverage-matrix 更新有价值——建议关闭后单独提小 PR）；
- 候选（mvp-deferred 未兑现项）：D-15（Applicant 投递日历）、D-18（E2E 视觉快照 linux 基线）；#37-#42 对应的 D-10/D-05/D-16 重复项/D-14/D-03/D-04 已在各自 PR 实现待合并；
- 候选：部署上线（需 GitHub Secrets）、Designer 可视化编辑器、智谱 Key 更新。

## 已知问题

1. 本机 PowerShell 执行策略限制：pnpm/npx 一律用 pnpm.cmd；
2. **服务启动脚本**（2026-08-27 修正）：`infra/scripts/start-services.mjs` 必须 **不** 使用 `process.exit()` 强制退出——Windows 上 `spawn({shell:true})` 父进程终止会连带 kill 子服务进程树；shell 选项只对 `.cmd` / `.bat` 开启（pnpm.cmd 必须走 shell），`node` 命令走 `shell:false`。符合本约束即可 17 进程稳定常驻，smoke 全绿；
3. **根目录 .env**（2026-08-27 修正）：不得设置全局 `DATABASE_URL`，否则会覆盖 8 服务自己的默认同名数据库（scholar/applicant/...），导致服务启动不报任何错但业务表查不到、API 500；需要覆盖某单服务时应写成 `<SERVICE>_DATABASE_URL` 或在应用子目录 .env 配置；
4. 网络代理不稳定：沙箱代理与直连两种模式都可能失效，git 推送失败时两种都试；git 需同时配置 http.proxy 与 https.proxy（只配 http 会卡死推送）；本地网络完全中断时改走 GitHub API（MCP push_files）分批推送，内容以本地 git 提交为准；gh CLI 未安装，CI 状态查 GitHub App 的 pull_request_read(get_check_runs)，Actions 日志经 REST API 下载（job logs 需 admin 权限，公开 annotations 接口可用）；
5. 本地 .env 在仓库根（从 .env.template 复制，gitignore 忽略），各服务经 @mt/config 的 loadRootEnv 自动加载，无需 export；
6. Docker Desktop 需手动启动（引擎就绪后 compose 正常）；本地已有 pgvector/pgvector:pg16 容器（9 库：8 业务 + mt_test），本地可跑全量测试与 smoke，不再是无 DB 环境；
7. 镜像推送需先在 GitHub 配置 Secrets（REGISTRY_HOST/USERNAME/PASSWORD），未配置时 images job 自动跳过；
8. 智谱 ZHIPU_API_KEY 过期（401）时真实 LLM 功能受影响，本地以桩模式（MT_LLM_STUB）运行，待更新 Key 后恢复；
9. Node20/OpenSSL3 禁用 PKCS1 私钥解密，测试避免依赖私钥解密；
10. 子智能体委托（subagent/subagent_fork）在本环境不可用，多智能体协作需外部 CLI 环境；
11. 「0 bug loop」机制在 PR 模板里已植入「独立测试智能体验收记录」表格字段，合入前由测试智能体填写，实现流程纪律落地（不再是纯口头约定）。
12. **E2E 视觉快照平台差异**（2026-08-28，D-18）：snapshotPathTemplate 含 {platform}，仓库仅维护 win32 基线；CI（linux）跑视觉用例必 snapshot-missing，已加 CI 守卫显式 skip；兑现 linux 基线需 CI 装 fonts-noto-cjk + 生成入库（见 mvp-deferred D-18 行内方案）。
