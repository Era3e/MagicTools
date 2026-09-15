# MagicTools 功能索引

> 自动生成文件：请修改事实源后运行 `pnpm docs:facts`，不要手工编辑。
> 事实源：docs/superpowers/coverage-matrix.md。

## Applicant

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| A1 | 岗位 CRUD | ✅ 已实现 | server/position.*, web/pages/PositionList.tsx | applicant.spec.ts API 链路 |
| A2 | JD 文本解析 | ✅ 已实现 | server/position.service.ts parseJd() | applicant.spec.ts |
| A3 | 截图视觉识别（JD） | ✅ 已实现 | server/position.controller.ts uploadImage, model-client vision:true | API 测（桩模式跳过视觉） |
| A4 | 投递话术生成 | ✅ 已实现 | server/position.service.ts pitchText() | API 链路覆盖 |
| A5 | 面试记录 + LLM 复盘 | ✅ 已实现 | server/interview.*, web/pages/InterviewPage.tsx | applicant.spec.ts analyze/export |
| A6 | 面试复盘 Markdown 导出 | ✅ 已实现 | server/interview.controller.ts GET export.md | applicant.spec.ts 断言含「# 面试复盘」 |
| A7 | 简历三件套（analyze/rewrite/match） | ✅ 已实现（含无 Key 降级） | server/resume.* + clawcv/ 客户端 + fallback | resume.e2e.test.ts |
| A8 | ClawCV 外部集成 | ✅ 已实现 | clawcv/client.ts, clawcv/fallback.ts | unit test（桩） |
| A9 | 前台杂志风岗位博览墙 | ✅ 已实现 | web/pages/PositionWall.tsx + MAGAZINE_THEME | applicant.spec.ts 路由拆分 |
| A10 | 前台 PositionDetail 特稿版式 | ✅ 已实现 | web/pages/PositionDetail.tsx FEATURE theme | — |
| A11 | 前台 InterviewPage 对开双栏 | ✅ 已实现 | web/pages/InterviewPage.tsx DEBRIEF theme | — |
| A12 | 前台 ResumeCenter 工坊 | ✅ 已实现 | web/pages/ResumeCenter.tsx WORKSHOP theme | — |
| A13 | 后台岗位管理表格 | ✅ 已实现 | web/pages/PositionList.tsx AdminShell | applicant.spec.ts 路由拆分 |
| A14 | D-15 投递日历（跨岗位月历/时间线 + KPI + 待跟进 + 计划面试） | ✅ 已实现（D-15 兑现） | apps/applicant/web/src/pages/CalendarPage.tsx + apps/applicant/web/src/pages/calendar-view.ts + apps/applicant/server/src/interview.repo.ts + apps/applicant/server/migrations/002_delivery_calendar.sql | applicant.spec.ts 投递日历用例 |

## Investigator

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| I1 | 飞书 Bitable 源配置 | ✅ 已实现 | server/survey.controller.ts, feishu/client.ts | survey.e2e.test.ts（FEISHU_STUB） |
| I2 | 字段映射配置 | ✅ 已实现 | server/schemas.ts SurveyCreate, SurveyRepo | unit test（桩） |
| I3 | 定时/手动拉取 Bitable 记录 | ✅ 已实现（D-07 兑现，PR #36：startScheduler + meta/scheduler-status API + 3 单测） | server/survey.service.ts syncSurvey() + apps/investigator/server/src/scheduler.ts（node-cron，migrations/003 cron 列） | investigator.spec.ts + scheduler.test.ts |
| I4 | LLM 结构化提取（question/answer/priority/...） | ✅ 已实现 | server/survey.service.ts structurize() + llm.ts | survey.e2e.test.ts |
| I5 | 结果筛选 + 推送 Assessor（D1） | ✅ 已实现 | server/outbox append researcher.response.push, web/SurveyDetail.tsx 收件箱文案 | survey.e2e.test.ts（断言 outbox 入库） |
| I6 | 前台档案风报头 | ✅ 已实现 | web/App.tsx ARCHIVE_THEME（直跳后台） | — |
| I7 | 后台 SurveyList 编辑列（D3） | ✅ 已实现 | web/pages/SurveyList.tsx + SurveyForm 编辑模式 | — |

