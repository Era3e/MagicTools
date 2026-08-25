# MagicTools 迭代日志（平台级）

- 各子项目与公共包的版本化变更由 changesets 自动生成到各自包目录的 CHANGELOG.md；
- 本文件记录平台级迭代摘要（阶段、里程碑、关键决策），在每次合入 main 时追加一条（含补记，需注明）；
- 条目格式：日期、变更摘要、涉及子项目、关联 PR。

## 2026-08-18

- 平台总体设计评审通过，建立 spec 与实施计划体系；
- Phase 0 工程化基座开工；
- **Phase 0 完成并合并 main（PR #1）**：Monorepo + 6 公共包 + 网关 + 8 子项目骨架 + outbox + 四层测试 + CI/CD + Docker 部署链路 + 文档/记忆/分支机制全部落地，CI 全绿（0dfdd8d）。

## 2026-08-19

- **Applicant MVP 完成并合并 main（PR #3，941fc95）**：岗位管理（CRUD/看板/JD 文本解析/截图视觉识别/投递话术）、面试复盘（记录/LLM 分析/markdown 导出）、简历管理（ClawCV analyze/rewrite/match + 无 Key 全降级）；@mt/model-client 新增多模态视觉路由；CI 冒烟与 E2E 覆盖 applicant 全流程（MT_LLM_STUB 桩模式）。
- **Investigator MVP 完成并合并（PR #5）**：调研主题管理（飞书 Bitable 源 + 字段映射）、同步链路（FeishuClient 令牌缓存/分页/归一化 + LLM 结构化 + 幂等入库）、结果筛选与主题总结、按记录推送 outbox 事件（researcher.response.push）、群机器人分发、数据库自举（免手工建库）。
- **Assessor MVP 完成并合并（PR #7）**：跨库消费 investigator 事件并批次聚合幂等入库、GitHub 仓库上下文（README/目录树/语言）、LLM 需求分析+设计方案、五状态审核流、推送 requirement.created 事件（主线第二环打通）。
- **Manager MVP 完成并合并（PR #8）**：跨库消费 requirement.created、需求 7 态生命周期与三来源标签、PR 状态联动刷新、Phantom GitHub Issues 同步、迭代管理；三环全链路 E2E 打通。**Phase 1 全部完成**：四子项目（Applicant/Investigator/Assessor/Manager）交付，主线三环（调研→分析设计→开发管理）事件链全线贯通。
- **Gatherer MVP 完成并合并 main（PR #11，a3de6fe）**：三类信息源（RSS/JSON/网页选择器）、采集管道（解析→去重→LLM 富化→入库）、试采与 cron 调度、推送 knowledge.item.collected 事件（知识主线第一环）。
- **Scholar MVP 完成并合并 main（PR #12，ced8fef）**：知识收件箱（跨库幂等消费 gatherer 事件）、三来源条目管理（gatherer/manual/obsidian）、双通道检索（pg_trgm 全文 + pgvector 向量，embedding-2 1024 维，桩模式 bigram 哈希伪向量）、LLM 图谱抽取与重建、obsidian vault 目录扫描同步（路径去重）、条目级/分类级圈定供 Assistant 查询；@mt/model-client 新增 embed 方法；CI 冒烟/E2E 覆盖 scholar 全流程。**Phase 2 知识主线全部完成**：Gatherer（采集）→ Scholar（沉淀/检索/图谱/圈定）两棒交付，知识主线全链路贯通。
- **Assistant cybercloud JWT 网关认证层（PR #23，3df9355）**：真实环境适配（SPKI DER 公钥加密登录、单域名 Set-Cookie JWT 提取、jwt+payload 双头认证、401 自动重登、LLM 供应商可切换）；testcybercloud-dev 全链路实测打通（登录→payload→智能体「业务数据查询」→真实销售数据回答）。
- **Assistant 多系统意图路由迭代（PR #22）**：intent_logs 意图日志可观测层（含置信度与纠错回填、列表/纠错 API、Web 日志页）；分层路由（系统归属 → 域内意图，规则/模型双轨 {domain,intent,confidence}）；低置信度澄清反问闭环。
- **Assistant 增强完成并合并 main（PR #19，077ee28）**：意图路由扩 6 类（process_execution 创建需求/触发采集经网关执行、trouble_shooting 全服务健康探测 + LLM 排查建议、complaint_feedback 反馈落库 + Web 反馈页）；cybercloud 真实对接（源码逆向契约：payload 头认证 + apiKey 换发 + 智能体 block 对话，集成手册 docs/integrations/cybercloud-setup.md）。
- **Designer MVP 完成并合并 main（PR #17，f062c9f）**：自然语言/设计稿图片 → LLM 生成 @mt/ui 令牌组件源码 → esbuild 沙箱预览 → 下载/沉淀组件库 + 生成历史（Phase 4 设计师降级版）。**Phase 4 完成，8 子项目全部交付**：Applicant/Investigator/Assessor/Manager（需求主线）+ Gatherer/Scholar/Assistant（知识主线）+ Designer（设计）全线落地。
- **Assistant MVP 完成并合并 main（PR #15，637f1df）**：LLM 三意图路由（product_inquiry 检索 Scholar 圈定条目带引用回答 / data_query 对接 cybercloud 可配置查询 + 桩模式 / chitchat_reject 兜底）、多轮对话持久化与指代消解、网页聊天 + HTTP API 双入口；CI 冒烟与 E2E 覆盖三意图全流程。**Phase 3 智能助手全部完成**：知识主线闭环（Gatherer 采集 → Scholar 沉淀检索 → Assistant 圈定问答）全线贯通；另修复 scholar 收件箱 e2e 与 gatherer e2e 的并行竞态（独立测试库）。

