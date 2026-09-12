# MagicTools 迭代日志（平台级）

- 各子项目与公共包的版本化变更由 changesets 自动生成到各自包目录的 CHANGELOG.md；
- 本文件记录平台级迭代摘要（阶段、里程碑、关键决策），在每次合入 main 时追加一条（含补记，需注明）；
- 条目格式：日期、变更摘要、涉及子项目、关联 PR。

## 2026-09-12（P06，网关认证，PR #75 已合并）

- **网关用户登录与服务身份细分**（feat-gateway-P06-auth，squash 6bdfcb5）：网关新增浏览器可用的用户会话登录（GATEWAY_USERS scrypt 口令 + HMAC 签名 cookie 12h 滑动续期 + 登录页/登出路由 + 防暴破锁定），HTML/API 请求分类响应（302 登录页 / 401 JSON）；GATEWAY_USER_APPS 应用级授权（403），admin 与服务身份不受限；GATEWAY_SERVICE_TOKENS 服务身份细分（assistant 已接入，回落 GATEWAY_TOKEN）；未配置 GATEWAY_USERS 时与旧版行为完全一致，P04/P05 验证工具链零影响。两轮 0 bug loop 独立验收（首轮 D1 未认证远程 DoS 等五缺陷全部修复后复验通过）；CI 三段绿后合并，main CI 四段（含 images）全绿。配置与行为见 docs/features/gateway-auth.md。

## 2026-09-12（P04，八库备份与恢复应用交接）

- **本地完整验收收尾**：正式独立run594bc2f98a44f636完成八库恢复、17应用/12真实连接、Manager隔离、active cron外联阻断、A→B→A、坏密码、拉取/迁移失败、同名替换及清理11项，独立回读18/18通过；原环境容器/网络/卷/镜像和监听保持。修复containerd将digest列入RepoTags的清理兼容，同时保护所有外来RepoTags/RepoDigests。冻结qa53b通过353infra和136真实DB、零跳过；候选CI另行验证。操作章节、发布/备份说明和CI公开证据入口已同步，未启用生产调度或切流。

- **恢复应用交接实施**：新增backup:handoff、v2不可变恢复绑定、独占归属与首次验证持久阶段。部署17应用并绑定12条主/跨库连接，只有网关使用受控ingress；SSH核对数据库、claim和首次证明，应用回退保持恢复实例。补充阶段失败、换库、声明替换与回读篡改回归及完整操作章节。真实全平台阶段已验证读写和A→B→A，正式故障/外联演练及最终整批验收继续实施。

- **保留、告警与SSH传输实施**：默认保留15份、保护本次创建、删除前重读全部候选密文，修复损坏新副本、锁变化和时钟回拨三个独立审查缺陷。CLI失败统一持久事件及HTTP投递；真实run0abf00edd79f1024完成双备份keep1、prune幂等、八库恢复与已有目标故障告警，独立复核通过。加入源锁导出/SSH下载/隔离恢复验证/副本回执和失败回退，独立文件与受控传输19项通过；同机真实SSH run26b370064292f597及密文/回执/资源清理也已实测并独立复核。替换旧PowerShell单库流程，以静态bootstrap保留参数和PS文本重定向，提供systemd示例。部署交接及整批最终CI继续实施，未启用生产备份、物理异地保障或真实第三方通知。

- **加密备份与独立恢复核心**：补齐完整配置依赖检查、整集群物理备份、逐文件AES-GCM与清单HMAC、原生WAL验证和独立PG恢复；提供本机创建/校验/恢复及真实演练入口。已实测八库、角色密码/权限、向量和数据边界，并记录有明确采样范围的RPO区间与数据库RTO。私有文件别名隔离、回执失败残留及微秒截断等独立审查问题已修复。SSH异机保存、保留/告警/定时任务、应用切换和最终CI继续实施；见docs/features/backup-recovery.md及docs/validation/2026-09-12-backup-core.md。

## 2026-09-12（P03/P05，PR #72 已合并）