## Assessor

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| S1 | 跨库消费 investigator.outbox | ✅ 已实现 | server/main.ts processOutbox(INVESTIGATOR_DATABASE_URL) | request.e2e.test.ts |
| S2 | 多 response 按 surveyId 聚合 | ✅ 已实现 | server/request.service.ts ingestBatch() | unit |
| S3 | GitHub 仓库上下文（README/目录树/语言） | ✅ 已实现（GITHUB_STUB） | server/github/client.ts | request.e2e.test.ts |
| S4 | LLM 需求分析 + 设计方案 | ✅ 已实现 | server/llm.ts analyzeRequest() + designRequest() | request.e2e.test.ts |
| S5 | 五状态审核流（pending→approved/rejected/...） | ✅ 已实现 | server/schemas.ts RequestStatus, RequestDetail 五按钮 | request.e2e.test.ts |
| S6 | 审核通过推送 Manager（D1） | ✅ 已实现 | outbox append requirement.created + ReviewComment + 收件箱文案 | request.e2e.test.ts |
| S7 | 前台文书风报头 | ✅ 已实现 | web/App.tsx BRIEF_THEME（直跳后台） | — |
| S8 | 幂等入库（重复推送不重复创建） | ✅ 已实现 | RequestRepo INSERT ON CONFLICT (idempotency_key) | unit |
| S9 | 仓库证据采集与需求反向整理 | ✅ 已实现：按提交筛选五类源码、行级证据、unknown动机、repo+SHA幂等 | server/repository-evidence.* + migrations/004 + web/pages/RepositoryEvidence.tsx | github/client.test.ts + repository-evidence.e2e.test.ts + assessor.spec.ts |

