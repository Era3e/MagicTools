# Gatherer（收集者）子系统设计（MVP）

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-19
- 状态：🟡 草案（待确认默认假设 G1~G4，见第 6 节）
- 上游：docs/superpowers/specs/2026-08-18-magictools-platform-design.md（5.1 节）

## 1. 定位

自动化信息收集系统（知识主线第一棒）：配置信息源（RSS/网页/HTTP API）自动提取数据，清洗去重后 LLM 结构化，选择性推送给 Scholar（知识库），为后续 Assistant 的知识查询打基础。

## 2. 功能模块

### 2.1 信息源管理
- 源 CRUD：名称、类型（rss/web/json_api）、URL、采集配置（cron 表达式、选择器/字段映射）、状态（active/paused）
- 支持测试拉取（配置后立即试采一次验证可用性）

### 2.2 采集管道
- 手动触发（按钮/接口）+ 定时调度（每源 cron）
- 管道：拉取 → 解析为条目（标题/链接/正文/发布时间/来源）→ 去重（内容指纹 + URL）→ LLM 结构化（可选开关）→ 入库
- 采集运行记录：每次采集的拉取数/新增数/错误

### 2.3 清洗去重
- 内容指纹（@mt/utils contentFingerprint）+ URL 唯一约束，重复采集自动跳过
- 正文清洗：HTML 标签剥离、空白归一化

### 2.4 LLM 结构化（可选增强）
- 每源可配置开关：启用后对每条新增条目生成摘要 + 分类（行业/主题）+ 关键词
- 关闭时仅存基础字段（标题/链接/正文/时间）

### 2.5 推送 Scholar（知识主线第一环）
- 采集结果列表 + 「推送」按钮（单条/批量勾选）→ outbox 事件 knowledge.item.collected（Scholar 建成后消费）
- 可选自动推送开关（每源配置 auto_push：采集即推送）

## 3. 数据模型（PostgreSQL，gatherer 库）

| 表 | 关键字段 |
|---|---|
| sources | id, name, type(rss/web/json_api), url, cron, options(jsonb：选择器/字段映射/llm 开关/auto_push), status, last_run_at, timestamps |
| items | id, source_id, url, title, content, published_at, fingerprint, category, keywords(jsonb), summary, llm_enriched(bool), pushed_at, timestamps, UNIQUE(source_id, fingerprint) |
| runs | id, source_id, started_at, finished_at, fetched_count, new_count, error |
| outbox（@mt/db 复用） | 事件 knowledge.item.collected |

- 数据库自举复用

## 4. API 设计（NestJS，前缀 /api/gatherer）

| 方法/路径 | 说明 |
|---|---|
| GET/POST /sources | 源列表 / 新建 |
| GET/PATCH /sources/:id | 详情 / 更新（含开关） |
| POST /sources/:id/test | 试采一次（不入库，返回解析样例） |
| POST /sources/:id/collect | 手动触发采集 |
| GET /items?sourceId=&pushed= | 采集结果列表 |
| POST /items/push | 批量推送（outbox + pushed_at） |
| GET /meta/scheduler-status | 定时任务状态 |

## 5. 技术要点

1. **解析器**：RSS（rss-parser 库）、JSON API（字段映射配置）、HTML（cheerio + CSS 选择器提取标题/正文/链接）
2. **调度**：node-cron，服务启动时加载 active 源的 cron 注册；手动触发独立于调度
3. **去重**：URL + contentFingerprint（sha256 前 32 位）双保险；采集失败不阻塞其他源（逐源隔离）
4. **LLM**：@mt/model-client + MT_LLM_STUB 桩模式（结构化桩）；每源开关控制成本
5. **端口**：gatherer web 4001 / server 5001（已登记）；独立库 gatherer；loadRootEnv 就位
6. **CI**：smoke/e2e 的 gatherer 服务加 MT_LLM_STUB=1 + RSS_STUB（内置测试 RSS 桩：rss-parser 对本地 fixture 或内置 HTTP 桩）；E2E 全流程（建源→试采→采集→去重→推送）

## 6. 待确认的默认假设（回复确认或修正即可）

- **G1**：MVP 支持三种源类型（RSS / JSON API / 静态网页 HTML+CSS 选择器），各做基础版
- **G2**：调度 = 每源可配 cron + 手动触发；node-cron 进程内调度（分布式/持久队列留 Backlog）
- **G3**：推送 Scholar 用 outbox 事件 knowledge.item.collected（Scholar 建成前仅标记已推送）；每源可选 auto_push 自动推送
- **G4**：LLM 结构化（摘要/分类/关键词）为每源可选开关（默认开启），关闭时仅存基础字段

## 7. 验收标准（DoD）

1. 三种源类型各至少一个 e2e 用例（RSS/JSON/HTML，桩数据）
2. 采集管道：拉取→解析→去重（重复采集 0 新增）→入库；runs 记录
3. LLM 结构化（桩模式）+ 开关行为正确
4. 推送落 knowledge.item.collected 事件 + pushed_at 标记
5. CI 全绿 + docs/迭代日志同步 + 合并 main