- **固定制品部署与回执**：新增本机/SSH部署器，校验制品与公开配置，拉取固定digest并实际核对就绪；原子成功回执/状态、部署锁与快照回退，保留已有秘密文件。替换旧PowerShell覆盖env的流程，生产数据库配置改为必填引用并补集成变量。两份干净SHA制品cc03f42→5355139的实际升级、故障恢复与回退8项通过；独立智能体另行完成八库数据保留、env不变、PG实例稳定及registry原始摘要核验，生产SSH与上线未验证；操作说明见 docs/features/deployment-receipts.md。

- **独立生产镜像与制品基础**：17镜像携带生产依赖、迁移及运行资源；后端迁移失败即退出、数据库断连返回503并支持恢复，Gateway聚合就绪。新增全平台容器冷启动与持久化回归，CI smoke接入真实镜像；main发布改为源码SHA和registry digest清单。P03/P05本地独立验收通过，最终候选及main CI全绿，main实际发布17镜像的原始制品/推拉日志独立核验通过；CI分别保存质量、镜像运行及部署回归证据；完整记录见 docs/validation/2026-09-12-runtime-images.md。

## 2026-09-12（P01/P02，PR #71 已合并）

- **关键数据库验证与提交证据**（feat-infra-P02-quality）：普通单测与真实数据库用例分离，逐文件分配主库与上游隔离库；清单、标记、排除项和最低执行数一致性校验，初始化错误与 skip/todo 均失败。qa:gate 生成候选/checkout/运行绑定的阶段回执，CI 保存失败和成功证据；修正 Designer 生成输入框定位，使原跳过用例实际等待响应和预览。当前说明见 docs/features/quality-evidence.md。

## 2026-09-11（P08，PR #70 已合并）

- **Manager 内容修订与审批**（feat-manager-P08-approval，依赖 PR #69）：新增内容快照、版本对比、范围与风险编辑、单用户凭证审批/撤销及分页记录。批准绑定具体内容版本，内容修改后需重审；操作信息仍使用原并发版本。前端冲突保留草稿、审批弹窗固定目标、请求迟到不覆盖当前需求。存量只回填升级时快照。配置模板默认关闭审批，CI 为完整浏览器流程生成临时凭证；当前不启动自动开发、合并或部署。说明见 docs/features/manager-content-approval.md。

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

## 2026-08-27

- **修复无前台应用后台无效返回链接（PR #32，b830c93）**：验收发现 gatherer/investigator/assessor 后台侧栏「返回前台」点击无效——frontPath 误指向后台自身；三应用本无前台形态，移除传参后 AdminShell 自动隐藏该链接。

## 2026-08-28（补记）

- **质量三角机制全部落地（PR #35，squash acae500）**：E2E 副作用断言四模式 + 16 页视觉快照基线 + guard-skip 空转绿治理（51 passed / 2 skipped / 0 failed）；coverage-matrix / mvp-deferred 追溯体系建立（区分「未实现」vs「故意不做」）；@mt/ui patterns 页面模式库（MagazineList/ControlTable/DetailHero）+ ThemeContext + no-hardcoded-colors ESLint 规则，11 前台页全量迁移 useTheme。
- **D-04/D-05 兑现（PR #42 → 5a940ff / PR #38 → 58a3e97）**：Designer 组件一键 PR 到 @mt/ui（GitHubClient 三步流 + publish.service + 「一键 PR」按钮）；Scholar 图谱 G6 力导向图（节点拖拽/缩放/边点击/详情面板）。
- **D-07/D-11/D-16/D-17 兑现（PR #36 → 2934264）**：Investigator node-cron 自动调度；CI 0 bug loop 复选框检测闭环；Designer 前台组件馆藏入口；意图日志入口确认补齐。
- **D-03/D-14/D-10 兑现（PR #41 → c9d43fa / PR #40 → 248ba8f / PR #37 → d3481f3）**：Manager Webhook 自动刷新（HMAC 签名 + delivery 幂等）；迭代燃尽图 TimelineBurndown；Gateway /status 健康仪表盘（Chart.js）。
- **D-09 在线学习层 + D-06/D-08/D-12/D-13 兑现（PR #43 → 5eae2a3）**：few-shot 纠错样本注入 + 评估闭环（混淆矩阵/回放）+ JSONL 导出；Obsidian 冲突三策略解决；ClawCV 配额告警；Gatherer 死信队列（指数退避 + dead_letter）；双壳移动端折叠基础。

