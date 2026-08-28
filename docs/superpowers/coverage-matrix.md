# MagicTools 功能-代码追踪矩阵（Coverage Matrix）

> 目的：回答「这个功能是规划没做，还是落地遗漏？」
> 维护规则：每个 PR 合入时，开发负责人必须更新对应行的「实际实现文件」与「E2E 覆盖」两列。
> 状态说明：✅ 已实现（与 spec 一致） / ⚠️ 部分实现（有降级/裁剪，见 deferred.md） / 🚫 未实现（规划有，代码缺） / 📝 规划未纳入（MVP 阶段明确不做）

## 1. Applicant（求职 · MVP 试点）

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| A1 | 岗位 CRUD | spec 3.1 | server/position.*, web/pages/PositionList.tsx | ✅ 已实现 | applicant.spec.ts API 链路 |
| A2 | JD 文本解析 | spec 3.1 | server/position.service.ts parseJd() | ✅ 已实现 | applicant.spec.ts |
| A3 | 截图视觉识别（JD） | spec 3.1 | server/position.controller.ts uploadImage, model-client vision:true | ✅ 已实现 | API 测（桩模式跳过视觉） |
| A4 | 投递话术生成 | spec 3.1 | server/position.service.ts pitchText() | ✅ 已实现 | API 链路覆盖 |
| A5 | 面试记录 + LLM 复盘 | spec 3.2 | server/interview.*, web/pages/InterviewPage.tsx | ✅ 已实现 | applicant.spec.ts analyze/export |
| A6 | 面试复盘 Markdown 导出 | spec 3.2 | server/interview.controller.ts GET export.md | ✅ 已实现 | applicant.spec.ts 断言含「# 面试复盘」 |
| A7 | 简历三件套（analyze/rewrite/match） | spec 3.3 | server/resume.* + clawcv/ 客户端 + fallback | ✅ 已实现（含无 Key 降级） | resume.e2e.test.ts |
| A8 | ClawCV 外部集成 | spec 3.3 | clawcv/client.ts, clawcv/fallback.ts | ✅ 已实现 | unit test（桩） |
| A9 | 前台杂志风岗位博览墙 | PR #28 双外壳 | web/pages/PositionWall.tsx + MAGAZINE_THEME | ✅ 已实现 | applicant.spec.ts 路由拆分 |
| A10 | 前台 PositionDetail 特稿版式 | PR #31 | web/pages/PositionDetail.tsx FEATURE theme | ✅ 已实现 | — |
| A11 | 前台 InterviewPage 对开双栏 | PR #31 | web/pages/InterviewPage.tsx DEBRIEF theme | ✅ 已实现 | — |
| A12 | 前台 ResumeCenter 工坊 | PR #31 | web/pages/ResumeCenter.tsx WORKSHOP theme | ✅ 已实现 | — |
| A13 | 后台岗位管理表格 | PR #28 | web/pages/PositionList.tsx AdminShell | ✅ 已实现 | applicant.spec.ts 路由拆分 |

## 2. Investigator（调研 · 需求主线第一环）

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| I1 | 飞书 Bitable 源配置 | spec 3.1 | server/survey.controller.ts, feishu/client.ts | ✅ 已实现 | survey.e2e.test.ts（FEISHU_STUB） |
| I2 | 字段映射配置 | spec 3.1 | server/schemas.ts SurveyCreate, SurveyRepo | ✅ 已实现 | unit test（桩） |
| I3 | 定时/手动拉取 Bitable 记录 | spec 3.2 | server/survey.service.ts syncSurvey()（node-cron 待补） | ⚠️ 部分：仅手动 sync，无 cron 调度 | investigator.spec.ts |
| I4 | LLM 结构化提取（question/answer/priority/...） | spec 3.3 | server/survey.service.ts structurize() + llm.ts | ✅ 已实现 | survey.e2e.test.ts |
| I5 | 结果筛选 + 推送 Assessor（D1） | spec 3.4, state.md fix-d1-d3 | server/outbox append researcher.response.push, web/SurveyDetail.tsx 收件箱文案 | ✅ 已实现 | survey.e2e.test.ts（断言 outbox 入库） |
| I6 | 前台档案风报头 | PR #29 | web/App.tsx ARCHIVE_THEME（直跳后台） | ✅ 已实现 | — |
| I7 | 后台 SurveyList 编辑列（D3） | state.md fix-d1-d3 | web/pages/SurveyList.tsx + SurveyForm 编辑模式 | ✅ 已实现 | — |

