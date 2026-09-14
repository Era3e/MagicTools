# Manager 模块

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

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
```

2026-09-11 起，手工状态迁移由 `requirement-policy.ts` 约束；字段与状态在行锁事务中合并，新客户端提交 expectedRevision，过期返回 409。PR 同状态不增加修订，不能回退 accepting/done。详情的关联草稿与服务器基准分离，冲突后不会自动使用新版本覆盖旧内容。

候选导入支持 `magictools-requirement-candidates/0.1`：baseline 保存为 capabilities，planned 保存为 waiting/manual 需求；源码观察不等于已验收或已部署。接口、来源与大小上限见 [Manager 候选导入说明](features/manager-candidate-import.md)。关键数据库验证使用 `pnpm test:manager:integration`，并由本地与 CI 共用的 qa:gate 强制执行。

P08 通过迁移 006/007/008 增加 `contentRevision`、快照、审批事件和执行契约。内容字段或执行契约改变时递增内容版本，操作信息变更只影响并发版本；批准绑定指定内容，变更后显示 outdated。详情页支持内容编辑、冲突草稿恢复、任意已加载版本对比、审批与撤销、分页审计及执行门禁展示。执行契约包含仓库、允许路径、结构化验收命令、时长、尝试次数和分单位预算；依赖按同仓库导入链接解析，只有规划需求 `done` 视为就绪。审批身份由 `MANAGER_APPROVAL_ACTOR` 配置，`MANAGER_APPROVAL_TOKEN` 未配置时拒绝审批；客户端不能伪造身份。当前仍为 manual，不触发执行、合并、验收或部署。迁移只回填升级时快照，不编造此前历史。操作、配置、API 和验证说明见 [需求内容修订与审批](features/manager-content-approval.md)。

---
