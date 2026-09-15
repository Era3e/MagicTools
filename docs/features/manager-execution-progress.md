# Manager 执行进度、待验收与通知

P24 在 P22/P23 的任务租约和隔离执行器之上补齐交付可视化与通知闭环。执行成功只说明候选代码通过契约验收并发布 PR，不等于产品验收完成，也不等于生产部署完成；PR 状态、人工验收状态和部署状态分别记录，不能互相冒充。

## 使用入口

在 Manager 前台进入需求详情页。只要有自动执行任务，页面会显示“执行进度与待验收”区域：

- 当前 job 状态、尝试次数、内容修订和取消原因；
- 每次 run 的执行者、心跳时间、失败/超时原因；
- 成功候选的 base SHA、candidate SHA、分支、PR 链接、独立验收命令结果和证据包摘要；
- PR 状态与部署状态。部署回执有链接时可直接打开。

没有自动执行任务时显示明确空态。读取失败显示错误，不用空白或加载中掩盖。

## 状态与事务边界

执行器成功回写时，Manager 在同一事务内完成：

1. 校验 executor token、run token、run 状态和租约；
2. 校验结果中的 jobId/runId 与实际任务一致，验收记录必须全部为 `success/exit 0`；
3. 将 run/job 置为 `succeeded`；
4. 将需求从 `todo` 推进到 `accepting`，写入“自动执行完成，等待人工验收”时间线，并保存候选分支与 PR；
5. 将 PR 状态置为 `open`、部署状态重置为 `not-started`；
6. 写入稳定 ID 的 `execution.notification` outbox 事件。

稳定事件 ID 为 `execution:<runId>:succeeded`。终态失败使用 `execution:<runId>:failed`，取消使用 `execution:<runId>:cancelled`。重复写同一 ID 不会新增通知；中间 retry 不发通知，避免执行器短暂失败造成噪音。

人工可以把 `accepting` 需求推进到 `done`，也可以退回 `testing`。本功能不会因为部署成功自动完成需求。

## PR 与部署状态

| 字段 | 含义 |
|---|---|
| `prState` | `unknown/open/merged/closed`，来自执行器回写、手动刷新或 GitHub Webhook |
| `prCheckedAt` | 最近一次获得 PR 事实的时间 |
| `deploymentState` | `not-started/pending/deploying/succeeded/failed/rolled-back` |
| `deploymentRef` | 外部发布标识，例如 release ID |
| `deploymentUrl` | 部署或 CI 回执链接 |
| `deploymentCheckedAt` | 最近部署回执时间 |

部署回执必须携带 `x-manager-approval-token` 和需求 `expectedRevision`，避免并发覆盖。记录 `succeeded` 前必须已经看到 PR `merged`；失败或回退状态可以在任意阶段记录。该接口只记录事实，不触发部署，也不改变需求状态。

## 通知配置与调度

Manager 使用自身 outbox 表保存通知。配置以下环境变量后，服务启动时每 30 秒自动领取待处理通知：

| 变量 | 要求 |
|---|---|
| `MANAGER_NOTIFICATION_WEBHOOK_URL` | HTTPS 接收端地址 |
| `MANAGER_NOTIFICATION_WEBHOOK_TOKEN` | 可选 Bearer token |

通知请求体包含 `eventId/event/source/payload/occurredAt`。接收端返回 2xx 才标记 done；失败进入 retry，达到 5 次进入 dead。outbox 领取有租约，重复调度不会重复外发；事件名过滤确保通知调度不会消费其他业务事件。

未配置 webhook 时，事件保持 pending，状态接口返回 `configured=false`。这表示“未配置通知接收端”，不能解释为已通知。也可由持有 owner token 的计划任务调用 `POST /execution-notifications/dispatch` 手动触发一次。

## API

所有路径前缀为 `/api/manager`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/requirements/:id/execution-jobs` | 需求执行 job/run 与证据详情 |
| GET | `/execution-notifications` | 最近 100 条执行通知、全局状态计数和 webhook 配置状态 |
| POST | `/execution-notifications/dispatch` | owner 手动调度一次通知投递 |
| POST | `/requirements/:id/deployment-status` | owner 记录独立部署状态，携带 expectedRevision |

## 验证与边界

- 真实数据库用例：`apps/manager/server/src/execution-progress.e2e.test.ts`，覆盖成功推进待验收与事务通知、outbox 去重投递、终态失败通知、部署状态独立和 PR 合并门禁。
- 前端组件用例：`apps/manager/web/src/pages/RequirementExecutionPanel.test.tsx`。
- outbox 事件过滤用例：`packages/db/src/outbox.test.ts`。
- 本批验证使用 mock webhook 接收端，证明 Manager 调度与去重；真实飞书/企业微信等接收端未配置时保持 `not-configured`，不宣称已通知。
- 本批不实现 P25 自动合并。即使 PR、CI 和部署全部成功，最终验收仍需人工或后续明确授权的规则决定。