## 2026-08-22（补记）

- **统一前端外壳与工程化加固（PR #26，8c4c045）**：`@mt/ui` AppShell 统一 8 子项目外壳（侧导航+顶栏+跨应用切换）；9 页交互补全（loading/空态/错误态）与硬编码色值清理；ESLint 接入 + 5 公共包覆盖率门槛；`@mt/model-client` 健壮 parseJson（5 服务替换裸 JSON.parse）；outbox dead 终态；CI build 去重（32→1 步）+ turbo 缓存；新增 `pnpm test:affected` 回归层；README 重写与记忆文件去重。

## 2026-08-25

- **网关首页导航（PR #27，5e65a36，补记）**：根路径新增应用导航首页（8 应用卡片，名称+简介），替代纯反代的 Cannot GET /。
- **前后台双外壳打样 applicant（PR #28，d12386d）**：确立「前台各异、后台统一」信息架构——`@mt/ui` 新增 UserShell（杂志风前台外壳，UserShellTheme 按应用定制主题）与 AdminShell（全平台统一控制台后台外壳）；applicant 前台改杂志风岗位博览墙（检索/分页/空态引导），表格管理挪至 /admin/positions；e2e 补前后台路由拆分覆盖；ui-spec 增补双外壳规范。后续按同模式铺开其余 7 应用。
- **双外壳铺开全部 8 应用（PR #29，668c8e9）**：scholar 图书馆风（知识书院）、assistant 对话极简、gatherer 报刊风（知识采集部）、investigator 档案风（调研档案馆）、assessor 文书风（评审文书房）、manager 驾驶舱风（交付驾驶舱）、designer 画廊风（组件画廊）；管理页统一迁入 /admin/* 控制台路由（旧路径 redirect 兼容），无前台形态的应用默认路由直跳后台；UserShell 新增 footerNote 个性化页脚；e2e 页面用例同步迁移；ui-spec 落地 8 主题对照表。
- **前台内容页深度设计（PR #30，ee8239d）**：scholar 书目检索改图书馆目录卡片（编号书签/馆藏来源标签/双通道切换）；assistant 对话改极简双栏（异形圆角气泡/意图署名/虚线引用区/无框输入）；manager 前台需求台改 FLIGHT DECK 七泳道看板（优先级色条/PR 标记，表格留后台）；designer 定制生成改画廊委托单（展品卡+预览展位）。四页均从「既有页面套新壳」升级为主题化深度设计，e2e 断言同步。
- **剩余前台页主题化收官（PR #31，7f25a9e）**：scholar 馆藏目录（EntryList 书卷列表+书签式圈定）与知识图谱（图书馆配色+类目卡片墙）；manager 需求详情改 FLIGHT LOG 飞行日志（仪表卡/简报区/等宽时间线）；applicant 机会档案（FEATURE 特稿版式）、面试复盘（DEBRIEF 对开双栏）、简历工坊（WORKSHOP 改写台）。**8 应用前台主题化全部完成**。
