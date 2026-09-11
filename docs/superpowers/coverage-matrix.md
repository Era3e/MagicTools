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
| A14 | D-15 投递日历（跨岗位月历/时间线 + KPI + 待跟进 + 计划面试） | mvp-deferred D-15 | apps/applicant/web/src/pages/CalendarPage.tsx + apps/applicant/web/src/pages/calendar-view.ts + apps/applicant/server/src/interview.repo.ts + apps/applicant/server/migrations/002_delivery_calendar.sql | ✅ 已实现（D-15 兑现） | applicant.spec.ts 投递日历用例 |

## 2. Investigator（调研 · 需求主线第一环）

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| I1 | 飞书 Bitable 源配置 | spec 3.1 | server/survey.controller.ts, feishu/client.ts | ✅ 已实现 | survey.e2e.test.ts（FEISHU_STUB） |
| I2 | 字段映射配置 | spec 3.1 | server/schemas.ts SurveyCreate, SurveyRepo | ✅ 已实现 | unit test（桩） |
| I3 | 定时/手动拉取 Bitable 记录 | spec 3.2 | server/survey.service.ts syncSurvey() + apps/investigator/server/src/scheduler.ts（node-cron，migrations/003 cron 列） | ✅ 已实现（D-07 兑现，PR #36：startScheduler + meta/scheduler-status API + 3 单测） | investigator.spec.ts + scheduler.test.ts |
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
| M2 | 需求 7 态状态机、原子更新与并发修订 | docs/features/manager-candidate-import.md | apps/manager/server/src/requirement-policy.ts + apps/manager/server/src/requirement.repo.ts | ✅ 已实现：统一手工/PR 迁移规则、expectedRevision 冲突、同状态 PR no-op | apps/manager/server/src/requirement-foundation.e2e.test.ts |
| M3 | 三来源标签（Assessor/手动/GitHub Phantom） | spec 3.2 | server/requirement.repo.ts source 字段三枚举 | ✅ 已实现 | unit + requirement.e2e.test.ts |
| M4 | PR 状态联动刷新 | spec 3.3 | server/requirement.service.ts syncPrStatus() + apps/manager/server/src/webhook.controller.ts | ✅ 已实现（D-03 兑现，PR #41：POST /webhook/github HMAC-SHA256 签名 + delivery 幂等 + 6 单测） | requirement.e2e.test.ts + webhook.controller.spec.ts |
| M5 | Phantom GitHub Issues 同步 | spec 3.3 | server/github/client.ts getPhantomIssues() + GITHUB_STUB | ✅ 已实现 | unit（桩） |
| M6 | 迭代管理（CRUD + 需求关联） | spec 3.4 | server/iteration.*, web/pages/IterationList.tsx | ✅ 已实现 | iteration.e2e.test.ts |
| M7 | 前台 FLIGHT DECK 七泳道看板 | PR #30 | web/pages/RequirementBoard.tsx COCKPIT_THEME | ✅ 已实现 | manager.spec.ts 页面渲染 |
| M8 | 前台 RequirementDetail 飞行日志 | PR #31 | web/pages/RequirementDetail.tsx 仪表卡 + 时间线 | ✅ 已实现 | — |
| M9 | 后台需求管理表格 + 迭代管理 | PR #29 | RequirementList.tsx + IterationList.tsx AdminShell | ✅ 已实现 | manager.spec.ts |
| M10 | 候选预览、确认与剩余批次 | docs/features/manager-candidate-import.md | apps/manager/server/src/import.service.ts + apps/manager/web/src/pages/CandidateImport.tsx | ✅ 已实现：来源校验、事务去重与冲突回滚；不授权自动开发 | apps/manager/server/src/import-batch.e2e.test.ts + apps/manager/web/src/pages/RequirementList.test.tsx + e2e/tests/manager-import.spec.ts |
| M11 | 独立能力基线与规划证据 | docs/features/manager-candidate-import.md | apps/manager/web/src/pages/CapabilityList.tsx + apps/manager/web/src/pages/RequirementDetail.tsx | ✅ 已实现：基线不进入需求队列；规划保留证据/验收/依赖 | apps/manager/server/src/import-batch.e2e.test.ts |
| M12 | 内容修订与版本比较 | docs/features/manager-content-approval.md | apps/manager/server/src/requirement-revisions.repo.ts + apps/manager/web/src/pages/RequirementHistory.tsx | ✅ 已实现：触发器快照、迁移回填标记、分页与完整内容对比 | apps/manager/server/src/requirement-revisions.e2e.test.ts + apps/manager/web/src/pages/RequirementApproval.test.tsx |
| M13 | 固定版本审批与撤销 | docs/features/manager-content-approval.md | apps/manager/server/src/requirement-approval.service.ts + apps/manager/web/src/pages/RequirementContentPanel.tsx | ✅ 已实现：双版本冲突、凭证校验、内容变更失效、追加审计；不启用自动执行 | apps/manager/server/src/requirement-revisions.e2e.test.ts + e2e/tests/manager-approval.spec.ts |

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
| Sc11 | Obsidian Vault 同步（路径去重 + 冲突合并） | spec 3.5 + PR #43 | obsidian.controller/service.ts scanVault() + content_hash 冲突检测 + 三策略解决 | ✅ 已实现（PR #43：保留库/采用库外/合并编辑 + SettingsPage 冲突表格） | obsidian.e2e.test.ts + obsidian.service.spec.ts 7 tests |
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
| D7 | **可视化拖拽编辑器** | designer-canvas-design（2026-09-10） | apps/designer/web/src/pages/studio/StudioPage.tsx + Palette.tsx + CanvasDropZone.tsx + CanvasRenderer.tsx + PropForm.tsx + canvas/schema.ts + canvas/registry.ts | ✅ 已实现（deferred D-01 兑现：三栏画布，dnd-kit 拖拽 + 双击同源兜底，8 组件注册表；2026-09-11 补 CanvasDropZone droppable 注册修复拖拽放置断链 + 2 条真实指针拖拽 e2e） | designer.spec.ts 画布工坊 6 用例 + StudioPage.test.tsx 8 用例 |
| D8 | **实时双向编辑** | designer-canvas-design §4 | apps/designer/web/src/canvas/codegen.ts + pages/studio/CodePanel.tsx + apps/designer/server/src/parse.service.ts（@babel/parser 白名单逆向）+ GeneratePage「送入画布」 | ✅ 已实现（deferred D-02 兑现：schema→code 确定性生成 + code→schema 显式应用；components/generations 落 schema jsonb 列） | codegen.test.ts 5 用例 + parse.service.spec.ts 8 用例 + components.e2e.test.ts schema 用例 |
| D9 | **一键发布到 npm / PR 到 @mt/ui** | — | apps/designer/server/src/publish.service.ts + publish.controller.ts + github/client.ts + ComponentList「一键 PR」按钮 | ✅ 已实现（deferred D-04 兑现，PR #42：createBranch/createFile/createPr 三步流，PAT + GITHUB_STUB 桩） | publish.service.spec.ts 4 用例 + components.e2e.test.ts |

