# Manager 自动执行任务租约

P22 在需求执行契约之上增加持久任务队列。它回答三个可靠性问题：同一需求修订不会被并发执行多次、崩溃执行者不能冒用旧租约回写、服务重启后悬挂执行会被显式恢复而不是永远占用队列。本批只提供队列与回写契约，真实隔离编码执行器由 P23 接入。

## 数据模型

- `execution_jobs`：一个需求内容修订最多一条 job，绑定 `requirement_revision`、`content_revision`、执行契约快照、`attempts/max_attempts` 和终态。状态为 `queued/running/retry/succeeded/failed/cancelled`。
- `execution_runs`：每次领取是一条 run，绑定 attempt、executor、run token 哈希、heartbeat、租约、硬截止、结果或错误。状态为 `running/succeeded/failed/expired/cancelled`。
- `requirements.automation_policy`：默认 `manual`；owner 显式排队成功后改为 `owner-token`。该字段变更与 job 创建在同一事务内完成。

`(requirement_id, content_revision)` 唯一约束比“仅限制活动 job”更严格：同一修订失败后不能通过重新排队绕过 `maxAttempts`，内容变化产生新修订后才能再次排队。

## 身份与配置

| 操作 | 凭证 |
|---|---|
| 排队、取消 | `x-manager-approval-token: $MANAGER_APPROVAL_TOKEN` |
| 领取、心跳、成功、失败、恢复 | `x-manager-executor-token: $MANAGER_EXECUTOR_TOKEN` |
| run 级回写 | 领取响应一次性返回 `runToken`，后续放在 `x-manager-run-token` |

两个服务令牌都要求至少 32 个可见 ASCII 字符。run token 只在领取响应出现一次，数据库保存 SHA-256 哈希；列表和详情接口不返回 token 或哈希。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/requirements/:id/execution-jobs` | owner 排队；要求内容已批准、状态为 `todo`、契约和依赖均就绪 |
| GET | `/requirements/:id/execution-jobs` | 查看该需求的 job 与 run 审计 |
| GET | `/execution-jobs` | 按 `requirementId` / `status` 过滤，最多返回 200 条 |
| GET | `/execution-jobs/:id` | 查看 job 详情和全部 run |
| POST | `/execution-jobs/claim` | executor 领取一个 queued/retry job；无任务返回 `{ "claimed": false }` |
| POST | `/execution-jobs/:id/heartbeat` | run token 续租，不能超过本次尝试硬截止 |
| POST | `/execution-jobs/:id/complete` | 写入不超过 20KB 的 JSON 结果并终结成功 |
| POST | `/execution-jobs/:id/fail` | 写入失败；attempt 未达上限时 job 进入 retry |
| POST | `/execution-jobs/:id/cancel` | owner 取消 queued/running job |
| POST | `/execution-jobs/recover` | executor 将过期 running run 置为 expired，并恢复 job |

领取请求的 `executorId` 只允许 1-100 位 `A-Za-z0-9._-`；`leaseMilliseconds` 为 5 秒到 1 小时，默认 60 秒，并被契约 `maxDurationMinutes` 截断。执行契约快照随 job 保存，后续修订不会改变已排队任务的授权边界。

## 生命周期

1. owner 排队：事务锁定需求、复验硬门禁、写入 job，并把 automation policy 置为 `owner-token`。
2. executor 领取：先恢复已过期 run，再用 `FOR UPDATE SKIP LOCKED` 选择 queued/retry job，原子递增 attempt 并创建 running run。
3. 执行中：executor 定期 heartbeat。租约可以续期，但 `hard_deadline_at` 由契约时长决定，不能无限延长。
4. 成功/失败：回写必须同时满足 job/run 状态、run token 哈希和 `lease_expires_at > now()`。失败未达上限进入 retry，达到上限进入 failed。
5. 崩溃恢复：过期 run 标记 expired；attempt 未达上限时 job 回到 retry，否则 failed。恢复不判断进程是否真的死亡，只以数据库租约为准。
6. 领取前隔离：如果需求内容修订、批准状态或需求状态在排队后变化，领取会把旧 job 置为 failed，不允许旧批准版本继续执行。

## 验证与边界

真实数据库用例 `apps/manager/server/src/execution-jobs.e2e.test.ts` 覆盖硬门禁、重复排队、并发领取唯一 run、过期回写拒绝、恢复重试、重试上限、内容变化隔离、取消和执行器鉴权。本批没有启动真实编码进程，也没有创建 PR、发送通知或自动合并；live executor 结论为 `not-run`。生产启用前必须配置独立 executor token，并确保只有 P23 执行器所在身份能访问该凭证。