## Manager

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| M1 | 跨库消费 assessor.outbox（requirement.created） | ✅ 已实现 | server/main.ts processOutbox(ASSESSOR_DATABASE_URL) | requirement.e2e.test.ts |
| M2 | 需求 7 态状态机、原子更新与并发修订 | ✅ 已实现：统一手工/PR 迁移规则、expectedRevision 冲突、同状态 PR no-op | apps/manager/server/src/requirement-policy.ts + apps/manager/server/src/requirement.repo.ts | apps/manager/server/src/requirement-foundation.e2e.test.ts |
| M3 | 三来源标签（Assessor/手动/GitHub Phantom） | ✅ 已实现 | server/requirement.repo.ts source 字段三枚举 | unit + requirement.e2e.test.ts |
| M4 | PR 状态联动刷新与持久 Webhook | ✅ 已实现：生产强制 HMAC、持久 delivery 租约、过期恢复、按 PR updated_at 防乱序 | apps/manager/server/src/webhook.controller.ts + apps/manager/server/src/webhook.repo.ts + apps/manager/server/migrations/010_github_sync_and_webhooks.sql | apps/manager/server/src/webhook.controller.spec.ts + apps/manager/server/src/webhook.persistence.e2e.test.ts + apps/manager/server/src/requirement-foundation.e2e.test.ts |
| M5 | GitHub Issues 分页同步与更新 | ✅ 已实现：100×20 分页、排除 PR、既有 Issue 内容更新与并发冲突计数 | apps/manager/server/src/github/client.ts + apps/manager/server/src/requirement.service.ts | apps/manager/server/src/github/client.test.ts + apps/manager/server/src/requirement.e2e.test.ts |
| M6 | 迭代管理（CRUD + 需求关联） | ✅ 已实现 | server/iteration.*, web/pages/IterationList.tsx | iteration.e2e.test.ts |
| M7 | 前台 FLIGHT DECK 七泳道看板 | ✅ 已实现 | web/pages/RequirementBoard.tsx COCKPIT_THEME | manager.spec.ts 页面渲染 |
| M8 | 前台 RequirementDetail 飞行日志 | ✅ 已实现 | web/pages/RequirementDetail.tsx 仪表卡 + 时间线 | — |
| M9 | 后台需求管理表格 + 迭代管理 | ✅ 已实现 | RequirementList.tsx + IterationList.tsx AdminShell | manager.spec.ts |
| M10 | 候选预览、确认与剩余批次 | ✅ 已实现：来源校验、事务去重与冲突回滚；不授权自动开发 | apps/manager/server/src/import.service.ts + apps/manager/web/src/pages/CandidateImport.tsx | apps/manager/server/src/import-batch.e2e.test.ts + apps/manager/web/src/pages/RequirementList.test.tsx + e2e/tests/manager-import.spec.ts |
| M11 | 独立能力基线与规划证据 | ✅ 已实现：基线不进入需求队列；规划保留证据/验收/依赖 | apps/manager/web/src/pages/CapabilityList.tsx + apps/manager/web/src/pages/RequirementDetail.tsx | apps/manager/server/src/import-batch.e2e.test.ts |
| M12 | 内容修订与版本比较 | ✅ 已实现：触发器快照、迁移回填标记、分页与完整内容对比 | apps/manager/server/src/requirement-revisions.repo.ts + apps/manager/web/src/pages/RequirementHistory.tsx | apps/manager/server/src/requirement-revisions.e2e.test.ts + apps/manager/web/src/pages/RequirementApproval.test.tsx |
| M13 | 固定版本审批与撤销 | ✅ 已实现：双版本冲突、凭证校验、内容变更失效、追加审计；不启用自动执行 | apps/manager/server/src/requirement-approval.service.ts + apps/manager/web/src/pages/RequirementContentPanel.tsx | apps/manager/server/src/requirement-revisions.e2e.test.ts + e2e/tests/manager-approval.spec.ts |
| M14 | 执行契约与自动执行门禁 | ✅ 已实现：仓库/路径/命令/时长/尝试/预算进入内容修订；未批准、状态不对、依赖未就绪或未启用自动执行均阻塞 | apps/manager/server/src/requirement.service.ts + apps/manager/server/migrations/008_requirement_execution_contract.sql + apps/manager/web/src/pages/RequirementContentEditor.tsx | apps/manager/server/src/requirement-execution.e2e.test.ts + apps/manager/web/src/pages/RequirementApproval.review.test.tsx |

## Gatherer

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| G1 | 三类源（RSS / JSON / 网页选择器） | ✅ 已实现 | server/feed/parser.ts（rss-parser + 原生 JSON + cheerio） | parser.test.ts + source.e2e.test.ts |
| G2 | 试采 | ✅ 已实现 | source.service.ts testCollect() | source.e2e.test.ts |
| G3 | Cron 调度与运行回执（node-cron） | ✅ 已实现：API 变更后刷新注册、返回实际注册状态与最近 run 终态/计数 | server/scheduler.ts + source.controller.ts + item.repo.ts | scheduler.test.ts + source.e2e.test.ts |
| G4 | 管道：解析→去重→LLM 富化→入库 | ✅ 已实现 | collect.service.ts pipeline() | parser.test.ts + unit |
| G5 | 去重（contentFingerprint） | ✅ 已实现 | @mt/utils.contentFingerprint + source.repo.ts 唯一索引 | unit |
| G6 | LLM 富化（title/summary/content/category/keywords） | ✅ 已实现 | llm.ts enrichItem() | llm.test.ts |
| G7 | 推送 Scholar（knowledge.item.collected）D1 | ✅ 已实现：手动/自动推送、item ID 稳定事件键、已推送条目跳过 | ItemList.tsx 按钮 + collect.service.ts + gatherer/outbox + 收件箱文案 | gatherer.spec.ts + source.e2e.test.ts |
| G8 | 前台报刊风报头 | ✅ 已实现 | web/App.tsx PRESS_THEME（直跳后台） | — |
| G9 | 后台 SourceList 编辑列（D3） | ✅ 已实现 | web/pages/SourceList.tsx Modal + PATCH /sources/:id | — |
| G10 | 调度实况与死信追踪 | ✅ 已实现：注册状态、最近 run 回执、死信事件状态与尝试次数 | server/scheduler.ts + operations.repo.ts + web/pages/SourceList.tsx | SourceList.test.tsx + source.e2e.test.ts |

