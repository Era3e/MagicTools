# P22 Manager 自动任务领取、租约与恢复设计

> 设计状态：当前设计基线。实施基于 P21 模型调用观测批次后的 Manager 契约。

本设计承接用户已批准的 P01–P26 持续落地范围。P08 已经定义执行契约、内容修订审批和自动执行门禁，但 `automation_policy` 仍固定为 `manual`；P22 在其上补齐可被后续 P23 隔离执行器调用的任务队列，不实现编码、PR 创建、通知或自动合并。

## 目标

1. 同一个需求同一个内容修订最多存在一个活动执行。
2. 执行者只能回写自己持有且租约未过期的 run。
3. 执行者崩溃或服务重启后，过期 run 被显式隔离，按契约重试或进入终态。
4. 队列、领取、心跳、成功、失败、取消和恢复都有持久审计记录。

## 非目标

- 不启动编码进程，不访问仓库和模型。
- 不创建或合并 PR，不发送通知，不展示执行进度页面。
- 不把生产秘密交给执行器；本批只定义 Manager 侧队列契约。

## 数据模型

`execution_jobs` 保存一次需求修订的执行意图，绑定 `requirement_id`、`requirement_revision`、`content_revision`、执行契约快照、尝试数和终态。`(requirement_id, content_revision)` 唯一，防止同一修订绕过重试上限重复排队。

`execution_runs` 保存每次领取尝试，绑定 attempt、executor id、run token 哈希、心跳、租约和硬截止时间。run 状态为 `running/succeeded/failed/expired/cancelled`；job 状态为 `queued/running/retry/succeeded/failed/cancelled`。

`requirements.automation_policy` 从仅允许 `manual` 扩展为 `manual/owner-token`。默认仍为 `manual`；只有 owner token 显式排队通过全部硬门禁后才置为 `owner-token`。

## API

- `POST /requirements/:id/execution-jobs`：owner token 授权，要求内容已批准、状态为 `todo`、契约存在、依赖完成；成功后排队。
- `GET /execution-jobs` / `GET /execution-jobs/:id`：查看 job 与 run 审计，不返回 run token 或哈希。
- `POST /execution-jobs/claim`：executor token 授权，领取一个 queued/retry job，返回一次性 run token 和契约快照。
- `POST /execution-jobs/:id/heartbeat`：executor token + run token 续租，不能超过单次尝试硬截止。
- `POST /execution-jobs/:id/complete`：executor token + run token 写入受限结果并终结成功。
- `POST /execution-jobs/:id/fail`：executor token + run token 写入失败，未达上限进入 retry。
- `POST /execution-jobs/:id/cancel`：owner token 取消 queued/running job。
- `POST /execution-jobs/recover`：executor token 将过期 running run 置为 expired，并按上限恢复为 retry 或 failed。

## 可靠性规则

领取使用事务和 `FOR UPDATE SKIP LOCKED`。每次领取先原子递增 job attempts，再创建 run；并发执行者不会拿到同一 job。心跳、成功和失败都同时校验 run 状态、token 哈希和 `lease_expires_at > now()`，过期者不能回写。

恢复不猜测执行者是否存活，只以租约为准。过期 run 标记 expired；attempt 未达到契约 `maxAttempts` 时 job 回到 retry，否则 failed。排队后发现内容修订、批准状态或需求状态变化时，领取会将 job 置为 failed，不允许旧批准版本继续执行。

## 验证

新增 Manager 真实数据库集成测试覆盖硬门禁、重复排队、并发领取唯一性、心跳与过期回写拒绝、恢复重试、重试上限和取消。随后执行 Manager 目标测试、数据库套件、完整 `qa:gate`，并在 PR 中记录 live executor 为 `not-run`（P23 才接入真实隔离执行器）。