## 3. Assessor（评审 · 需求主线第二环）

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| S1 | 跨库消费 investigator.outbox | spec 3.1 | server/main.ts processOutbox(INVESTIGATOR_DATABASE_URL) | ✅ 已实现 | request.e2e.test.ts |
| S2 | 多 response 按 surveyId 聚合 | spec 3.1 | server/request.service.ts ingestBatch() | ✅ 已实现 | unit |
| S3 | GitHub 仓库上下文（README/目录树/语言） | spec 3.2 | server/github/client.ts | ✅ 已实现（GITHUB_STUB） | request.e2e.test.ts |
| S4 | LLM 需求分析 + 设计方案 | spec 3.3 | server/llm.ts analyzeRequest() + designRequest() | ✅ 已实现 | request.e2e.test.ts |
| S5 | 五状态审核流（pending→approved/rejected/...） | spec 3.4 | server/schemas.ts RequestStatus, RequestDetail 五按钮 | ✅ 已实现 | request.e2e.test.ts |
| S6 | 审核通过推送 Manager（D1） | spec 3.5, state.md fix-d1-d3 | outbox append requirement.created + ReviewComment + 收件箱文案 | ✅ 已实现 | request.e2e.test.ts |
| S7 | 前台文书风报头 | PR #29 | web/App.tsx BRIEF_THEME（直跳后台） | ✅ 已实现 | — |
| S8 | 幂等入库（重复推送不重复创建） | spec 3.1 幂等键 | RequestRepo INSERT ON CONFLICT (idempotency_key) | ✅ 已实现 | unit |

## 4. Manager（管理 · 需求主线核心）

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| M1 | 跨库消费 assessor.outbox（requirement.created） | spec 3.1 | server/main.ts processOutbox(ASSESSOR_DATABASE_URL) | ✅ 已实现 | requirement.e2e.test.ts |
| M2 | 需求 7 态状态机 | spec 3.2 | server/schemas.ts RequirementStatus 7 值 | ✅ 已实现 | requirement.e2e.test.ts 状态流转 |
| M3 | 三来源标签（Assessor/手动/GitHub Phantom） | spec 3.2 | server/requirement.repo.ts source 字段三枚举 | ✅ 已实现 | unit + requirement.e2e.test.ts |
| M4 | PR 状态联动刷新 | spec 3.3 | server/requirement.service.ts syncPrStatus()（仅手动按钮） | ⚠️ 部分：缺 Webhook 自动刷新，需管理员点按钮 | requirement.e2e.test.ts |
| M5 | Phantom GitHub Issues 同步 | spec 3.3 | server/github/client.ts getPhantomIssues() + GITHUB_STUB | ✅ 已实现 | unit（桩） |
| M6 | 迭代管理（CRUD + 需求关联） | spec 3.4 | server/iteration.*, web/pages/IterationList.tsx | ✅ 已实现 | iteration.e2e.test.ts |
| M7 | 前台 FLIGHT DECK 七泳道看板 | PR #30 | web/pages/RequirementBoard.tsx COCKPIT_THEME | ✅ 已实现 | manager.spec.ts 页面渲染 |
| M8 | 前台 RequirementDetail 飞行日志 | PR #31 | web/pages/RequirementDetail.tsx 仪表卡 + 时间线 | ✅ 已实现 | — |
| M9 | 后台需求管理表格 + 迭代管理 | PR #29 | RequirementList.tsx + IterationList.tsx AdminShell | ✅ 已实现 | manager.spec.ts |