## Scholar

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| Sc1 | 跨库消费 gatherer.outbox 收件箱 | ✅ 已实现 | inbox.controller/service.ts, main.ts processOutbox(GATHERER_DB) | inbox.e2e.test.ts |
| Sc2 | 收件箱审核入库 | ✅ 已实现 | inbox.service.ts approve() → Entry | inbox.e2e.test.ts |
| Sc3 | 三来源条目（gatherer/manual/obsidian）CRUD | ✅ 已实现 | entry.controller/repo.ts source 字段 | entry.e2e.test.ts |
| Sc4 | 分类 + 标签管理 | ✅ 已实现 | entry.repo.ts category/tags 列 + admin/entries 编辑 | entry.e2e.test.ts |
| Sc5 | 圈定（AssistantScope 开关） | ✅ 已实现 | entry PATCH assistantScope + scholar/admin/entries 书签按钮 | scholar.spec.ts 圈定 PATCH 断言 |
| Sc6 | 全文检索（pg_trgm FTS） | ✅ 已实现 | search.service.ts ftsSearch() + to_tsvector | scholar.spec.ts fts 接口 |
| Sc7 | 向量检索（pgvector + embedding-2 1024） | ✅ 已实现（桩模式伪向量） | search.service.ts vectorSearch() + embed() | scholar.spec.ts vector 接口 |
| Sc8 | 双通道切换 UI | ✅ 已实现 | web/pages/SearchPage.tsx 目录卡 + FTS/VECTOR 切换器 | SearchPage.test.tsx |
| Sc9 | LLM 图谱抽取（实体/关系）+ 重建 | ✅ 已实现 | graph.service.ts generateGraph() + rebuild() | graph.e2e.test.ts |
| Sc10 | 图谱查询 + 展示 | ✅ 已实现（PR #38：G6 5.1.1，drag-canvas/drag-element/zoom-canvas/click-select 四行为，详情面板 SelectedNodePanel/SelectedEdgePanel） | GraphPage.tsx G6 力导向图 + 节点拖拽 + 边可点击 + 详情面板 | GraphPage.test.tsx 2 tests |
| Sc11 | Obsidian Vault 同步（路径去重 + 冲突合并） | ✅ 已实现（PR #43：保留库/采用库外/合并编辑 + SettingsPage 冲突表格） | obsidian.controller/service.ts scanVault() + content_hash 冲突检测 + 三策略解决 | obsidian.e2e.test.ts + obsidian.service.spec.ts 7 tests |
| Sc12 | 前台书目检索（卡片）+ 馆藏目录（书卷）+ 图谱 | ✅ 已实现 | SearchPage/EntryList/GraphPage 三页深度主题 | scholar.spec.ts 页面渲染 |
| Sc13 | 后台条目五项字段编辑（D3） | ✅ 已实现 | admin/entries 页面 Modal（title/summary/content/category/tags） | EntryList.test.tsx |
| Sc14 | 前台 EntryList 书签式圈定 | ✅ 已实现 | EntryList.tsx 圈定按钮 + 视觉书签样式 | EntryList.test.tsx |
| Sc15 | 开发/产品知识空间、不可变修订与版本发布 | ✅ 已实现：公共 API 固定 product/public/published/current version，发布绑定来源修订与部署标识；发布后编辑不改变线上快照；成员可读授权空间，撤权/下架/删除清理授权、发布、图谱与向量 | server/knowledge-space.* + server/admin-auth.ts + server/entry.repo.ts + migrations/003_knowledge_spaces.sql + server/search.repo.ts | knowledge-space.e2e.test.ts 4 tests |

