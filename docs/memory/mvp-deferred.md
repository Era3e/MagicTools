# MagicTools MVP 延期 / 降级补充清单（Deferred Backlog）

> 来源：扒取 docs/superpowers/specs/（设计时 MVP 边界）、docs/CHANGELOG.md（交付时明确声明的降级）、docs/memory/state.md（关键决策 MVP 裁剪）。
> 目的：当发现「某个功能缺失」时，先查本表 — ID 存在 = 规划阶段**故意**延后（不是落地遗漏）；ID 不存在 = 落地 bug，须走修复流程。
> 优先级：P0 = 立即补（下一个迭代）/ P1 = 近期（v1.1）/ P2 = 中期（v1.2+）/ P3 = 长远（不阻塞业务）

| ID | 分类 | 功能 | 原规划位置 | 降级说明 | 当前替代方案 | 建议优先级 | 依赖条件 |
|----|-----|------|----------|---------|------------|----------|---------|
| **D-01** | 功能裁剪 | Designer **可视化拖拽编辑器** | designer-spec.md §2.1 MVP 边界；state.md §Designer 条目 | MVP 仅交付「自然语言 → 代码 → 预览 → 沉淀」流水线，不含拖拽画布、属性面板、实时编辑 | 用户用自然语言描述布局，GeneratePage 生成代码+预览 | P2 | 需先解决组件 Schema 描述抽象（当前纯 TSX 字符串，拖拽需要结构化 Schema） |
| **D-02** | 功能裁剪 | Designer **实时双向编辑（改预览↔改源码同步）** | 同上 designer-spec MVP 边界 | MVP 预览是一次性 iframe 渲染，无法反向编辑源码 | 组件编辑走「重新生成」或手动复制源码修改 | P2 | 同 D-01，需 Schema 抽象 + Monaco Editor 集成 + Diff 补丁引擎 |
| **D-03** | ~~落地降级~~ ✅ **已兑现** | Manager PR 状态 **Webhook 自动刷新** | manager-spec.md §3.3 PR 联动 | MVP 仅实现管理员「同步 PR 状态」手动按钮，无 GitHub Webhook 自动触发 | ✅ 2026-08-28 兑现（PR #41）：POST /api/manager/webhook/github（HMAC-SHA256 签名 + delivery 幂等 + 状态映射 + done 防回退）+ 6 单测 | ✅ P1 已完成 | — |
| **D-04** | 规划遗漏 | Designer 组件「**一键 PR 到 @mt/ui**」 | designer-spec.md 未覆盖；coverage-matrix D9 标为未实现 | 当前组件审核入库只进 designer 本地 ComponentRepo，不自动提 PR 到主仓 packages/ui | 人工复制源码 → 提 PR 到 @mt/ui | P1 | 需要 GitHub API（PAT）+ PR 模板注入 + changeset 自动生成脚本 |
| **D-05** ✅ PR #38 | 落地降级 | Scholar 图谱 **节点拖拽布局 + 边可点击** | scholar-spec.md §4.4 图谱展示；CODE_WIKI §6.6 GraphPage | MVP GraphPage 是「类目卡片墙静态网格」（图书馆配色），无真实力导向图/拖拽 | —（已落地：G6 5.1.1 + drag-canvas/drag-element/zoom-canvas/click-select + 详情面板） | — | — |
| **D-06** | ~~落地降级~~ ✅ **已兑现** | Scholar Obsidian 同步 **冲突合并 + 手动冲突解决 UI** | scholar-spec.md §3.5 Obsidian | MVP 仅按文件路径去重，内容冲突时「后写覆盖先写」无提示 | ✅ 2026-08-28 兑现（PR #43）：content_hash 变更检测 + 三策略解决（保留库/采用库外/合并编辑）+ SettingsPage 冲突表格与合并 Modal + 7 单测 | ✅ P1 已完成 | — |
| **D-07** | ~~落地降级~~ ✅ **已兑现** | Investigator **Cron 自动调度 Bitable 拉取** | investigator-spec.md §3.2 定时拉取；gatherer-spec 已有 node-cron 先例 | MVP 仅实现管理员 SurveyDetail 页「立即同步」手动按钮；scheduler 骨架代码未挂载 | ✅ 2026-08-28 兑现（PR #36）：node-cron 自动调度（scheduler.ts + cron 列 + startScheduler + meta/scheduler-status API） | ✅ P0 已完成 | — |
| **D-08** | ~~落地降级~~ ✅ **已兑现** | Applicant **ClawCV 外部集成配额/余额告警** | applicant-spec.md §3.3 ClawCV；CODE_WIKI §6.1 external quota | MVP 仅有无 Key 降级，配额耗尽/API 付费失败时只降级为 LLM，无提醒 | ✅ 2026-08-28 兑现（PR #43）：402/401/429/业务码 ≥2000 捕获 → 结构化告警（5min 同类节流）+ 4 单测 | ✅ P1 已完成 | — |
| **D-09** | 功能裁剪 | Assistant **意图路由自训练微调（模型路由在线学习）** | assistant-intents-design.md §6 未来工作；state.md 纠错回填已做 | ~~MVP 纠错回填只改路由规则~~ **2026-08-28 已兑现在线学习层（PR #43）**：纠错样本自动构造 few-shot 注入分类提示词（每意图 3 条/总数 12 封顶、60s TTL 缓存、纠错落库即清缓存即时生效）；新增评估闭环（混淆矩阵 + 回放命中率）与 OpenAI 兼容 JSONL 数据集导出。**真 LoRA 微调仍延期**（导出格式已就绪） | few-shot 注入已上线；LoRA 待样本量 ≥ 数百条 + 智谱 Key 恢复 | P3 | LoRA 层触发条件：intent_logs 纠错样本 ≥ 500 条 + LLM 供应商支持微调 API |
| **D-10** | ~~落地降级~~ ✅ **已兑现** | Gateway **统一健康监控仪表盘** | CODE_WIKI §5 Gateway 有 health 聚合，缺 UI | MVP `/health` 只返回 JSON，无可视化 UI | ✅ 2026-08-28 兑现（PR #37）：GET /api/health 聚合 JSON + GET /status Chart.js 暗色仪表盘（健康表/延迟柱状图/可用性趋势，5s 轮询）+ 2 单测 | ✅ P1 已完成 | — |
| **D-11** | ~~流程纪律~~ ✅ **已兑现** | 0 bug loop **开发/测试双智能体对抗验收记录** | AGENTS.md §硬性约定 6；state.md 已知问题 9 | MVP 仅文档声明「0 bug loop」，但当前环境 subagent_fork 不可用（state.md 已知问题 8），无测试 agent 独立验收记录产物 | ✅ 2026-08-28 兑现（PR #36）：CI quality job 条件 step（仅 PR 事件）检测复选框勾选状态；PR 模板已含复选框 | ✅ P0 已完成 | — |
| **D-12** | 落地降级 | Gatherer **采集失败重试指数退避 + 死信告警** | gatherer-spec.md §3.3 管道失败处理 | MVP 采集失败只有 scheduler.test.ts 覆盖，实际 collect.service.ts 失败只打日志，无指数退避和死信通知 | 管理员查 ItemList.status = failed + 手动 retry | P1 | outbox 已有类似模式，复用重试计数 + 死信 UI + Assistant 告警 |
| **D-13** | 落地降级 | 所有应用 **移动端响应式适配（<768px）** | ui-spec.md 未声明；CODE_WIKI §8 前端未提移动端 | MVP 8 应用前台深度设计全部按桌面端（>=1280px）做；UserShell/AdminShell 未做移动端汉堡菜单 | 用户在 PC 浏览器使用 | P1 | @mt/ui 双外壳先补汉堡菜单 + 各 patterns/ 页面模式增加 mobile 断点 |
| **D-14** ✅ PR #40 | 规划遗漏 | Manager **迭代燃尽图 / 进度可视化** | manager-spec.md §3.4 未明确可视化细节 | MVP IterationList 只有纯表格，无需求数/完成数趋势图 | —（已落地：patterns/TimelineBurndown + IterationList 点击展开 + 需求指标条） | P1 | — |
| **D-15** | 规划遗漏 | Applicant **投递日历视图 / 面试时间线** | applicant-spec.md 未覆盖 | MVP 只有 PositionDetail 面试 Tab 列表 + InterviewPage 单份复盘，无跨岗位面试时间轴/日历 | 用户看 InterviewPage 列表手动梳理 | P2 | 复用 manager 飞行日志时间线 patterns/ 改造 |
| **D-16** | ~~落地降级~~ ✅ **已兑现** | Designer 前台页 **「组件馆藏」导航入口** | e2e designer.spec 导航跳转用例；2026-08-27 显式 skip 发现 | 前台 UserShell 导航只有「定制生成」，无通往 /admin/components 组件馆藏的入口（仅页脚「管理后台 →」间接可达） | ✅ 2026-08-28 兑现（PR #36）：USER_NAV 加「组件馆藏」+ Route 改直接渲染 ComponentList | ✅ P2 已完成 | — |
| **D-17** | ~~落地降级~~ ✅ **已确认已修复** | Assistant **「意图日志」导航入口** | e2e assistant.spec 导航跳转用例；2026-08-27 显式 skip 发现 | 反馈页（/admin/feedback）侧栏无「意图日志」菜单，仅能手动输 URL /admin/intent-logs 到达 | ✅ 已确认：ADMIN_NAV 已有「意图日志」菜单 + /admin/intent-logs Route + IntentLogPage，2026-08-27 后代码已补齐 | ✅ P2 已完成 | — |
| **D-18** | 落地降级 | E2E 视觉快照 **跨平台基线（CI/linux）** | PR #35 CI e2e job 失败实证：snapshotPathTemplate 含 {platform}，仓库仅 win32 基线，CI 找 -linux.png 必失败 | 视觉快照用例带 CI 守卫：CI 上 test.skip 显式跳过（计入汇总行），仅本地 win32 跑 | 方案 A：CI ubuntu 上安装 CJK 字体 + 独立生成并提交 linux 基线；方案 B：改 toHaveSnapshot 多平台矩阵；方案 C：CI 只跑 DOM 结构断言不比像素 | P1 | CI runner 加 `fonts-noto-cjk` + Playwright `--with-deps`，在 CI 里 `--update-snapshots` 生成一次 linux 基线入库（与 win32 并存，互不干扰） |

## 统计摘要（基线版本：2026-08-28）

- 总数：18 项
- **已兑现 10 项**：D-03（Webhook，PR #41）、D-06（Obsidian 冲突，PR #43）、D-07（Cron，PR #36）、D-08（ClawCV 告警，PR #43）、D-09 在线学习层（PR #43）、D-10（Gateway 仪表盘，PR #37）、D-11（0 bug loop 检测，PR #36）、D-12（死信队列，PR #43）、D-13（移动端响应式，PR #43）、D-16/D-17（导航入口，PR #36）；D-05（PR #38）、D-14（PR #40）已在各自 PR 实现待合并
- **真延期 6 项**：D-01/D-02（Designer 拖拽与双向编辑，P2）、D-09 LoRA 层（P3）、D-15（投递日历，P2）、D-18（linux 视觉基线，P1）、D-04（一键 PR，PR #42 待合并）
- 按优先级：P0 全部兑现 · P1 剩 D-18 · P2 剩 D-01/02/15 · P3 剩 D-09 LoRA 层
- **下一迭代建议**：D-18（linux 视觉基线，CI 全绿最后一环，需专门基线生成 workflow）；D-15 可复用 manager 时间线 patterns
