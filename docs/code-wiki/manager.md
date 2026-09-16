# Manager 模块

> 文档状态：当前模块事实源快照（2026-09-16）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 6.4 Manager（管理·需求主线核心）

**端口**：Web 4004 / Server 5004
**主题**：COCKPIT_THEME（驾驶舱风 — Consolas / 冷灰蓝 / 天蓝）

## 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 需求 | RequirementController | RequirementService | RequirementRepo | 7 态生命周期 / 事务更新与 revision 冲突 / PR 联动 / 规划验收与来源证据 |
| 迭代 | IterationController | IterationService | IterationRepo | 迭代管理（增删改查 + 需求关联） |
| 候选与能力基线 | ImportController / CapabilityController | ImportService | manager_import_batches / manager_import_links / capabilities | 预览、选择确认、剩余批次、稳定来源去重、冲突回滚；基线与规划分开保存 |
| 内容修订与审批 | RequirementController / RequirementApprovalController | RequirementApprovalService | requirement_revisions / requirement_approvals | 数据库触发器保存内容快照；行锁与双版本审批；单用户凭证身份；追加批准/撤销记录 |
| 自动执行任务 | ExecutionJobsController | ExecutionJobsService | execution_jobs / execution_runs | owner 排队绑定批准修订；executor 领取、心跳、回写、取消与过期恢复 |
| 执行通知 | ExecutionNotificationsController | ExecutionNotificationsService | outbox / requirements | 执行终态事务通知、webhook 租约投递与去重状态 |
| 条件合并授权 | ExecutionJobsController | ExecutionJobsService | execution_jobs / execution_runs / requirements | 独立 merge token 读取成功候选、当前批准修订、PR 身份与允许路径 |
| 资源面板 | ResourcesController | ResourcesService | operations_resources / operations_secret_refs / operations_resource_checks | 资源归属、预算、备份与手册；密钥只存来源一致的引用，检查结果四态分计 |

**消费事件**：`requirement.created`（ASSESSOR_DATABASE_URL processOutboxBatch，业务入库后确认 done）
**外部集成**：`github/client.ts` — Phantom GitHub Issues 同步（GITHUB_STUB=1）
**GitHub 同步与 Webhook**：Issues 分页拉全并排除 PR，既有内容变化经 `expectedRevision` 更新；PR Webhook 除显式桩模式外强制 HMAC 且只对原始请求体验签，`github_webhook_deliveries` 持久领取 delivery、恢复过期租约与异常重试，并仅允许当前锁持有者回写，按 `github_last_event_at` 拒绝乱序回调。

## 需求 7 态状态机

```
待分析 → 设计中 → 待开发 → 开发中 → 测试中 → 待验收 → 已完成
```

## 前端路由

```
前台（UserShell /manager）：
  /              RequirementBoard   FLIGHT DECK 七泳道看板（优先级色条 + PR 标记）
  /requirements/:id  RequirementDetail  飞行日志（仪表卡+简报+时间线）

后台（AdminShell /manager/admin）：
  /admin/requirements  RequirementList  需求管理表格 + 候选导入 + 能力基线视图
  /admin/iterations    IterationList    迭代管理
  /admin/resources     ResourceList     资源、密钥引用与运行面板
```

2026-09-11 起，手工状态迁移由 `requirement-policy.ts` 约束；字段与状态在行锁事务中合并，新客户端提交 expectedRevision，过期返回 409。PR 同状态不增加修订，不能回退 accepting/done。详情的关联草稿与服务器基准分离，冲突后不会自动使用新版本覆盖旧内容。

候选导入支持 `magictools-requirement-candidates/0.1`：baseline 保存为 capabilities，planned 保存为 waiting/manual 需求；源码观察不等于已验收或已部署。接口、来源与大小上限见 [Manager 候选导入说明](../features/manager-candidate-import.md)。关键数据库验证使用 `pnpm test:manager:integration`，并由本地与 CI 共用的 qa:gate 强制执行。

P08 通过迁移 006/007/008 增加 `contentRevision`、快照、审批事件和执行契约。内容字段或执行契约改变时递增内容版本，操作信息变更只影响并发版本；批准绑定指定内容，变更后显示 outdated。详情页支持内容编辑、冲突草稿恢复、任意已加载版本对比、审批与撤销、分页审计及执行门禁展示。执行契约包含仓库、允许路径、结构化验收命令、时长、尝试次数和分单位预算；依赖按同仓库导入链接解析，只有规划需求 `done` 视为就绪。审批身份由 `MANAGER_APPROVAL_ACTOR` 配置，`MANAGER_APPROVAL_TOKEN` 未配置时拒绝审批；客户端不能伪造身份。默认仍为 manual，批准本身不触发执行、合并、验收或部署。迁移只回填升级时快照，不编造此前历史。操作、配置、API 和验证说明见 [需求内容修订与审批](../features/manager-content-approval.md)。

P22 通过迁移 013 增加 `execution_jobs` 与 `execution_runs`。同需求同内容修订唯一，owner 用审批凭证显式排队并把 `automation_policy` 置为 `owner-token`；执行器用 `MANAGER_EXECUTOR_TOKEN` 领取，领取响应一次性下发 run token 和只读需求上下文，数据库只保存 token 哈希。心跳、成功、失败同时校验 run token、状态和租约；过期 run 显式转 expired，未达契约上限的 job 回 retry，达到上限转 failed。排队后内容修订、批准状态或需求状态变化会在领取前把旧 job 隔离为 failed。P23 的独立 CLI 负责隔离编码、候选提交、独立验收、证据包与 PR；通知和自动合并不在该层，可靠性规则见 [自动执行任务租约](../features/manager-execution-jobs.md)。

P24 通过迁移 014 为需求增加 `pr_state/pr_checked_at` 与 `deployment_state/deployment_ref/deployment_url/deployment_checked_at`。执行成功回写必须携带全部成功的结构化验收、candidate SHA、PR 和证据摘要，并与实际 job/run/租约一致；同一事务把需求推进到待验收、写入 PR open、部署 not-started 和稳定 ID 的 outbox 通知。终态失败与取消同样事务写通知，中间 retry 不打扰。通知服务配置 HTTPS webhook 后每 30 秒按事件名过滤领取 outbox，2xx 才确认 done；未配置时明确 not-configured。详情页展示 run 心跳、错误、证据、PR 和部署状态，人工验收和部署事实互不冒充。操作说明见 [执行进度、待验收与通知](../features/manager-execution-progress.md)。

P25 的 Manager 侧只暴露 `merge-candidates` 与 `merge-authorization` 读取接口，使用独立 `MANAGER_MERGE_TOKEN`。授权要求 job 成功、内容修订仍为当前批准修订、需求为低风险待验收、PR open 且执行结果身份完整；真正 GitHub 事实核对、required checks、分支保护、风险路径和普通 merge API 调用在独立 `pnpm merge:conditional` CLI 中完成。编码执行器仍拿不到合并 token，见 [低风险需求条件自动合并](../features/conditional-merge.md)。

P26 通过迁移 015 增加资源、密钥引用与真实检查三张表。资源必须记录归属、月预算、备份定位和 HTTPS 处理手册；密钥只允许 `env:`/`file:`/`external:` 引用，前缀必须与来源字段一致，schema 拒绝任何 value 字段。检查结果按 passed/failed/blocked/waiting 独立计数，每个检查名取最新记录并递增资源修订，blocked 表示真实检查无法执行，waiting 表示外部资源或人工动作未就绪。后台资源面板展示汇总与明细，Gateway `/status` 只提供入口，不复制状态，见 [资源、密钥引用与运行面板](../features/resources.md)。

---
