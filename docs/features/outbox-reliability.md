# Outbox 租约与可靠消费

P12 修复跨库事件消费的两个可靠性缺口：领取锁只覆盖查询语句、业务副作用完成后才允许标记 done。该机制供 Investigator、Assessor、Manager、Gatherer 与 Scholar 的跨库链路复用。

## 生产事件

`appendOutbox` 使用事件 ID 作为数据库幂等键，重复发送同一 `DataEnvelope` 只会保留一行。生产者仍应使用稳定 ID（例如业务对象 ID 派生的 idempotency key），不能用每次调用生成的新 UUID 表达同一业务事件。

## 领取与租约

消费者领取事件时使用单条 `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)`：

1. 待处理的 `pending/retry` 或租约过期的 `processing` 行按 `occurred_at` 排序领取；
2. 行状态写为 `processing`，原子递增 `attempts`，记录 `locked_by` 与 `lease_expires_at`；
3. handler 在租约内执行业务副作用；
4. 成功后仅持有该租约的消费者可写 `done`，失败则写 `retry/dead` 并清空租约；
5. 进程崩溃后租约过期，新消费者可重新领取；若过期行的 `attempts` 已达到上限，领取前先进入 `dead`，不再执行业务；迟到旧消费者不能再修改状态。

默认租约 60 秒，批次 10 条，最多尝试 5 次。调用方可通过 `consumerId`、`leaseMilliseconds`、`batchSize`、`maxAttempts` 显式覆盖。业务 handler 超过租约时必须自行拆分或延长租约；不要用长时间外呼占用单条租约。

## 消费方式

`processOutbox` 保持逐事件 API，适合简单副作用。需要按批次聚合或跨事件建业务记录时使用 `processOutboxBatch`：一批事件先进入 `processing`，handler 内完成业务写入，全部成功后才逐行置 `done`；handler 抛错时整批释放租约并进入 `retry`，依赖业务幂等键避免重复副作用。

Assessor 聚合 `researcher.response.push` 为分析请求、Manager 消费 `requirement.created` 建需求、Scholar 消费 `knowledge.item.collected` 建馆藏条目，均已切换到批处理 API。重复 poll 没有新事件时返回 `consumed=0`；`skipped` 只表示本批领取到的重复业务键，不再扫描历史 done 行。

业务幂等键不能依赖本次领取事件的组合。Assessor 为 `analysis_requests` 增加稳定 `source_key`：有调研 ID 时使用 `survey:<id>`，否则使用 `survey-name:<name>`；请求头与全部明细在同一事务写入，重放只追加缺失事件 ID 和明细。存量请求使用 `legacy:<id>`，不猜测历史来源归属。Manager 为 `source='assessor' AND source_ref<>''` 建立部分唯一索引，并发重放时插入返回 `null`，poll 回读既有需求并计入 `skipped`。

## 状态

| 状态 | 含义 |
|---|---|
| pending | 已写入，等待领取 |
| processing | 已被消费者持有租约 |
| retry | 业务失败且未达上限 |
| done | 业务副作用完成后确认 |
| dead | 达到尝试上限，需人工处理 |

## 升级与验证

新增迁移为 `packages/db/migrations/002_outbox_lease.sql` 以及四个存量事件库的对应迁移，添加 `locked_by`、`lease_expires_at` 和回收索引。升级只补列和索引，不改历史事件状态。

可靠性补尾迁移：

- `packages/db/migrations/004_outbox_attempt_count.sql`：领取时递增尝试次数的语义锚点，无需结构变更；
- `apps/assessor/server/migrations/005_assessor_request_atomic.sql`：补 `source_key`、存量 legacy 键和唯一索引；
- `apps/manager/server/migrations/011_requirement_source_unique.sql`：创建 Assessor 来源部分唯一索引。

Manager 唯一索引创建前会显式检测存量重复 `source_ref`。若存在重复，迁移会失败并列出待人工确认的重复组数量；系统不会自动合并或猜测应保留的需求。

关键验证：`pnpm test:db --project db` 覆盖并发消费者、重复 append、过期租约恢复、尝试次数耗尽后 dead、批处理成功与失败重试；`pnpm test:db --project assessor` 覆盖请求/明细原子回滚与稳定来源键追加；`pnpm test:db --project manager` 覆盖同来源事件并发插入只保留一条需求。