## Assistant

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| As1 | 双层意图路由（系统归属→域内） | ✅ 已实现 | intent.service.ts classify() 规则+模型双轨 | intent.service.test.ts + routing.spec.ts |
| As2 | 6 类意图：product_inquiry / data_query / process_execution / trouble_shooting / complaint_feedback / chitchat_reject | ✅ 已实现 | intent.service.ts + 对应 6 个 service | assistant-intents.spec.ts 6 用例 |
| As3 | 置信度输出 + 低置信度澄清反问闭环 | ✅ 已实现 | intent.service.ts {confidence} + clarify.e2e.test.ts | clarify.e2e.test.ts + ChatPage.clarify.test.tsx |
| As4 | product_inquiry → Scholar 圈定条目 + 引用回答 | ✅ 已实现 | knowledge.service.ts fetchScoped() + 引用段落拼接 | chat.e2e.test.ts 带引用断言 |
| As5 | data_query → cybercloud 真实对接（SPKI/JWT/双头） | ✅ 已实现（实测 testcybercloud-dev 打通） | cybercloud.service.ts + 401 自动重登 | data-query.e2e.test.ts（CYBERCLOUD_STUB） |
| As6 | process_execution → 网关调 Manager 建需求 / Gatherer 采触发 | ✅ 已实现 | action.service.ts process_execution branch + gateway 反代 | action.e2e.test.ts |
| As7 | trouble_shooting → 全服务健康探测聚合 + LLM 建议 | ✅ 已实现 | trouble.service.ts probeAll() + llm 排障 | trouble.e2e.test.ts |
| As8 | complaint_feedback → 落库 + Web 可查 | ✅ 已实现 | feedback.* + pages/FeedbackPage.tsx | feedback.e2e.test.ts |
| As9 | 多轮对话持久化 + 指代消解 | ✅ 已实现 | conversation.repo.ts + chat.service.ts contextWindow | multi-turn.e2e.test.ts |
| As10 | 意图日志可观测 + 纠错回填 | ✅ 已实现 | intent-log.* + pages/IntentLogPage.tsx | intent-log.e2e.test.ts |
| As11 | 前台极简双栏对话气泡 | ✅ 已实现 | pages/ChatPage.tsx 异形圆角 + 引用区 + 署名 | ChatPage.test.tsx |
| As12 | HTTP API 双入口 | ✅ 已实现 | chat.controller.ts HTTP + web 入口 | chat.e2e.test.ts |
| As13 | 纠错回填到训练语料 | ✅ 已实现 | intent-log PATCH /intent-logs/:id 覆盖路由 | intent-log.e2e.test.ts |
| As14 | 独立问答评测集与版本比较 | ✅ 已实现 | server/evaluation-suite.* + server/evaluation-scoring.ts + migrations/006_assistant_evaluation_suite.sql + web/pages/IntentLogPage.tsx | evaluation-scoring.test.ts + evaluation-suite.e2e.test.ts + IntentLogPage.evaluation.test.tsx |
| As15 | badcase 到需求再到回归闭环 | ✅ 已实现 | server/badcase.* + server/trace.repo.ts + migrations/007_assistant_badcases.sql + web/pages/BadcasePage.tsx + manager migrations/012_assistant_badcase_source.sql | badcase.e2e.test.ts + clarify.e2e.test.ts + requirement-foundation.e2e.test.ts + BadcasePage.test.tsx |

