# 模型调用超时、取消与用量观测

## 目标

让每一次 chat、流式 chat 和 embedding 调用都有可追踪的执行身份：真实生效模型、请求模型、供应商、状态、重试位置、耗时、任务/链路上下文和 token 来源。超时与外部取消会中止底层请求，供应商没有返回 usage 时明确记录 `unknown`，不再用流式片段数冒充 token 数。

## 调用契约

- `ChatOptions` 与 `EmbedOptions` 支持 `signal`、`timeoutMs` 和 `context`；微调请求支持 `signal` 与 `timeoutMs`。
- 默认超时 120 秒，供应商配置可用 `defaultTimeoutMs` 覆盖；显式 `timeoutMs` 优先。
- 外部 signal、超时 controller 和流式消费方提前退出都会中止底层请求。
- chat/embedding 对 429 和 5xx 做最多 3 次重试；取消、超时和非重试错误立即终止。
- 每次失败尝试和最终成功尝试都独立上报，记录 `attempt/attempts`。
- `runWithModelCallContext` 通过 AsyncLocalStorage 给调用链补充 service、operation、taskId、traceId 和 metadata；显式 context 覆盖同名环境上下文。

## 用量语义

- 非流式调用读取供应商 `usage.prompt_tokens/completion_tokens` 或等价字段。
- 流式请求发送 `stream_options.include_usage=true`，只认最终 usage 帧。
- `inputTokens/outputTokens` 允许为 NULL；此时 `tokenSource=unknown`。
- `tokenSource=provider` 仅在供应商至少返回一个 token 数时使用。
- 调用记录包含 success/error/timeout/cancelled、错误码与错误消息，取消状态同时置 `cancelled=true`。

## 持久化

`@mt/db` 提供 `recordModelCall`，7 个实际调用模型的服务库均新增相同 `model_calls` 迁移：

- Applicant
- Assessor
- Assistant
- Designer
- Gatherer
- Investigator
- Scholar

各服务 wrapper 统一补充 `service` 与 `latencyMs` 后异步写入本服务数据库。写入失败只记录 `[model-call] persist failed`，不影响业务结果；`NODE_ENV=test` 时不落库，避免普通单测触碰真实数据库。

表结构按调用 ID 幂等插入；重复 ID 不覆盖既有记录。`operation`、`status`、`token_source` 由数据库 CHECK 约束限制，`attempt/attempts`、token 数和延迟必须非负。

## Assistant 链路上下文

- 意图分类：`service=assistant`、`operation=intent-classification`，附带 conversationId 与 userMessageId。
- 澄清确认执行：`traceId/taskId=intentLogId`。
- 正常执行分支：`traceId/taskId=intentLogId`。

## 验证与边界

- 单测覆盖超时、外部取消、重试逐次记录、真实 usage、流式缺 usage、提前退出和上下文合并。
- Assistant 数据库用例覆盖真实模型身份、重试记录、`unknown` token 来源、非法 `estimated` 来源拒绝和调用 ID 幂等。
- 本批不调用 live provider，真实外部模型效果与账单核对标记为 `not-run`。
- 微调请求已支持超时与取消，但不写入 `model_calls`；它不是本批定义的 chat/embedding token 消耗调用。
