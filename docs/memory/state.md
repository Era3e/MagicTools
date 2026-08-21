# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。

## 当前状态快照（2026-08-21，cybercloud 真实对接完成）

- **项目阶段**：意图路由迭代（PR #22）与 cybercloud JWT 网关认证层（PR #23，3df9355）均已合并 main；**testcybercloud-dev 全链路实测打通**（真实智谱分类 → RSA 登录 → JWT → payload → 智能体「业务数据查询」→ 真实业务数据回答）；本地 assistant 以真实模式运行。
- **cybercloud 真实对接关键契约**（源码逆向 + 实测）：网关层 APISIX jwt-auth 要求 jwt 头；登录 = login/key 取公钥（SPKI DER base64）→ RSA PKCS1 加密 loginKey+password → login 取 JWT（单域名部署走 Set-Cookie 的 jwt cookie）；应用层 payload 头 = URL 编码 UserDto JSON（apiKey 经 userByApiKey 换取）；对话 = agents → session/create → block（MARKDOWN/METRIC_CHART/REPORT_CHART/ERROR）；智能体列表 9 个，「业务数据查询」= 2052619996018765825。
- **已知问题**：① 智谱新 Key 曾因 IP 白名单 403（用户已开白名单解决）；② assistant 的 chat LLM 现支持供应商切换（有 DEEPSEEK_API_KEY 时 chat 优先 DeepSeek、embed 固定智谱，LLM_PROVIDER=zhipu 强制）；③ Node20/OpenSSL3 禁用 PKCS1 私钥解密，测试避免依赖私钥解密。
- **意图路由迭代清单**：intent_logs 表（message/domain/intent/confidence/corrected_intent）每次 chat 落库；分层路由输出 {domain, intent, confidence}（桩规则 confidence=1，真实模式 LLM 输出三字段、解析失败回退规则 confidence=0）；低置信度（CLARIFY_THRESHOLD 默认 0.6，桩注入 CLARIFY_STUB_CONFIDENCE）澄清反问 + clarifyOptions 候选 + 序号/意图名确认执行 + corrected_intent 回填；GET /intent-logs + POST /intent-logs/:id/correct；Web 意图日志页（筛选/纠错）与聊天页澄清选项按钮。
- **已知问题**：① .env 的 ZHIPU_API_KEY 过期（401），本地服务桩模式运行；② cybercloud 真实联调待用户提供凭证（账号/密码/API Key，另有 6 项前置条件见会话记录与 docs/integrations/cybercloud-setup.md）；③ gh GraphQL 轮询易被网络瞬断，用 REST 轮询。
- **Assistant 增强清单**：意图路由扩 6 类（process_execution：创建需求/触发采集经网关执行，ACTION_STUB 桩；trouble_shooting：读 ports.yaml 并发生成健康探测 + LLM 排查建议；complaint_feedback：feedback 落库 + API + Web 页）；cybercloud 真实契约适配（payload 头认证 = URL 编码 UserDto JSON；apiKey → /api/auth/setup/user/access/token/userByApiKey 换 payload 缓存 30 分钟；/api/setup/agent/chat/agents + session/create + block 对话，SSE 四类型；CYBERCLOUD_BASE_URL/API_KEY/AGENT_ID 配置，未配置优雅降级，CYBERCLOUD_STUB 桩）。契约手册 docs/integrations/cybercloud-setup.md。
- **已知问题**：① 本机 .env 的 ZHIPU_API_KEY 已过期（401 令牌已过期），真实 LLM 功能全部受影响，待用户更新 Key 后重启服务恢复真实模式（当前本地服务以桩模式运行）；② gh CLI 的 GraphQL 轮询（pr checks --watch）常被网络代理瞬断，改用 REST 轮询。
- **下一步**：PR #19 CI 全绿后合并 main → 清理 → 目标完成；候选：部署上线（需 GitHub Secrets）、Designer 可视化编辑器。
- **Designer 能力清单**：自然语言 + 可选设计稿图片（glm-4v-flash 视觉路由）→ LLM 生成基于 @mt/ui 令牌的 React 组件源码（结构化 JSON + 桩模式固定示例组件）；服务端 esbuild 打包沙箱预览（React/antd/@mt/ui 内联单文件，resolveDir 固定包目录适配 CI，产物内存缓存，编译错误友好返回）；下载 .tsx；人工审核沉淀组件库（designer 库 components 表 + 重名幂等）；生成历史（含失败落库）；Web 三页（生成/组件库/历史）。
- **Assistant 能力清单**：LLM 三意图路由（product_inquiry/data_query/chitchat_reject，桩模式关键词判别 + 非法输出回退）；product_inquiry 跨库只读检索 scholar 圈定条目（assistant_scope=true，向量 top-k + FTS 兜底）生成带引用回答（标题/来源/相似度）；data_query 对接 cybercloud 可配置 REST（LLM 生成查询参数 → 请求 → 格式化，CYBERCLOUD_STUB 桩模式，未配置优雅降级）；多轮对话持久化（conversations/messages，最近 10 轮上下文，检索带最近用户消息做指代消解）；网页聊天（会话侧栏/气泡/引用卡片跳转 Scholar）+ HTTP API 双入口；assistant 库自举（SCHOLAR_DATABASE_URL 惰性跨库池，e2e 用独立测试库避免与 scholar 测试互扰）。
- **下一步**：Assistant PR #15 CI 全绿后合并 main → Phase 3 目标完成 → Phase 4 候选：Designer（降级版）。
- **Phase 2 事件契约**：knowledge.item.collected（source=gatherer，payload 含 itemId/url/title/content/summary/category/keywords/publishedAt），Scholar 经 GATHERER_DATABASE_URL 只读连接消费。
- **Scholar 能力清单**：知识收件箱（跨库消费 gatherer 的 knowledge.item.collected，幂等）、条目 CRUD + 三来源标签（gatherer/manual/obsidian）、双通道检索（pg_trgm 全文 + pgvector 向量，embedding-2 1024 维，桩模式 bigram 哈希伪向量）、LLM 图谱抽取（entities/relations/entry_entities，重建=全量重抽）、obsidian vault 目录扫描同步（跳过 .obsidian/templates/attachments/assets 等目录，路径去重）、条目级 assistantScope 圈定 + 分类级圈定、设置表存 vault 路径。
- **下一步**：Phase 3 剩余交付 —— Assistant（MVP 3 意图，检索 scholar 圈定范围 assistant_scope 内容）→ Designer（降级版）；每个子项目照旧 spec→plan→实现→测试→CI 全绿→PR 合并。
- **Phase 2 事件契约**：knowledge.item.collected（source=gatherer，payload 含 itemId/url/title/content/summary/category/keywords/publishedAt），Scholar 经 GATHERER_DATABASE_URL 只读连接消费。
- **Phase 2 事件契约**：knowledge.item.collected（source=gatherer，payload 含 itemId/url/title/content/summary/category/keywords/publishedAt），Scholar 消费。
- **Phase 1 交付清单**：Applicant 求职管理（含 ClawCV）；Investigator 调研（飞书 Bitable）；Assessor 需求分析设计（GitHub 上下文）；Manager 项目管理（Phantom GitHub 同步）。主线三环事件链：researcher.response.push → requirement.created → 需求落地。
- **关键事件契约**：① researcher.response.push（investigator → assessor）② requirement.created（assessor → manager，payload 含 analysisMd/designMd/repoUrl/reviewComment）。
- **Applicant 能力清单**：岗位 CRUD/六状态看板/JD 文本解析/截图视觉识别（glm-4v）/投递话术/面试复盘分析/复盘→简历改写闭环/ClawCV 集成+无 Key 降级。
- **仓库就绪度（2026-08-19 核实）**：main 分支保护已启用（required checks: quality/smoke/e2e；0 审批；禁止强推/删除）；GitHub Secrets 尚未配置（ClawCV/镜像仓库均未配，降级路径与 images 跳过守卫已覆盖）；main 最近 CI 全部 success。
- **ClawCV 调研结论**：后端 api.wondercv.com + Bearer API Key；免费额度 10 PDF/20 改写/20 分析每月；已从 npm 包 clawcv@1.1.0 源码逆向出全部端点与请求体契约（/cv/v1/mcp/{session,analyze,rewrite,match,ai-mentor,pdf}，详见 docs/integrations/clawcv-setup.md），adapter 实现无风险。
- **仓库状态**：GitHub 远端 https://github.com/Era3e/MagicTools（main 为默认分支）；本地 main 已同步 origin/main；dev 分支与 worktree 已按流程清理。
- **关键文档**：docs/superpowers/specs/2026-08-18-magictools-platform-design.md；docs/superpowers/plans/2026-08-18-phase0-foundation.md
- **外部集成手册**：docs/git-workflow.md（GitHub 仓库设置操作步骤）；docs/integrations/feishu-setup.md（飞书开放平台接入步骤）

