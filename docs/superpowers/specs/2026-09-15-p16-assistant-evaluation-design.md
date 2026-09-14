# P16 独立问答评测数据与版本比较设计

> 设计状态：当前设计基线。实现过程中若范围变化，先修订本文件再继续。

## 背景

现有 Assistant 评估复用 `intent_logs.corrected_intent`：few-shot、回放评估和微调数据导出都调用 `listCorrectedLogs()`。这带来训练/评测同源泄漏，也没有持久 run 明细、超时/错误记录或新旧配置同批比较。

## 目标

1. 评测样本数据库版本化，并按 `routing`、`knowledge`、`action` 分为 dev、regression、holdout。
2. 评测样本通过规范化消息指纹从 few-shot 与微调导出中排除。
3. 每次 run 持久化配置快照、数据集指纹、全部 case 明细和 pass/fail/error/timeout/missing 计数。
4. 只允许相同 split 与数据集指纹的 run 比较，输出 fixed、regressed、error、timeout、missing。
5. action 评测只解析 action/params，不调用网关或真实业务系统。
6. 配置快照不保存任何 API key 或私密环境值。

## 数据模型

- `intent_logs.message_fingerprint`：数据库触发器按小写、全半角归一并压缩空白后的消息计算 MD5；存量行迁移时回填。
- `evaluation_cases`：case key、类型、split、最终用户消息、多轮 history、期望结果、启用状态。
- `evaluation_case_fingerprints`：case 与消息指纹的隔离表；最终消息和多轮 history 中的用户消息都会进入隔离集合。
- `evaluation_runs`：split、label、数据集指纹、配置快照、期望总数和终态计数。
- `evaluation_run_items`：每个 case 一行，保存实际输出、期望输出、状态、原因与耗时。
- run 每处理一条明细刷新 heartbeat；服务重启时将心跳超过阈值的 running run 显式置为 interrupted，数据库唯一部分索引保证同一时刻只有一个活动 run。

## 评分器

- routing：校验 domain、intent，可选校验 confidence 下限。
- knowledge：校验回答包含词、禁词与引用数量。
- action：校验 action 与 params 的部分匹配。
- 执行器超时会落 `timeout`；异常落 `error`；选择集中缺明细会补 `missing`。`expected_total == run_items count` 是硬约束。

## API 与 UI

- `GET /api/assistant/evaluation-suite/cases`
- `POST /api/assistant/evaluation-suite/runs`
- `GET /api/assistant/evaluation-suite/runs`
- `GET /api/assistant/evaluation-suite/runs/:id`
- `POST /api/assistant/evaluation-suite/runs/:baselineId/compare/:currentId`

IntentLogPage 新增独立评测卡：选择 split 发起 run、查看最近 run、选择 baseline/current 比较。不新增页面路由。
holdout 的 run 详情只返回 case key、类型、状态和耗时，不返回消息、期望、实际输出或失败原因，避免调参泄漏。

## 非目标

- 不引入 LLM judge。
- 不在本批实现真实生产模型效果门禁；run 明确记录桩/真实模式。
- 不执行任何动作副作用，不改变现有澄清与路由主链路。

## 验收

- 种子数据为 routing 18/12/6、knowledge 3/2/1、action 3/2/1。
- 评测消息即使被纠错，也不进入 few-shot、回放或 JSONL 导出。
- 微调就绪计数与导出使用同一隔离口径，评测消息不能抬高 500 样本门禁。
- dev run `expected_total=24` 且明细数相同；缺样本、错误和超时不被剔除。
- 相同 run 可比较，数据集变更后的 run 拒绝比较。
- 只允许比较明细完整的 completed run；failed/interrupted/partial run 不能参与版本比较。
- 独立数据库测试进入 `database-suites.json`，关键用例 skip=0。