## Designer

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| D1 | 自然语言 → @mt/ui 令牌组件源码 | ✅ 已实现 | generate.service.ts + llm.ts genComponent() | generate.e2e.test.ts |
| D2 | 设计稿图片 → 组件（视觉模型） | ✅ 已实现（桩模式跳过视觉） | generate.controller.ts vision 分支上传 | generate.e2e.test.ts |
| D3 | esbuild 沙箱预览 | ✅ 已实现 | preview.service.ts（React+TSX → HTML 字符串） | preview.e2e.test.ts + preview.service.test.ts |
| D4 | 组件审核入库 → @mt/ui 候选池 | ✅ 已实现 | component.* + ComponentRepo + admin/components | components.e2e.test.ts |
| D5 | 生成历史记录 | ✅ 已实现 | generation.repo.ts + pages/HistoryList.tsx | GeneratePage.test.tsx |
| D6 | 前台画廊委托单 + 预览展位 | ✅ 已实现 | pages/GeneratePage.tsx GALLERY_THEME 委托卡 + 展品卡 | GeneratePage.test.tsx |
| D7 | **可视化拖拽编辑器** | ✅ 已实现（deferred D-01 兑现：三栏画布，dnd-kit 拖拽 + 双击同源兜底，8 组件注册表；2026-09-11 补 CanvasDropZone droppable 注册修复拖拽放置断链 + 2 条真实指针拖拽 e2e） | apps/designer/web/src/pages/studio/StudioPage.tsx + Palette.tsx + CanvasDropZone.tsx + CanvasRenderer.tsx + PropForm.tsx + canvas/schema.ts + canvas/registry.ts | designer.spec.ts 画布工坊 6 用例 + StudioPage.test.tsx 8 用例 |
| D8 | **实时双向编辑** | ✅ 已实现（deferred D-02 兑现：schema→code 确定性生成 + code→schema 显式应用；components/generations 落 schema jsonb 列） | apps/designer/web/src/canvas/codegen.ts + pages/studio/CodePanel.tsx + apps/designer/server/src/parse.service.ts（@babel/parser 白名单逆向）+ GeneratePage「送入画布」 | codegen.test.ts 5 用例 + parse.service.spec.ts 8 用例 + components.e2e.test.ts schema 用例 |
| D9 | **一键发布到 npm / PR 到 @mt/ui** | ✅ 已实现（deferred D-04 兑现，PR #42：createBranch/createFile/createPr 三步流，PAT + GITHUB_STUB 桩） | apps/designer/server/src/publish.service.ts + publish.controller.ts + github/client.ts + ComponentList「一键 PR」按钮 | publish.service.spec.ts 4 用例 + components.e2e.test.ts |