## 5. Gatherer（采集 · 知识主线第一环）

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| G1 | 三类源（RSS / JSON / 网页选择器） | spec 3.1 | server/feed/parser.ts（rss-parser + 原生 JSON + cheerio） | ✅ 已实现 | parser.test.ts + source.e2e.test.ts |
| G2 | 试采 | spec 3.1 | source.service.ts testCollect() | ✅ 已实现 | source.e2e.test.ts |
| G3 | Cron 调度（node-cron） | spec 3.2 | server/scheduler.ts + SchedulerService | ✅ 已实现（FEED_STUB） | scheduler.test.ts |
| G4 | 管道：解析→去重→LLM 富化→入库 | spec 3.3 | collect.service.ts pipeline() | ✅ 已实现 | parser.test.ts + unit |
| G5 | 去重（contentFingerprint） | spec 3.3 | @mt/utils.contentFingerprint + source.repo.ts 唯一索引 | ✅ 已实现 | unit |
| G6 | LLM 富化（title/summary/content/category/keywords） | spec 3.3 | llm.ts enrichItem() | ✅ 已实现 | llm.test.ts |
| G7 | 推送 Scholar（knowledge.item.collected）D1 | spec 3.4 + state.md | ItemList.tsx 按钮 + gatherer/outbox + 收件箱文案 | ✅ 已实现 | gatherer.spec.ts |
| G8 | 前台报刊风报头 | PR #29 | web/App.tsx PRESS_THEME（直跳后台） | ✅ 已实现 | — |
| G9 | 后台 SourceList 编辑列（D3） | state.md fix-d1-d3 | web/pages/SourceList.tsx Modal + PATCH /sources/:id | ✅ 已实现 | — |

## 6. Scholar（知识 · 知识主线第二环）

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| Sc1 | 跨库消费 gatherer.outbox 收件箱 | spec 3.1 | inbox.controller/service.ts, main.ts processOutbox(GATHERER_DB) | ✅ 已实现 | inbox.e2e.test.ts |
| Sc2 | 收件箱审核入库 | spec 3.1 | inbox.service.ts approve() → Entry | ✅ 已实现 | inbox.e2e.test.ts |
| Sc3 | 三来源条目（gatherer/manual/obsidian）CRUD | spec 3.2 | entry.controller/repo.ts source 字段 | ✅ 已实现 | entry.e2e.test.ts |
| Sc4 | 分类 + 标签管理 | spec 3.2 | entry.repo.ts category/tags 列 + admin/entries 编辑 | ✅ 已实现 | entry.e2e.test.ts |
| Sc5 | 圈定（AssistantScope 开关） | spec 3.2, 3.6 | entry PATCH assistantScope + scholar/admin/entries 书签按钮 | ✅ 已实现 | scholar.spec.ts 圈定 PATCH 断言 |
| Sc6 | 全文检索（pg_trgm FTS） | spec 3.3 | search.service.ts ftsSearch() + to_tsvector | ✅ 已实现 | scholar.spec.ts fts 接口 |
| Sc7 | 向量检索（pgvector + embedding-2 1024） | spec 3.3, 10.3 | search.service.ts vectorSearch() + embed() | ✅ 已实现（桩模式伪向量） | scholar.spec.ts vector 接口 |
| Sc8 | 双通道切换 UI | PR #30 | web/pages/SearchPage.tsx 目录卡 + FTS/VECTOR 切换器 | ✅ 已实现 | SearchPage.test.tsx |
| Sc9 | LLM 图谱抽取（实体/关系）+ 重建 | spec 3.4 | graph.service.ts generateGraph() + rebuild() | ✅ 已实现 | graph.e2e.test.ts |
| Sc10 | 图谱查询 + 展示 | spec 3.4 + PR #31/#38 | GraphPage.tsx G6 力导向图 + 节点拖拽 + 边可点击 + 详情面板 | ✅ 已实现（PR #38：G6 5.1.1，drag-canvas/drag-element/zoom-canvas/click-select 四行为，详情面板 SelectedNodePanel/SelectedEdgePanel） | GraphPage.test.tsx 2 tests |
| Sc11 | Obsidian Vault 同步（路径去重） | spec 3.5 | obsidian.controller/service.ts scanVault() | ✅ 已实现（仅扫描+去重，缺冲突合并） | obsidian.e2e.test.ts |
| Sc12 | 前台书目检索（卡片）+ 馆藏目录（书卷）+ 图谱 | PR #30/#31 | SearchPage/EntryList/GraphPage 三页深度主题 | ✅ 已实现 | scholar.spec.ts 页面渲染 |
| Sc13 | 后台条目五项字段编辑（D3） | state.md fix-d1-d3 | admin/entries 页面 Modal（title/summary/content/category/tags） | ✅ 已实现 | EntryList.test.tsx |
| Sc14 | 前台 EntryList 书签式圈定 | PR #31 | EntryList.tsx 圈定按钮 + 视觉书签样式 | ✅ 已实现 | EntryList.test.tsx |

