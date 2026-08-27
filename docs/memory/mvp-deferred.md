# MagicTools MVP 延期 / 降级补充清单（Deferred Backlog）

> 来源：扒取 docs/superpowers/specs/（设计时 MVP 边界）、docs/CHANGELOG.md（交付时明确声明的降级）、docs/memory/state.md（关键决策 MVP 裁剪）。
> 目的：当发现「某个功能缺失」时，先查本表 — ID 存在 = 规划阶段**故意**延后（不是落地遗漏）；ID 不存在 = 落地 bug，须走修复流程。
> 优先级：P0 = 立即补（下一个迭代）/ P1 = 近期（v1.1）/ P2 = 中期（v1.2+）/ P3 = 长远（不阻塞业务）

| ID | 分类 | 功能 | 原规划位置 | 降级说明 | 当前替代方案 | 建议优先级 | 依赖条件 |
|----|-----|------|----------|---------|------------|----------|---------|
| **D-01** | 功能裁剪 | Designer **可视化拖拽编辑器** | designer-spec.md §2.1 MVP 边界；state.md §Designer 条目 | MVP 仅交付「自然语言 → 代码 → 预览 → 沉淀」流水线，不含拖拽画布、属性面板、实时编辑 | 用户用自然语言描述布局，GeneratePage 生成代码+预览 | P2 | 需先解决组件 Schema 描述抽象（当前纯 TSX 字符串，拖拽需要结构化 Schema） |
| **D-02** | 功能裁剪 | Designer **实时双向编辑（改预览↔改源码同步）** | 同上 designer-spec MVP 边界 | MVP 预览是一次性 iframe 渲染，无法反向编辑源码 | 组件编辑走「重新生成」或手动复制源码修改 | P2 | 同 D-01，需 Schema 抽象 + Monaco Editor 集成 + Diff 补丁引擎 |
| **D-03** | 落地降级 | Manager PR 状态 **Webhook 自动刷新** | manager-spec.md §3.3 PR 联动 | MVP 仅实现管理员「同步 PR 状态」手动按钮，无 GitHub Webhook 自动触发 | 管理员在 RequirementList 点「同步」按钮 | P1 | 需要 GitHub App webhook endpoint（Nest controller）+ 签名校验 + 幂等；需部署环境 GitHub 可达 |
| **D-04** | 规划遗漏 | Designer 组件「**一键 PR 到 @mt/ui**」 | designer-spec.md 未覆盖；coverage-matrix D9 标为未实现 | 当前组件审核入库只进 designer 本地 ComponentRepo，不自动提 PR 到主仓 packages/ui | 人工复制源码 → 提 PR 到 @mt/ui | P1 | 需要 GitHub API（PAT）+ PR 模板注入 + changeset 自动生成脚本 |
| **D-05** | 落地降级 | Scholar 图谱 **节点拖拽布局 + 边可点击** | scholar-spec.md §4.4 图谱展示；CODE_WIKI §6.6 GraphPage | MVP GraphPage 是「类目卡片墙静态网格」（图书馆配色），无真实力导向图/拖拽 | 用户用检索 + EntryList 书签圈定替代 | P1 | 需要 D3/ReactFlow + 节点 Schema 迁移（当前 nodes/edges 结构已足够，前端渲染升级即可） |
| **D-06** | 落地降级 | Scholar Obsidian 同步 **冲突合并 + 手动冲突解决 UI** | scholar-spec.md §3.5 Obsidian | MVP 仅按文件路径去重，内容冲突时「后写覆盖先写」无提示 | 用户在 Scholar 手动重新同步覆盖 | P1 | 需要 contentFingerprint 变更检测 + 三方向 diff（本地/Vault/DB）+ 冲突 Modal UI |
| **D-07** | 落地降级 | Investigator **Cron 自动调度 Bitable 拉取** | investigator-spec.md §3.2 定时拉取；gatherer-spec 已有 node-cron 先例 | MVP 仅实现管理员 SurveyDetail 页「立即同步」手动按钮；scheduler 骨架代码未挂载 | 管理员手动点「立即同步」 | P0（低工作量） | 复用 gatherer 的 node-cron 模式，在 main.ts setInterval 即可 |
| **D-08** | 落地降级 | Applicant **ClawCV 外部集成配额/余额告警** | applicant-spec.md §3.3 ClawCV；CODE_WIKI §6.1 external quota | MVP 仅有无 Key 降级，配额耗尽/API 付费失败时只降级为 LLM，无提醒 | 管理员查 server 日志错误信息 + 手动切 MT_LLM_STUB | P1 | 需要在 clawcv/client.ts 捕获 402/429 + outbox 发 warning 事件 + Assistant trouble_shooting 汇总 |
| **D-09** | 功能裁剪 | Assistant **意图路由自训练微调（模型路由在线学习）** | assistant-intents-design.md §6 未来工作；state.md 纠错回填已做 | MVP 纠错回填只改路由规则（规则层），不含模型 fine-tuning；路由仍用「规则优先 + 模型兜底」双轨 | 管理员在 IntentLogPage 手动纠错，下一次路由命中新规则 | P3 | 需要标注数据集积累（intent_logs 表数据）+ 小参数量 LoRA 训练流水线 + 部署更新 |
| **D-10** | 落地降级 | Gateway **统一健康监控仪表盘** | CODE_WIKI §5 Gateway 有 health 聚合，缺 UI | MVP `/health` 只返回 JSON，无可视化 UI；Assistant trouble_shooting 是文字版替代 | Assistant 问「系统状态怎么样」走 trouble_shooting | P1 | 在 gateway 挂一个 `/status` 静态页（HTML+Chart.js）轮询 9 服务 health |
| **D-11** | 流程纪律 | 0 bug loop **开发/测试双智能体对抗验收记录** | AGENTS.md §硬性约定 6；state.md 已知问题 9 | MVP 仅文档声明「0 bug loop」，但当前环境 subagent_fork 不可用（state.md 已知问题 8），无测试 agent 独立验收记录产物 | 开发 agent 自验 + CI 通过 + 人工 PR review | P0 | 本 PR 落地：PR 模板加「测试验收记录链接」强制勾选 + GitHub Actions 检测关键词 |
| **D-12** | 落地降级 | Gatherer **采集失败重试指数退避 + 死信告警** | gatherer-spec.md §3.3 管道失败处理 | MVP 采集失败只有 scheduler.test.ts 覆盖，实际 collect.service.ts 失败只打日志，无指数退避和死信通知 | 管理员查 ItemList.status = failed + 手动 retry | P1 | outbox 已有类似模式，复用重试计数 + 死信 UI + Assistant 告警 |
| **D-13** | 落地降级 | 所有应用 **移动端响应式适配（<768px）** | ui-spec.md 未声明；CODE_WIKI §8 前端未提移动端 | MVP 8 应用前台深度设计全部按桌面端（>=1280px）做；UserShell/AdminShell 未做移动端汉堡菜单 | 用户在 PC 浏览器使用 | P1 | @mt/ui 双外壳先补汉堡菜单 + 各 patterns/ 页面模式增加 mobile 断点 |
| **D-14** | 规划遗漏 | Manager **迭代燃尽图 / 进度可视化** | manager-spec.md §3.4 未明确可视化细节 | MVP IterationList 只有纯表格，无需求数/完成数趋势图 | 管理员看 RequirementBoard 七泳道手动估算 | P1 | patterns/ 新增 TimelineBurndown + manager 前台 RequirementDetail 嵌入 |
| **D-15** | 规划遗漏 | Applicant **投递日历视图 / 面试时间线** | applicant-spec.md 未覆盖 | MVP 只有 PositionDetail 面试 Tab 列表 + InterviewPage 单份复盘，无跨岗位面试时间轴/日历 | 用户看 InterviewPage 列表手动梳理 | P2 | 复用 manager 飞行日志时间线 patterns/ 改造 |
| **D-16** | 落地降级 | Designer 前台页 **「组件馆藏」导航入口** | e2e designer.spec 导航跳转用例；2026-08-27 显式 skip 发现 | 前台 UserShell 导航只有「定制生成」，无通往 /admin/components 组件馆藏的入口（仅页脚「管理后台 →」间接可达） | 用户走页脚「管理后台 →」再点侧栏 | P2（低工作量） | designer App.tsx UserShell nav 增加一项即可 |
| **D-17** | 落地降级 | Assistant **「意图日志」导航入口** | e2e assistant.spec 导航跳转用例；2026-08-27 显式 skip 发现 | 反馈页（/admin/feedback）侧栏无「意图日志」菜单，仅能手动输 URL /admin/intent-logs 到达 | 用户手动输入 URL | P2（低工作量） | assistant AdminShell 侧栏 nav 增加意图日志项 |

## 统计摘要（基线版本：2026-08-27）

- 总数：17 项
- 按来源：**功能裁剪（规划时决定不做 MVP）** 4 项（D-01/02/09/09） · **落地降级（有骨架但缺完整实现）** 10 项（D-03/05/06/07/08/10/12/13/16/17） · **规划遗漏（spec 没写但理应存在）** 3 项（D-04/14/15） · **流程纪律** 1 项（D-11）
- 按优先级：P0 2 项 · P1 9 项 · P2 5 项 · P3 1 项
- 建议下迭代立即兑现：**D-07**（Cron 拉取，复用 gatherer）、**D-11**（0 bug loop 验收记录，PR 模板改两行）—— 两项合计工时 < 1 天。
- D-16/D-17 是 2026-08-27 「guard-skip 改显式 skip」治理后从空转绿用例中暴露的两个导航入口缺失（改造成本各一行 nav 配置，可与 D-07 同批处理）。