## 9. 公共能力 & 工程化

| # | 功能点 | 说明 | 实现 | 状态 |
|---|-------|-----|------|------|
| C1 | 四层测试体系（单元/冒烟/回归/E2E） | CODE_WIKI 11.3 | Vitest + smoke.mjs + Turbo --affected + Playwright | ✅ 已实现 |
| C2 | CI 3 门禁（quality/smoke/e2e）+ main 保护 | CODE_WIKI 11.4, AGENTS.md | .github/workflows/ci.yml + branch protection | ✅ 已实现 |
| C3 | outbox 事件（失败重试 + dead 终态 + 幂等） | CODE_WIKI 7, state.md 决策 37 | @mt/db outbox.ts | ✅ 已实现 |
| C4 | @mt/model-client parseJson 四级容错 | state.md PR #26 | model-client/parseJson.ts | ✅ 已实现，5 服务替换 |
| C5 | 前后台双外壳（前台各异 / 后台统一） | ui-spec.md, CODE_WIKI 8.2 | @mt/ui UserShell / AdminShell + 8 App.tsx 切换 | ✅ 已实现（8 应用全覆盖） |
| C6 | 0 bug loop 开发/测试分拆验收 | state.md 已知问题 9 | PR 模板复选框 + .github/workflows/ci.yml quality 条件检测（仅 PR 事件） | ✅ 已实现（D-11 兑现，PR #36） |
| C7 | 视觉样式回归测试 | 本方案 P0-1c | e2e/tests/_visual.spec.ts Playwright toHaveScreenshot 16 张 + 平台基线感知守卫 | ✅ 已实现（PR #35/#44/#45：win32/linux 双平台基线闭环） |
| C8 | 前端硬编码色值静态检查 | 本方案 P1-1 | infra/eslint/rules/no-hardcoded-colors.mjs | ✅ 已实现（PR #35） |
| C9 | 通用页面模式库（patterns） | 本方案 P1-3 | packages/ui/src/patterns/（MagazineList/ControlTable/DetailHero/TimelineBurndown） | ✅ 已实现（PR #35/#40，含 patterns.test.tsx 8 用例） |
| C10 | ThemePreview 主题横向对比 | 本方案中期 | — | 🚫 未实现（后续 P2，无 deferred 编号） |
| C11 | 全项目关键数据库强制验证与普通单测边界 | docs/features/quality-evidence.md | infra/scripts/test-database.mjs + infra/testing/database-suites.json + infra/testing/unit-database-boundary.mjs | ✅ 已实现：每文件隔离主库/上游、无缓存、skip=0、清单漏项拒绝；database-validation.review.test.mjs 独立验收 |
| C12 | 候选提交与运行绑定的质量证据 | docs/features/quality-evidence.md | infra/scripts/quality-gate.mjs + infra/scripts/lib/quality-evidence.mjs | ✅ 已实现：候选/checkout/base/run/mode绑定、工作树漂移拒绝、完整数据库明细重算与失败artifact；quality-evidence.review.test.mjs 独立验收 |

