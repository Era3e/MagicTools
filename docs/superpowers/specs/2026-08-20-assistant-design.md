# Assistant（助手）子系统设计（MVP）

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-20
- 状态：✅ 已确认（2026-08-20 用户确认 A1~A4 四项默认值）
- 上游：docs/superpowers/specs/2026-08-18-magictools-platform-design.md（5.7 节）；Scholar 圈定机制（entries.assistant_scope）

## 1. 定位

Phase 3 智能助手：LLM 三意图路由（product_inquiry / data_query / chitchat_reject）；product_inquiry 只检索 Scholar 圈定内容（assistant_scope=true）生成带引用回答；data_query 对接 cybercloud 查询接口（可配置 + LLM 生成查询参数）；chitchat_reject 礼貌兜底；多轮对话；网页聊天 + HTTP API 双入口。

## 2. 功能模块

### 2.1 意图路由
- LLM 结构化输出 {intent}（glm-4-flash）；MT_LLM_STUB 桩模式关键词判别
- 多轮对话中意图随上下文判定（如「那第二个呢」延续上一轮意图）

### 2.2 product_inquiry（产品/知识问答）
- 检索范围 = Scholar 圈定条目（assistant_scope=true），向量 top-k + FTS 关键词兜底
- LLM 基于检索内容生成回答，附引用列表（条目标题 / 来源 / 相似度分数）
- 无圈定内容命中时诚实回答「未找到相关知识」

### 2.3 data_query（数据查询）
- 对接 cybercloud 查询接口：可配置 BASE_URL + API Key（环境变量），LLM 从自然语言生成查询参数
- 未配置时优雅降级提示；CYBERCLOUD_STUB=1 桩模式返回固定数据集
- 结果由 LLM 格式化为自然语言回答

### 2.4 chitchat_reject（闲聊兜底）
- 问候/闲聊/与能力无关的请求 → 礼貌说明能力边界并给出示例问题

### 2.5 多轮对话
- conversations / messages 表持久化；每轮携带最近 N 轮上下文（默认 10）
- 会话列表 / 历史消息 / 删除会话 / 新会话

### 2.6 双入口
- 网页聊天页（会话侧栏 + 气泡对话 + 引用卡片）
- HTTP API：POST /api/assistant/chat（无 sessionId 自动建会话）

## 3. 数据模型（PostgreSQL，assistant 库）

| 表 | 关键字段 |
|---|---|
| conversations | id, title（首条消息截断）, created_at, updated_at |
| messages | id, conversation_id, role(user/assistant), content, intent, citations jsonb, created_at |

- 数据库自举（ensureDatabase + 迁移）；assistant 库加入 postgres-init.sql

## 4. API 设计（NestJS，前缀 /api/assistant）

| 方法/路径 | 说明 |
|---|---|
| POST /chat | 发送消息（{sessionId?, message}）→ {sessionId, reply, intent, citations} |
| GET /conversations | 会话列表（含最后消息摘要） |
| GET /conversations/:id/messages | 历史消息 |
| DELETE /conversations/:id | 删除会话 |
| GET /meta/data-source-status | cybercloud 配置状态 |

## 5. 技术要点

1. **意图分类**：@mt/model-client chat + JSON 结构化提示词；桩模式关键词判别（「数据/查询/统计/报表」→ data_query；「你好/谢谢/再见」→ chitchat_reject；其余 → product_inquiry）
2. **圈定检索**：跨库只读连接 scholar 库（SCHOLAR_DATABASE_URL），SQL：embedding <=> $1::vector LIMIT k WHERE assistant_scope；引用携带条目标题/来源/相似度
3. **data_query**：可配置 REST（CYBERCLOUD_BASE_URL / CYBERCLOUD_API_KEY）；LLM 生成查询参数（JSON）→ 请求 → LLM 格式化；未配置返回能力边界提示；CYBERCLOUD_STUB 桩模式
4. **端口**：assistant web 4007 / server 5007（已登记 ports.yaml）；独立库 assistant；loadRootEnv 就位
5. **CI**：smoke/e2e 的 assistant 服务加 MT_LLM_STUB=1 + CYBERCLOUD_STUB=1 + SCHOLAR_DATABASE_URL；E2E 三意图 + 多轮上下文各一个用例

## 6. 已确认的决策（2026-08-20 用户确认）

- **A1**：product_inquiry = 跨库只读连 scholar 库（SCHOLAR_DATABASE_URL）+ pgvector 向量 top-k + FTS 兜底
- **A2**：data_query = 可配置 REST（CYBERCLOUD_BASE_URL / CYBERCLOUD_API_KEY）+ LLM 生成查询参数，未配置优雅降级；CI 用 CYBERCLOUD_STUB=1 桩模式
- **A3**：多轮 = conversations/messages 入库持久化，每轮携带最近 10 轮上下文，支持会话列表/历史/删除
- **A4**：引用 = citations 数组（条目标题/来源/相似度分数），Web 聊天页引用卡片点击跳转 Scholar 条目页

## 7. 验收标准（DoD）

1. 三意图路由各至少一个 e2e 用例（桩模式）
2. product_inquiry 只检索圈定条目、回答带引用；未圈定条目不被检索
3. data_query：未配置优雅降级 + 桩模式返回格式化数据
4. 多轮对话上下文连续（指代消解 e2e 用例）
5. Web 聊天页 + HTTP API 双入口均可用
6. CI 全绿 + docs/迭代日志同步 + 合并 main（Phase 3 目标完成）