## 关键决策（摘要，详见设计文档）

- 全栈 TypeScript（React+NestJS+PostgreSQL+pgvector），pnpm Monorepo；
- 8 子项目 + gateway；端口注册表 infra/ports.yaml；
- LLM：DeepSeek + 智谱，@mt/model-client 统一抽象；
- 数据交互：网关 + 同步 REST + outbox + 幂等键；
- 部署：单台阿里云 ECS + Docker Compose；
- Applicant 为 Phase 1 并行试点；Designer 降级版；Assistant MVP 3 意图；
- 分支绑任务不绑对话，四层清理机制。

## 进行中任务

- 无

## 已知问题

1. 本机 PowerShell 执行策略限制：pnpm/npx 一律用 pnpm.cmd；
2. 网络代理不稳定：沙箱注入的代理与直连两种模式都可能失效，git 推送失败时两种都试（清空代理环境变量 或 走代理）；gh CLI 通常不受影响；
3. **本地 .env**：仓库根 D:\MagicTools\.env（从 .env.template 复制创建，gitignore 忽略）；各服务启动时经 @mt/config 的 loadRootEnv 自动加载（向上查找仓库根），无需 export；
4. Docker Desktop 需手动启动（引擎就绪后 compose 正常）；
5. 镜像推送需先在 GitHub 配置 Secrets（REGISTRY_HOST/USERNAME/PASSWORD），未配置时 images job 自动跳过；
6. 子智能体委托（subagent/subagent_fork）在本环境不可用，多智能体协作需外部 CLI 环境（见 executing-plans 技能说明）。