## 7. Assistant（助手 · 知识主线闭环 · 6 意图）

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| As1 | 双层意图路由（系统归属→域内） | spec 3.1（assistant-routing-design.md） | intent.service.ts classify() 规则+模型双轨 | ✅ 已实现 | intent.service.test.ts + routing.spec.ts |
| As2 | 6 类意图：product_inquiry / data_query / process_execution / trouble_shooting / complaint_feedback / chitchat_reject | spec 3.2 表 | intent.service.ts + 对应 6 个 service | ✅ 已实现 | assistant-intents.spec.ts 6 用例 |
| As3 | 置信度输出 + 低置信度澄清反问闭环 | routing-design spec | intent.service.ts {confidence} + clarify.e2e.test.ts | ✅ 已实现 | clarify.e2e.test.ts + ChatPage.clarify.test.tsx |
| As4 | product_inquiry → Scholar 圈定条目 + 引用回答 | spec 3.3 | knowledge.service.ts fetchScoped() + 引用段落拼接 | ✅ 已实现 | chat.e2e.test.ts 带引用断言 |
| As5 | data_query → cybercloud 真实对接（SPKI/JWT/双头） | spec 3.4 + docs/cybercloud-setup | cybercloud.service.ts + 401 自动重登 | ✅ 已实现（实测 testcybercloud-dev 打通） | data-query.e2e.test.ts（CYBERCLOUD_STUB） |
| As6 | process_execution → 网关调 Manager 建需求 / Gatherer 采触发 | spec 3.5 | action.service.ts process_execution branch + gateway 反代 | ✅ 已实现 | action.e2e.test.ts |
| As7 | trouble_shooting → 全服务健康探测聚合 + LLM 建议 | spec 3.5 | trouble.service.ts probeAll() + llm 排障 | ✅ 已实现 | trouble.e2e.test.ts |
| As8 | complaint_feedback → 落库 + Web 可查 | spec 3.6 | feedback.* + pages/FeedbackPage.tsx | ✅ 已实现 | feedback.e2e.test.ts |
| As9 | 多轮对话持久化 + 指代消解 | spec 3.2 | conversation.repo.ts + chat.service.ts contextWindow | ✅ 已实现 | multi-turn.e2e.test.ts |
| As10 | 意图日志可观测 + 纠错回填 | spec 3.7 + PR #22 | intent-log.* + pages/IntentLogPage.tsx | ✅ 已实现 | intent-log.e2e.test.ts |
| As11 | 前台极简双栏对话气泡 | PR #30 | pages/ChatPage.tsx 异形圆角 + 引用区 + 署名 | ✅ 已实现 | ChatPage.test.tsx |
| As12 | HTTP API 双入口 | spec 3.1 | chat.controller.ts HTTP + web 入口 | ✅ 已实现 | chat.e2e.test.ts |
| As13 | 纠错回填到训练语料 | spec 3.7 | intent-log PATCH /intent-logs/:id 覆盖路由 | ✅ 已实现 | intent-log.e2e.test.ts |