## 公共能力 & 工程化

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| C1 | 四层测试体系（单元/冒烟/回归/E2E） | ✅ 已实现 | Vitest + smoke.mjs + Turbo --affected + Playwright | — |
| C2 | CI 3 门禁（quality/smoke/e2e）+ main 保护 | ✅ 已实现 | .github/workflows/ci.yml + branch protection | — |
| C3 | outbox 租约、批处理与幂等 | ✅ 已实现：并发互斥、领取计数、租约恢复、副作用后 done、稳定业务键幂等、失败 retry/dead；测试见 packages/db/src/outbox.test.ts、Assessor request e2e 与 Manager requirement e2e | packages/db/src/outbox.ts + packages/db/migrations/002_outbox_lease.sql + apps/manager/server/src/requirement.service.ts + apps/assessor/server/src/request.service.ts + apps/scholar/server/src/inbox.service.ts | — |
| C4 | @mt/model-client parseJson 四级容错 | ✅ 已实现，5 服务替换 | model-client/parseJson.ts | — |
| C5 | 前后台双外壳（前台各异 / 后台统一） | ✅ 已实现（8 应用全覆盖） | @mt/ui UserShell / AdminShell + 8 App.tsx 切换 | — |
| C6 | 0 bug loop 开发/测试分拆验收 | ✅ 已实现（D-11 兑现，PR #36） | PR 模板复选框 + .github/workflows/ci.yml quality 条件检测（仅 PR 事件） | — |
| C7 | 视觉样式回归测试 | ✅ 已实现（PR #35/#44/#45 建立双平台闭环；P14 增加真实业务样板并减少核心区遮罩） | e2e/tests/_visual.spec.ts Playwright toHaveScreenshot 20 张 + 平台基线感知守卫 + 样板核心业务断言 | — |
| C8 | 前端硬编码色值静态检查 | ✅ 已实现（PR #35） | infra/eslint/rules/no-hardcoded-colors.mjs | — |
| C9 | 通用页面模式库（patterns） | ✅ 已实现（PR #35/#40，含 patterns.test.tsx 8 用例） | packages/ui/src/patterns/（MagazineList/ControlTable/DetailHero/TimelineBurndown） | — |
| C10 | ThemePreview 主题横向对比 | 🚫 未实现（后续 P2，无 deferred 编号） | — | — |
| C11 | 全项目关键数据库强制验证与普通单测边界 | ✅ 已实现：每文件隔离主库/上游、无缓存、skip=0、清单漏项拒绝；database-validation.review.test.mjs 独立验收 | infra/scripts/test-database.mjs + infra/testing/database-suites.json + infra/testing/unit-database-boundary.mjs | — |
| C12 | 候选提交与运行绑定的质量证据 | ✅ 已实现：候选/checkout/base/run/mode绑定、工作树漂移拒绝、完整数据库明细重算与失败artifact；quality-evidence.review.test.mjs 独立验收 | infra/scripts/quality-gate.mjs + infra/scripts/lib/quality-evidence.mjs | — |
| C13 | 功能映射与接口事实索引 | ✅ 已实现：coverage-matrix 解析、Gateway 字面/动态/认证入口与业务服务接口扫描、生成物漂移守卫与历史设计标识守卫 | infra/scripts/lib/docs-facts.mjs + infra/scripts/lib/docs-facts.test.mjs + docs/generated/feature-map.md + docs/generated/coverage-view.md + docs/generated/interface-index.md | — |

## 2026-09 增量

