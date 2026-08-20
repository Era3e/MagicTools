# cybercloud（cloud-meta）接入手册

> 契约来源：从后端源码 D:\cybercloud\cloud-meta 逆向（auth-adaptor / meta-adaptor / common-authentication 模块），无官方文档。
> 用途：Assistant 的 data_query 意图经此对接 cybercloud 智能体，由平台侧智能体完成业务数据查询（含其动态 HTTP 工具/指标/报表能力）。

## 1. 认证机制总览

- 所有管理类接口通过 payload 请求头认证：值为 URL 编码（UTF-8）的 UserDto JSON（含 tenantCode/userId/userName/console 等字段）。
- 外部集成用「API Key」换取 payload，全程无需账号密码：
  1. 在 cybercloud 控制台创建用户 API Key（用户管理 → 访问密钥，记录 apiKey 与过期时间）；
  2. 调用匿名接口用 apiKey 换 payload（见 2.1）。
- 替代路径（Sa-Token）：POST /api/auth/login/by/access-token {accessToken} → {token}，再由前端会话体系换成 payload；外部集成建议直接用 2.1。

## 2. 接口契约（基础路径 = 部署域名，如 https://cyber.example.com）

统一说明：返回结构为 {code: "0"|"1", message, data}（code=0 成功；1 业务失败，message 为错误文案）；除注明外请求均为 POST + application/json，管理接口需带 payload 头。

### 2.1 用 API Key 换 payload（匿名，无需 payload 头）

POST {base}/api/auth/setup/user/access/token/userByApiKey，请求体：{apiKey: "xxx"}

响应：{code: "0", data: {payload: "UserDto JSON 字符串"}}

客户端使用：payload 头 = encodeURIComponent(payload 原文)（Java 侧 URLDecoder 解码，%20 与 + 均兼容）。payload 有效期内可缓存复用（建议 30 分钟）。

### 2.2 智能体列表

POST {base}/api/setup/agent/chat/agents，请求体：{from: "Setup"}（必填，枚举 App | Setup）

响应 data 为智能体数组：[{id, name, description, status(PUBLISHED/DRAFT), enabled, ...}]。
选择策略：优先 enabled != false 且 status != DRAFT 的智能体。

### 2.3 创建对话会话

POST {base}/api/setup/agent/chat/session/create，请求体：{agentId: "xxx"}（必填）

响应：{code: "0", data: {code: "会话编码", ...}}，后续对话用该 code。

### 2.4 阻塞对话（非流式，外部集成推荐）

POST {base}/api/setup/agent/chat/block，请求体：{message: "本月销售额多少", sessionCode: "会话编码", temperature: 0.3}

响应：{code: "0", data: {type: "MARKDOWN", data: "回答文本", toolCalls: []}}

SSE 类型：

| type | 含义 | data |
| --- | --- | --- |
| MARKDOWN | 文本回答 | 字符串 |
| METRIC_CHART | 指标图表 | 图表 JSON |
| REPORT_CHART | 报表图表 | 图表 JSON |
| ERROR | 错误 | 错误文案 |

流式对话：POST {base}/api/setup/agent/chat/stream（text/event-stream，逐条返回 {type,data}）。

### 2.5 其它相关接口（备用）

- 会话历史：POST {base}/api/setup/agent/chat/session/messages {code: "会话编码"}
- 会话列表：POST {base}/api/setup/agent/chat/session/list
- 简易对话（无智能体，纯提示词）：POST {base}/api/setup/agent/chat/simple {systemPrompt, temperature, message} → data 为字符串
- 登录换 token：POST {base}/api/auth/login {username, password}（Sa-Token）

## 3. MagicTools 配置（.env）

CYBERCLOUD_BASE_URL=https://cyber.example.com   # cybercloud 部署地址
CYBERCLOUD_API_KEY=xxx                          # 控制台创建的用户 API Key
CYBERCLOUD_AGENT_ID=                            # 可选：指定智能体 ID；缺省自动选择第一个可用智能体

- 未配置时 Assistant 的 data_query 优雅降级为提示文案；
- 本地/CI 用 CYBERCLOUD_STUB=1 桩模式（返回固定销售额数据），不发起真实请求。

## 4. 客户端调用时序（Assistant 实现）

query(message) → apiKey 换 payload（缓存 30 分钟）→ 列智能体取 agentId（CYBERCLOUD_AGENT_ID 优先）→ 建会话取 sessionCode（按 agentId 缓存）→ block 对话 → 按 type 格式化回答。

## 5. 与平台 Agent 工具的关系

cybercloud 智能体可挂「动态 HTTP 工具」（docs/dynamic-http-tool-api.md 契约）与指标/报表工具（metric_qry / report_qry），业务数据查询由 cybercloud 侧完成；MagicTools 只负责把用户自然语言转发给已配置好工具的智能体，并格式化其回答。