## 8. Designer（设计 · 降级版组件生成器）

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| D1 | 自然语言 → @mt/ui 令牌组件源码 | spec 3.1（MVP 边界：降级版） | generate.service.ts + llm.ts genComponent() | ✅ 已实现 | generate.e2e.test.ts |
| D2 | 设计稿图片 → 组件（视觉模型） | spec 3.1 + model-client vision:true | generate.controller.ts vision 分支上传 | ✅ 已实现（桩模式跳过视觉） | generate.e2e.test.ts |
| D3 | esbuild 沙箱预览 | spec 3.2 | preview.service.ts（React+TSX → HTML 字符串） | ✅ 已实现 | preview.e2e.test.ts + preview.service.test.ts |
| D4 | 组件审核入库 → @mt/ui 候选池 | spec 3.3 | component.* + ComponentRepo + admin/components | ✅ 已实现 | components.e2e.test.ts |
| D5 | 生成历史记录 | spec 3.3 | generation.repo.ts + pages/HistoryList.tsx | ✅ 已实现 | GeneratePage.test.tsx |
| D6 | 前台画廊委托单 + 预览展位 | PR #30 | pages/GeneratePage.tsx GALLERY_THEME 委托卡 + 展品卡 | ✅ 已实现 | GeneratePage.test.tsx |
| D7 | **可视化拖拽编辑器** | spec 2.1「MVP 边界：降级版，无可视化编辑器」 | — | 📝 规划未纳入（MVP 降级项） | — |
| D8 | **实时双向编辑** | spec 2.1 MVP 边界 | — | 📝 规划未纳入（MVP 降级项） | — |
| D9 | **一键发布到 npm / PR 到 @mt/ui** | — | — | 🚫 未实现（后续补充，deferred D-04） | — |

## 9. 公共能力 & 工程化

| # | 功能点 | 说明 | 实现 | 状态 |
|---|-------|-----|------|------|
| C1 | 四层测试体系（单元/冒烟/回归/E2E） | CODE_WIKI 11.3 | Vitest + smoke.mjs + Turbo --affected + Playwright | ✅ 已实现 |
| C2 | CI 3 门禁（quality/smoke/e2e）+ main 保护 | CODE_WIKI 11.4, AGENTS.md | .github/workflows/ci.yml + branch protection | ✅ 已实现 |
| C3 | outbox 事件（失败重试 + dead 终态 + 幂等） | CODE_WIKI 7, state.md 决策 37 | @mt/db outbox.ts | ✅ 已实现 |
| C4 | @mt/model-client parseJson 四级容错 | state.md PR #26 | model-client/parseJson.ts | ✅ 已实现，5 服务替换 |
| C5 | 前后台双外壳（前台各异 / 后台统一） | ui-spec.md, CODE_WIKI 8.2 | @mt/ui UserShell / AdminShell + 8 App.tsx 切换 | ✅ 已实现（8 应用全覆盖） |
| C6 | 0 bug loop 开发/测试分拆验收 | state.md 已知问题 9 | PR 模板待补验收链接勾选 | ⚠️ 流程纪律：规则有，落地产物无 |
| C7 | 视觉样式回归测试 | 本方案 P0-1c | Playwright toHaveScreenshot 16 张页 | 🚫 未实现（本 PR 补） |
| C8 | 前端硬编码色值静态检查 | 本方案 P1-1 | ESLint 自定义 rule | 🚫 未实现（本 PR 补） |
| C9 | 通用页面模式库（patterns） | 本方案 P1-3 | @mt/ui patterns/ MagazineList/ControlTable/DetailHero | 🚫 未实现（本 PR 补） |
| C10 | ThemePreview 主题横向对比 | 本方案中期 | @mt/ui ThemePreview.tsx | 🚫 未实现（后续 P2） |