| ID | 功能 | 状态 | 代码定位 | 测试证据 |
|---|---|---|---|---|
| P03 | 独立镜像、迁移就绪、断连恢复、Web与业务持久化 | ✅ PR72已合并，两份干净SHA、最终候选和main CI均已验证 | infra/scripts/build-images.mjs + infra/scripts/validate-runtime.mjs + packages/db/src/readiness.ts | — |
| P04 | 八库备份、认证加密、独立恢复与应用交接 | ✅ PR #74 已合并（761152b）：正式11项实机和清理、独立18项回读、CI三段绿；物理异地与生产调度未验证 | infra/scripts/backup.mjs + infra/scripts/validate-backup.mjs + infra/scripts/lib/backup-local.mjs + infra/scripts/lib/backup-ssh.mjs + infra/scripts/lib/backup-handoff.mjs + infra/scripts/lib/recovery-receipt.mjs + infra/scripts/validate-recovery-deployment.mjs | — |
| P05 | SHA与registry digest、部署回执、失败恢复及回退 | ✅ 两SHA升级/故障/回退8项通过，独立八库复验与102个registry对象核验通过；SSH适配器回归通过，生产SSH未验证 | infra/scripts/publish-images.mjs + infra/scripts/deploy-release.mjs + infra/scripts/deploy-ssh.mjs + infra/scripts/validate-deployment.mjs | — |
| P06 | 网关用户登录与服务身份细分 | ✅ 本批交付：三通道认证（GATEWAY_TOKEN 服务通道/服务 token/用户会话）、应用级授权、防暴破；gateway 44/44 + e2e 4/4 | apps/gateway/src/auth.ts + apps/gateway/src/users.ts + apps/gateway/src/session.ts + apps/assistant/server/src/action.service.ts + e2e/tests/gateway-auth.spec.ts | — |
| E1 | Assistant 双路数据查询（直连先行 + 智能体核验） | ✅ 已实现（PR #54，CYBERCLOUD_MODE=dual 默认） | apps/assistant/server/src/direct-query.service.ts + verify-task.registry.ts + chat.service.ts 双路编排 | chat.dual.e2e.test.ts 五终态场景 |
| E2 | 数值比对引擎（万/亿/k/% 归一 + 容差） | ✅ 已实现（PR #54） | apps/assistant/server/src/compare.service.ts | compare.service.test.ts |
| E3 | cybercloud_calls 双路调用监控 | ✅ 已实现（PR #54） | apps/assistant/server/migrations/004 + cybercloud-calls.repo.ts + IntentLogPage 监控卡 | cybercloud-calls.repo.test.ts + IntentLogPage.calls.test.tsx |
| E4 | ChatPage VerifyBadge 核验标签 | ✅ 已实现（PR #54） | apps/assistant/web/src/pages/ChatPage.tsx VerifyBadge（2s 轮询终态/404 停止） | ChatPage.verify.test.tsx |
| E5 | 真环境校准（四契约偏差修复） | ✅ 已实现（a851a68，140/140 绿） | direct-query 行分组兜底/包裹对象取值/取值键构造/空数据回答 0 | direct-query.service.test.ts |
| E6 | UI v2/v2.1/v2.2 令牌与组件基建 | ✅ 已实现（PR #47/#51） | packages/ui/src/tokens.ts v2 系 + MtStatusTag + MtKpiRow + patterns 单测 | @mt/ui 22 用例 + e2e 视觉基线 |
| E7 | UI v2.3 全量页面重构（17 页设计稿） | ✅ 已实现（PR #56 前身，squash ef9821d） | packages/ui/src/AdminShell.tsx + UserShell.tsx v2.3 + 8 应用前后台全页 + gateway 落地页 + 3 交互演示 | e2e 全量 83 passed + 视觉 16/16 |
| E8 | 五道质量防线（v2.3.1） | ✅ 已实现（PR #56，0 bug loop 验收通过） | e2e/tests/responsive.spec.ts（32 用例）+ .githooks/pre-commit + turbo ^build + packages/ui/src/apps.ts 文案单源 + 视觉锚点 fail fast | responsive 32/32 + drift guard 用例 |
| E9 | Designer 画布工坊（D-01/D-02 兑现） | ✅ 已实现（2026-09-10，拖拽画布 + 双向编辑闭环） | apps/designer/web/src/canvas/{schema,registry,codegen}.ts + pages/studio/ 四组件 + apps/designer/server/src/parse.service.ts + migrations/002_canvas_schema.sql | designer.spec.ts +4 用例；视觉基线 18 张 |
| E10 | Assistant LoRA 微调编排层（D-09 兑现） | ✅ 已实现（2026-09-10，FT_STUB 桩全链路；真跑需样本 ≥500 + FT_LAUNCH_ENABLED=1 + 智谱 Pro 权益） | packages/model-client/src/finetune.ts + apps/assistant/server/src/finetune.{service,repo}.ts + migrations/005_finetune_jobs.sql + IntentLogPage 微调卡 | finetune.test.ts 5 用例 + finetune.service.spec.ts 5 用例 + IntentLogPage.finetune.test.tsx 3 用例 |
| E11 | E2E 真实页面样板与键盘导航 | ✅ 已实现：Manager 详情 / Assistant 长对话 / Scholar 帮助目录固定数据，核心业务断言与会话键盘操作 | e2e/fixtures/business-samples.ts + e2e/fixtures/pages.ts + e2e/tests/{_visual,business-keyboard}.spec.ts + ChatPage.tsx | ChatPage.test.tsx + llm.test.ts + business-keyboard.spec.ts + _visual.spec.ts |
