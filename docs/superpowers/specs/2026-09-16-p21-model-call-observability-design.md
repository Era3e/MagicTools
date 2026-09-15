# P21：模型调用超时、用量与追踪设计

> 设计状态：当前设计基线。实施基于 P20 合并后的 `a4aace1`。

## 目标

补齐模型客户端的执行控制与观测语义：请求可超时/取消，失败和重试可见，流式 token 用量只认供应商返回，调用记录可关联业务任务与链路。

## 方案

1. `@mt/model-client` 统一组合外部 signal、默认 120 秒超时和流式提前退出，底层 fetch 收到同一个 AbortSignal。
2. chat、chat-stream、embedding 输出结构化 `UsageLog`，记录模型请求/生效身份、状态、attempt/attempts、耗时、错误与上下文。
3. `@mt/db` 新增 `recordModelCall`，7 个调用模型的服务库创建一致 `model_calls` 表并按调用 ID 幂等写入。
4. 各服务 wrapper 只做 service 补充、耗时映射和异步持久化；持久化失败不改变业务调用结果。
5. Assistant 用 AsyncLocalStorage 把意图日志、会话和消息上下文带进模型调用。

## 验收

- 流式片段数不得作为 token 数；缺 usage 时 token 为 NULL 且来源为 `unknown`。
- 超时和外部取消能中止底层请求，并分别形成 timeout/cancelled 记录。
- 429/5xx 重试期间每次失败均记录，成功记录最终 attempt/attempts。
- 数据库拒绝估算 token 来源，重复调用 ID 不覆盖第一条记录。
- 普通单测不触碰数据库；真实数据库用例 skip=0。
- 完整 `qa:gate`、PR quality/smoke/e2e、合并后 Release 与 main CI 全绿。

## 边界

- live provider 本批不真实请求，外部模型效果与账单核对标记 `not-run`。
- 微调请求支持超时/取消，但不纳入本批 `model_calls` 持久化。
- 不在本批实现预算扣减、自动限流或管理端报表。