## 2026-08-29（补记）

- **Release/changesets 链路修复闭环（Version PR #46 → a83fa40）**：mixed changeset 拆分 + 仓库工作流权限配置 + `publish: pnpm release:tag`（私有 monorepo 只打 tag）；changeset-release/main 工作分支机制理清（无待发布时自动重建，删除无损失）。
- **D-18 跨平台视觉基线收官（PR #44 → 03711c4 / PR #45 → 3e674d4）**：平台基线感知守卫 + visual-baseline.yml 生成 workflow + push-visual-baseline.mjs REST 回传（Blobs API + sha 自校验）；16 张 linux 基线入库，win32/linux 双平台像素比对闭环，CI 视觉用例首次真跑全绿。**mvp-deferred 至此 17/18 兑现**。

## 2026-09-02

- **UI v2「墨蓝石墨·工房感」落地 @mt/ui（feat-ui-v2-migrate-mtui，随 PR #47 于 09-03 合并）**：tokens 全量替换 AntD 出厂值（墨蓝 ink-600 #2c4a6e 主色 + 石墨中性阶 + 暗色板/海拔/动效/字体扩展，键结构向后兼容零改业务代码）；主题真注入——MtThemeProvider 全量注入 AntD、AdminShell 经 darkAlgorithm 整体转石墨深色控制台、UserShell 八主题 accent 注入前台控件；MtEmptyState 品牌化去 AntD 简笔画；八应用主题常量按业务受众派生口径重算；视觉基线 16 张重生成，e2e 全量 52 passed。
- **UI「塑料感」评审 + v2 设计规范定稿（设计系统交付，未含代码落地）**：全平台 UI 评审定位四根源（AntD 出厂令牌照搬 / 主题只装饰外壳内脏默认件 / 无中性阶与海拔体系 / OS 自带字体角色扮演）；用户拍板「统一底座 + 八主题真注入 / 墨蓝石墨·工房感 / 暗色纳入 / 先规范后落地」。交付 `.design_library/magictools/` 设计系统（191 令牌含亮暗双色板、surface 三级表面、5 级墨调海拔、motion、字体三层；6 组件契约与预览；UI Kit 展示页；SKILL/README），docs/ui-spec.md 重写为 v2（令牌唯一来源、11 条强制规则、八主题业务受众派生口径、暗色模式、8 项落地迁移清单）。代码落地按迁移清单另起任务。

## 2026-09-03（补记）

- **UI v2/v2.1 合并 main（PR #47，squash 9f0c096）**：墨蓝石墨·工房感令牌体系（ink-600 #2c4a6e 主色 + 石墨中性阶）+ Linear/Stripe/GitHub/Vercel/Notion 五家质感密码逆向（四级表面亮度/双层投影/发丝边框/噪点纹理/透明度文字层级/暗色光学修正）；AdminShell 深色控制台 + AdminDarkThemeProvider 组件级注入；linux 旧基线随 PR 移除（平台守卫显式 skip，待 workflow 重生成）。

## 2026-09-08（补记）

- **UI v2.2 页面级组件合并 main（PR #51，squash 31dda02）**：MtStatusTag（六 tone 语义标签）+ MtKpiRow（等宽 KPI 读数）替换 8 应用全部 AntD Tag 预设色（38 处）/Empty 简笔画（3 处）/Statistic；patterns 四组件补单测（coverage 59.37%→95.82%）；ui-spec §六迁移清单 8 项全量勾选。
- **Assistant 双路数据查询与质量兜底落地（PR #54 前身，分支 feat/assistant-dual-query）**：direct-query 五步流水线 + verify-task 五终态状态机 + compare 数值归一对比 + cybercloud_calls 监控 + ChatPage VerifyBadge；真环境（testcybercloud-dev）实测抓获智能体预设值错误回答（divergent 83%）；spec/plan 文档入库（2026-09-08-assistant-dual-query-design.md）。

## 2026-09-09（补记）

