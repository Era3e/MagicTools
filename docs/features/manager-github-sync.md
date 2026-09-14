# Manager GitHub 同步与 Webhook

P11 将 GitHub Issue 手动同步与 PR Webhook 的可靠边界补齐：同步能拉全、排除 PR 并更新既有内容；Webhook 使用数据库持久 delivery 去重、租约恢复和 PR 事件时间串行化。

## Issue 同步

入口仍是需求管理页的「同步 GitHub」或 `POST /api/manager/sync/github`，仓库固定由请求传入。GitHub Client 按每页 100 条、最多 20 页分页拉取 `state=all` 的 Issues；返回条目带 `pull_request` 字段时视为 PR 并排除，不会创建需求。超过 2000 条时明确失败，不静默截断。

同步按 `owner/repo#number` 定位既有需求。GitHub 标题、正文、标签或 Issue 状态变化会写回需求的标题、描述、标签和来源 payload；并发修改导致版本冲突时不覆盖本地内容，返回 `conflicts` 计数。无变化条目计入 `skipped`，新条目计入 `created`，页面提示新建与更新数量。

Issue 标题和描述属于需求内容修订，变化会生成新的 `contentRevision`，既有批准自动失效，需要重新审批。标签和来源 payload 不改变内容修订。

## Webhook 验签

除显式 `GITHUB_STUB=1` 的开发与测试环境外，任何环境都必须配置 `GITHUB_WEBHOOK_SECRET` 并通过验签；生产环境同时禁止 `GITHUB_STUB=1` 绕过。任一条件不满足时返回 `signature_required`。签名使用 GitHub 的 `x-hub-signature-256` HMAC-SHA256 头，比对前检查格式和长度并使用常量时间比较；开启签名校验时必须拿到原始请求体，不能用重新序列化后的 JSON 代替。签名不匹配不写任何数据库状态。

开发与测试可用 `GITHUB_STUB=1` 跳过签名，但生产标志 `NODE_ENV=production` 或 `MT_PROD=1` 优先于桩开关。

## 持久 Delivery

Webhook 必须携带唯一的 `x-github-delivery`。Manager 在 `github_webhook_deliveries` 中原子领取 delivery：新 delivery 写入 `processing` 并绑定随机 consumer 与默认 60 秒租约；相同 delivery 重试在未过期时直接返回 `deduplicated`。进程崩溃后租约过期可重新领取，重复执行依赖状态机与事件时间保护。

处理成功或明确跳过时写 `done`，处理异常写 `error`；回执必须匹配当前 `locked_by` 且 delivery 仍为 `processing`，因此过期后仍在运行的旧消费者不能误关新消费者领取的租约。`error` 不是丢弃状态，同 delivery 的后续重试可重新领取并再次执行，重复效果仍由事件时间与状态机约束。delivery 记录包含事件名、动作、payload SHA256、锁持有者和租约时间，用于审计与恢复。

## 乱序保护

PR payload 必须携带有效的 `pull_request.updated_at`。需求保存 `github_last_event_at`，状态迁移在同一数据库事务中行锁读取、比较并更新；事件时间早于或等于已处理时间时返回 `out_of_order`，不会回退状态或追加时间线。较新事件才推进状态、时间线和事件时间。

仍保留原有状态机保护：PR 是外部事实，可补齐中间状态，但不能把已验收或已完成需求回退，也不能直接宣布产品完成。

## 升级与验证

迁移 010 新增 delivery 表、回收索引和 `requirements.github_last_event_at`。旧 delivery 的内存去重被移除，进程重启后同一 GitHub delivery 不会产生第二次状态效果。

关键验证：GitHub Client 分页与 PR 排除单测、Manager 真实数据库同步更新契约、Webhook 签名/生产强制/原始请求体/持久幂等/过期租约与旧消费者回写保护/乱序保护单测与数据库契约。
