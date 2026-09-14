# Assistant Badcase 闭环

## 目标

把用户澄清、用户反馈和评测失败转成可审计 badcase，串起会话证据、管理员确认、回归样本、修复前 baseline、Manager 需求和修复后验证。

## 关键行为

- 低置信度用户澄清只写 `intent_logs.suggested_intent`，不写 `corrected_intent`；只有管理端纠错 API 写管理员确认结果。
- Gateway 会向业务服务透传 `x-gateway-role`；反馈列表/删除、意图纠错、评测套件和 badcase 管理接口要求 admin 角色。直连测试可用 `ASSISTANT_ADMIN_AUTH=disabled` 显式降级。
- 每次 chat 落 `assistant_traces`，关联 conversation、user/assistant message、intent log、阶段、路由与结果快照。
- 用户反馈保留 conversation/message/intent 关联，可转为 badcase。
- badcase 状态机从 `new → classified → regression_ready → fix_planned → closed`，可拒绝或标记重复。
- badcase 生成 `regression` evaluation case 后必须先跑修复前 baseline；baseline 目标样本 pass 时拒绝进入修复流程。
- Manager 需求使用 `source=assistant_badcase` 与 `source_ref=badcase:<id>` 幂等创建。
- 关闭前校验修复 PR、Manager 需求状态、baseline/current 数据集指纹、目标样本 pass 且无 regressed/error/timeout/missing。

## API

- `GET /api/assistant/badcases`
- `GET /api/assistant/badcases/:id`
- `POST /api/assistant/badcases/from-feedback/:feedbackId`
- `POST /api/assistant/badcases/from-evaluation/:runId/:caseKey`
- `POST /api/assistant/badcases/:id/confirm`
- `POST /api/assistant/badcases/:id/regression`
- `POST /api/assistant/badcases/:id/requirement`
- `POST /api/assistant/badcases/:id/close`

## 边界

- holdout 明细不能创建 badcase，避免保留集明文泄漏。
- 本批不自动开发、自动合并或自动部署；这些能力留给 P22-P25。
