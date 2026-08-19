# Investigator（调研者）子系统设计（MVP）

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-19
- 状态：✅ 已确认（2026-08-19 用户确认 I1~I4 四项默认值）
- 上游：docs/superpowers/specs/2026-08-18-magictools-platform-design.md（5.2 节）；docs/integrations/feishu-setup.md（飞书接入）

## 1. 定位

需求调研系统：用户用飞书问卷/表单收集调研数据（数据落多维表格），Investigator 配置「调研主题 → 多维表格」映射后拉取记录，用 LLM 把自由文本回复结构化为「需求点/痛点/期望/情绪/优先级」，并支持将结构化结果选择性推送 Assessor。作为需求主线（Investigator→Assessor→Manager）的第一棒。

## 2. 功能模块

### 2.1 调研主题管理
- 主题 CRUD：名称、描述、状态（active/archived）
- 飞书源配置：app_token + table_id（来自多维表格 URL）+ **字段映射**（把表格列映射为语义字段：问题列/回答列，见 2.2）

### 2.2 数据拉取与结构化（核心链路）
- 同步：POST /surveys/:id/sync → FeishuClient 拉取全部记录（分页，page_size=500）→ 对每条记录用 LLM 结构化 → 入库 responses（幂等：unique(survey_id, record_id)，重复拉取只更新）
- 结构化 schema（固定）：requirements（需求点数组）、painPoints（痛点）、expectations（期望）、sentiment（情绪：positive/neutral/negative）、priority（P0/P1/P2）、summary（摘要）
- 字段映射：配置「回答所在列」；LLM 只吃该列文本（多列可多选合并），不猜字段含义

### 2.3 结果查看
- 主题下 responses 列表：原始回答 + 结构化结果并排展示；按情绪/优先级筛选
- 主题级汇总（MVP 简化）：各优先级/情绪计数 + LLM 一段主题总结（可选按钮）

### 2.4 推送 Assessor（主线打通第一环）
- 勾选单条/多条 responses → POST /surveys/:id/push → 写 outbox 事件 researcher.response.push + 标记 pushed_at
- MVP 阶段 Assessor 尚未实现：事件落库待消费，前端显示「已推送（待 Assessor 接收）」；Assessor 建成后消费该事件

### 2.5 飞书分发辅助
- 主题详情提供「复制问卷链接」+「通过群机器人 webhook 发送」按钮（配置 FEISHU_BOT_WEBHOOK 后可用；未配置时按钮禁用并提示）
- 群机器人 webhook 契约见 docs/integrations/feishu-setup.md 第八节

## 3. 数据模型（PostgreSQL，investigator 库）

| 表 | 关键字段 |
|---|---|
| surveys | id, name, description, status, source(默认 feishu_bitable), app_token, table_id, field_mapping(jsonb), last_synced_at, timestamps |
| responses | id, survey_id, record_id, raw_fields(jsonb), structured(jsonb), sentiment, priority, summary, pushed_at, timestamps, UNIQUE(survey_id, record_id) |
| sync_runs | id, survey_id, started_at, finished_at, fetched_count, processed_count, error |
| outbox（@mt/db 复用） | 事件 researcher.response.push |

## 4. API 设计（NestJS，前缀 /api/investigator）

| 方法/路径 | 说明 |
|---|---|
| GET/POST /surveys | 主题列表 / 新建（含飞书源与字段映射） |
| GET/PATCH /surveys/:id | 详情 / 更新（映射与状态） |
| POST /surveys/:id/sync | 手动触发拉取+结构化（返回 sync_run 摘要） |
| GET /surveys/:id/responses?sentiment=&priority= | 结果列表 |
| POST /surveys/:id/push | 推送选中 records（outbox + pushed_at） |
| POST /surveys/:id/summarize | 生成主题总结（LLM） |
| GET /meta/feishu-status | 凭证/表格可访问性自检（拉 tables 探测） |

## 5. 技术要点

1. **FeishuClient**（apps/investigator/server/src/feishu/）：
   - tenant_access_token 缓存（expire 7200s，提前 5 分钟刷新），Bearer 鉴权
   - 拉取：GET /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records?page_size=500&page_token=…（官方限流 20 次/秒，客户端加最小间隔与退避）
   - 字段值形态（官方契约）：文本=string、多选=string[]、单选=string、日期=毫秒时间戳、人员/关联=object——normalize 成字符串数组供 LLM
   - **FEISHU_STUB=1 桩模式**（CI/E2E 用）：返回固定两条模拟记录
2. **LLM**：复用 @mt/model-client + MT_LLM_STUB 桩模式（与 Applicant 同一套）
3. **幂等同步**：record_id 去重；sync_run 记录每次拉取统计
4. **端口**：investigator web 4002 / server 5002（ports.yaml 已登记）；独立库 investigator（postgres-init.sql 增补）
5. **CI**：smoke/e2e 的 investigator 服务加 FEISHU_STUB=1 + MT_LLM_STUB=1；E2E 全流程（建主题→同步→查看结果→推送）

## 6. 已确认的决策（2026-08-19 用户确认）

- **I1**：MVP 只做飞书 Bitable 拉取，自建表单放入 Backlog
- **I2**：字段映射为手动配置（选择回答所在列），不做智能字段识别
- **I3**：推送粒度 = 按记录勾选推送，落 outbox 事件；Assessor 建成前仅标记「已推送待接收」
- **I4**：同步仅手动触发，定时同步与自定义提取 schema 放入 Backlog

## 7. 验收标准（DoD）

1. 主题 CRUD + 飞书源配置（含字段映射）可用
2. 同步链路：真实多维表格拉取全量记录 + LLM 结构化入库（幂等）；桩模式 E2E 全绿
3. 结果列表（筛选）与主题总结可用
4. 推送落 outbox 事件 + 状态标记，事件契约可被 Assessor 消费
5. CI 全绿 + docs/迭代日志同步 + 合并 main