## 10. 2026-09 增量（双路查询 + UI v2.x 轮次，补记）

P03运行契约与P05制品基础补充：

| 编号 | 能力 | 实现及验证入口 | 状态 |
|---|---|---|---|
| P03 | 独立镜像、迁移就绪、断连恢复、Web与业务持久化 | infra/scripts/build-images.mjs + infra/scripts/validate-runtime.mjs + packages/db/src/readiness.ts | ✅ 17镜像及9项实际容器回归通过，独立验收完成，整批CI仍需验证 |
| P05-artifact | SHA与registry digest、制品校验、失败发布回执 | infra/scripts/publish-images.mjs + infra/scripts/lib/release-artifacts.mjs | ✅ 本地仓库17镜像推送/回读通过；本机/SSH部署及回退入口已实现，第二版实际回归待收尾 |

| # | 功能点 | Spec 章节 | 实际实现文件 | 状态 | E2E 覆盖 |
|---|-------|----------|-------------|------|---------|
| E1 | Assistant 双路数据查询（直连先行 + 智能体核验） | dual-query-design 3.x | apps/assistant/server/src/direct-query.service.ts + verify-task.registry.ts + chat.service.ts 双路编排 | ✅ 已实现（PR #54，CYBERCLOUD_MODE=dual 默认） | chat.dual.e2e.test.ts 五终态场景 |
| E2 | 数值比对引擎（万/亿/k/% 归一 + 容差） | dual-query-design | apps/assistant/server/src/compare.service.ts | ✅ 已实现（PR #54） | compare.service.test.ts |
| E3 | cybercloud_calls 双路调用监控 | dual-query-design 可观测 | apps/assistant/server/migrations/004 + cybercloud-calls.repo.ts + IntentLogPage 监控卡 | ✅ 已实现（PR #54） | cybercloud-calls.repo.test.ts + IntentLogPage.calls.test.tsx |
| E4 | ChatPage VerifyBadge 核验标签 | dual-query-design 前端 | apps/assistant/web/src/pages/ChatPage.tsx VerifyBadge（2s 轮询终态/404 停止） | ✅ 已实现（PR #54） | ChatPage.verify.test.tsx |
| E5 | 真环境校准（四契约偏差修复） | dual-query-design 附录 | direct-query 行分组兜底/包裹对象取值/取值键构造/空数据回答 0 | ✅ 已实现（a851a68，140/140 绿） | direct-query.service.test.ts |
| E6 | UI v2/v2.1/v2.2 令牌与组件基建 | ui-spec v2 §六 | packages/ui/src/tokens.ts v2 系 + MtStatusTag + MtKpiRow + patterns 单测 | ✅ 已实现（PR #47/#51） | @mt/ui 22 用例 + e2e 视觉基线 |
| E7 | UI v2.3 全量页面重构（17 页设计稿） | .design-ref 17 页 | packages/ui/src/AdminShell.tsx + UserShell.tsx v2.3 + 8 应用前后台全页 + gateway 落地页 + 3 交互演示 | ✅ 已实现（PR #56 前身，squash ef9821d） | e2e 全量 83 passed + 视觉 16/16 |
| E8 | 五道质量防线（v2.3.1） | state.md 五防线轮 | e2e/tests/responsive.spec.ts（32 用例）+ .githooks/pre-commit + turbo ^build + packages/ui/src/apps.ts 文案单源 + 视觉锚点 fail fast | ✅ 已实现（PR #56，0 bug loop 验收通过） | responsive 32/32 + drift guard 用例 |
| E9 | Designer 画布工坊（D-01/D-02 兑现） | designer-canvas-design | apps/designer/web/src/canvas/{schema,registry,codegen}.ts + pages/studio/ 四组件 + apps/designer/server/src/parse.service.ts + migrations/002_canvas_schema.sql | ✅ 已实现（2026-09-10，拖拽画布 + 双向编辑闭环） | designer.spec.ts +4 用例；视觉基线 18 张 |
| E10 | Assistant LoRA 微调编排层（D-09 兑现） | assistant-lora-finetune-design | packages/model-client/src/finetune.ts + apps/assistant/server/src/finetune.{service,repo}.ts + migrations/005_finetune_jobs.sql + IntentLogPage 微调卡 | ✅ 已实现（2026-09-10，FT_STUB 桩全链路；真跑需样本 ≥500 + FT_LAUNCH_ENABLED=1 + 智谱 Pro 权益） | finetune.test.ts 5 用例 + finetune.service.spec.ts 5 用例 + IntentLogPage.finetune.test.tsx 3 用例 |