- **UI v2.3 全量重构 + 五道质量防线（PR #56，squash ef9821d）**：17 页设计稿全量落地（双壳 v2.3 报头式前台/琥珀指示条后台 + 8 应用前后台 + gateway 落地页 + 3 交互演示：重试恢复流/自动暂停/批量部分成功）；五防线：responsive.spec 巡检（32 用例，首跑抓出 15 个 768px 真实溢出）、文案单源 APP_ACCENT_TOKENS（+drift guard 用例）、pre-commit 钩子（冲突标记 + dist 陈旧守卫）、turbo ^build + vitest alias 双保险、视觉锚点 fail fast + waitFor/settleMs 时序机制；e2e 83 passed 两轮稳定复现，0 bug loop 测试代理验收通过（含双篡改测试）。
- **双路查询发布收官（PR #54，squash a924d42）**：CI 三段全绿一次通过合并；@mt/ui 0.3.0 发版；worktree 清理。
- **Release + linux 基线 + CI flaky 修复（PR #57 → 99a5d72 / PR #58 → 1fb0d48 / PR #59 → d7c4942）**：@mt/ui 0.4.0 版本更新；v2.3 linux 基线 16 张经 visual-baseline workflow 重生成合入（跨平台视觉闭环达成）；main CI 慢机 flaky 修复（findByRole/findByText 显式 10s）+「静态锚点后紧跟 getBy 数据断言」反模式全库扫描；沉淀 CI 慢机测试纪律与 changeset release PR body 被 bot 重写等经验。

## 2026-09-09（文档治理轮，补记）

- **文档偏移五文档对齐修复 + 防弊机制三线落地**：全仓内容级取证修复 CHANGELOG（补齐 08-28~09-09 五个缺失日期段）、CODE_WIKI（v2.3 外壳/组件族/双路查询模块表与路由表）、coverage-matrix（I3/M4/D9/C6~C9 陈旧行 + 第 10 章增量）、mvp-deferred（D-04/D-12/D-13 补 ✅，摘要 17/4 自纠）、state.md 已知问题 12 存档化。防弊三线：①PR 模板新增「沉淀层文档已同步」勾选 + CI quality PR 事件检测扩展为两项（与 0 bug loop 同级强制）；②新增 infra/scripts/lib/docs-guard.mjs drift guard（coverage-matrix ✅ 行声明的仓库路径存在性校验，TDD 5 用例 + CLI 守卫挂接 pnpm test:infra，qa:gate/CI 自动生效）；③git-workflow.md 收尾协议补 CHANGELOG/coverage-matrix 两项 + AGENTS.md 硬性约定 3 扩充。根因分析（更新义务未绑定检测点、双文档体系无单一触发、squash 断链、验证闭环不覆盖文档）与全过程记录见 state.md 对应条目。

## 2026-09-10

- **D-01/D-02 Designer 画布工坊落地（拖拽编辑 + 双向同步，mvp-deferred 最后两项 P2 兑现）**：① Component Schema 抽象（canvas/schema.ts 纯函数层——addNode/removeNode/moveNode/duplicateNode/updateNodeProps 不可变更新 + registry.ts 8 组件注册表：div/Card/Typography 三件套/Button/MtStatusTag/MtEmptyState，容器样式收敛为 direction/gap/padding 枚举映射 tokens.spacing，零硬编码色值）；② `/studio` 三栏画布页（palette 分组拖拽 @dnd-kit/core + 双击同源兜底 / 画布 CanvasRenderer 真渲染即预览 + 选中态操作条上移/下移/复制/删除 / PropForm 受控属性面板即时联动，<920px 响应式折叠）；③ 双向编辑闭环（codegen.ts schema→code 确定性生成器实时同步 + 服务端 parse.service @babel/parser 白名单逆向 POST /api/designer/parse，错误带 reason/line；CodePanel「未应用」徽标 + 显式「应用代码」回画布）；④ 闭环衔接（GeneratePage「送入画布」parse 成功携 doc 跳转；components/generations 新增 schema jsonb 列随沉淀落库）；designer e2e +4 用例（双击添加/属性联动/应用代码流），视觉基线 17→18 张。
- **D-09 Assistant LoRA 微调编排层就绪（真跑待触发）**：@mt/model-client 新增智谱微调客户端（finetune.ts——POST /files 上传 / POST+GET /fine-tuning/jobs 任务与事件四端点，FT_STUB=1 桩模式 + FT_STUB_STATUS 状态可控，真接口 fetch 形态全覆盖测试）；assistant-server finetune.service（500 纠错样本就绪门禁 + FT_LAUNCH_ENABLED=1 真跑开关缺省关 + finetune_jobs 表 migration 005 任务落库 + status 远端刷新失败降级 degraded 快照 + busy 并发防重）；IntentLogPage 新增「微调编排」卡（MtKpiRow 样本进度/基座/任务状态/微调模型编码 + 进度条 + 就绪门禁按钮态 + 进行中任务 5s 轮询终态停）；微调完成后模型切换零代码（ZHIPU_MODEL envModelKey 既有机制）。真跑触发条件：纠错样本 ≥500（当前 10）+ 智谱开发者 Pro 权益 + FT_LAUNCH_ENABLED=1。

