# Gatherer 自动推送与运行回执

P13 修复采集链路的三个交付缺口：新增条目没有传入自动推送、推送事件缺少稳定幂等键、调度状态看不到真实注册与最近运行结果。

## 自动推送

信息源 `options.autoPush` 为 `true` 时，采集完成后会推送该源所有尚未推送的条目。新采集正常推送新条目；如果条目已入库但推送前进程中断，下一次采集会补推这些未推送条目。重复采集没有待推送条目时，不写新的 `knowledge.item.collected` 事件。

后台新增/编辑源提供「采集后自动推送」开关。该开关写入 `options.autoPush`，不影响已有其他源配置。

## 推送幂等

每条条目的推送事件 ID 固定为 `gatherer-item-push-<itemId>`。重复点击推送或自动推送重放时：

1. 已有 `pushed_at` 的条目被跳过；
2. `pushedCount` 只统计本次实际待推送条目；
3. `skippedCount` 统计请求中已推送或未命中的条目；
4. outbox 事件 ID 不变，不追加重复事件。

待推送选择和按 ID 回读都走数据库精确条件，不受列表接口最新 200 条限制；超过 200 条的历史未推送条目也会全部进入本次自动推送。

Scholar 侧仍保留自己的 `(source, source_ref)` 唯一约束，作为消费侧最后防线。

## 调度实况

`GET /api/gatherer/meta/scheduler-status` 返回每个 active 且配置合法 cron 的源：

- `registered`：当前进程是否实际注册 node-cron 任务；
- `lastRunAt`、`lastRunStatus`：最近一次运行时间和终态；
- `lastRunFetchedCount`、`lastRunNewCount`：拉取与新增计数；
- `lastRunError`：最近运行错误。

服务启动时注册任务；通过 API 新建或更新源后刷新注册，不需要重启进程。直接改数据库不会触发刷新，状态页会显示 `registered=false` 提醒配置与运行进程不一致。

恢复部署演练已同步该行为：源环境先用不会触发的合法 cron 验证手工采集正控与调度静默，再断开源 Gatherer 与专用接收器网络、通过 API 切换为高频 cron 并确认注册。备份快照因此仍携带活动调度任务，可继续验证恢复端“任务实际运行但无法外联”的隔离约束。

## 死信追踪

采集重试耗尽后写入 `gatherer.collect.dead_letter` outbox 事件。`GET /api/gatherer/meta/dead-letters` 按发生时间倒序返回最近 50 条，包含来源、运行 ID、错误、事件状态、尝试次数和发生时间。

后台「信息源管理」页的「调度实况」区域同时展示调度注册状态、最近运行回执和死信列表。死信展示不消费事件；处理完成后事件状态由对应通知消费者推进。