- **D-15 投递日历落地（Applicant 前台跨岗位视角）**：新增 `/calendar` 前台页——设计稿「编辑部目录式时间轴」构图全量复刻（Hero D-day 读数带 + 左「按 D-day 排序的节点清单」1.9fr / 右 sticky 月历 1fr 双栏棋盘 + 底部岗位进度横带 + 待跟进区），零外部日历库手写 CSS Grid 月历（周一起始、今日格 accent 高亮、三类事件标记：投递/计划面试/已完成面试），私有断点 860/720 对齐设计稿（单列纵排月历上移、节点行两段堆叠）；数据层 migration 002（positions.applied_at 投递时间戳，status→applied 自动落库手动值优先 + interviews.status scheduled/done 状态机）；API 三处扩展（GET /interviews 跨岗位 JOIN 列表、PATCH /interviews/:id 改期/标记完成、POST 校验 done 必填 qaNotes/scheduled 免填）；InterviewForm 双提交路径（保存复盘/记为计划 + dayjs 面试时间录入）、InterviewPage 计划条目（待进行标签 + 标记完成）、PositionDetail 投递日期行；Playwright e2e 新用例（页渲染/月历切月/节点跳转副作用断言）；视觉基线 16→17 张（清库空态重生成）+ responsive 巡检 34 用例纳管新页全绿。顺手修复：start-services.mjs 的 applicant 桩开关缺失（SERVER_ENV.applicant 补 MT_LLM_STUB=1，对齐 CI 口径——此前本地跑 e2e analyze 走真实 LLM 必红）。

## 2026-09-11

- **Manager 需求基础与候选导入（P01/P07/P09 首批）**：状态和普通字段在事务中同时保存，统一七态迁移和 PR 终态保护，expectedRevision 冲突返回 409，同状态 Webhook 不递增版本；前端保留关联草稿并阻止冲突重试覆盖。新增候选预览/确认/剩余批次、独立能力基线、规划验收与证据；GitHub 仓库身份归一、交叠批次去重、冲突整批回滚，所有规划保持待分析和人工开发。本地与 CI quality 统一调用 qa:gate，并强制运行专用 Manager 数据库契约测试。使用方式见 docs/features/manager-candidate-import.md；本次未启用自动开发、合并或部署。

- **Designer 画布拖拽交互修复与真实指针级 e2e（D-01 收尾）**：修复拖拽放置断链——StudioPage onDragEnd 依赖 e.over 但画布未注册 useDroppable（此前 e2e 只测双击兜底路径掩盖缺陷）；新建 CanvasDropZone（droppable canvas-root + isOver 悬停高亮 dashed info 边框 + inset 光晕 + 点阵纹理背景）；e2e 新增 2 条真实指针拖拽用例（palette→画布 / 拖入选中容器嵌套落点），designer.spec 10 用例。**沉淀 dnd-kit+Playwright 拖拽铁律**：locator.dragTo 只派发一次 pointermove，activationConstraint 激活那次 move 坐标被丢弃（handleStart 后直接 return），碰撞检测需后续 move 驱动否则 e.over 恒 null——e2e 必须手写 mouse 序列 steps>=2（对照实验 steps=1 必败/steps=8 必成）；另实证 useDraggable 默认 attributes 带 role=button（页面级 getByRole 假阳性）与 AntD 双字按钮字间空格（正则 \s* 形式）。视觉基线无需重生成（点阵纹理密度 0.4% < 2% 阈值）。
