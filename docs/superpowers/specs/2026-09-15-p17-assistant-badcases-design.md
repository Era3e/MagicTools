# P17 Badcase 到需求再到回归闭环设计

> 设计状态：当前设计基线。

## 背景

P16 已建立独立评测集和同数据集版本比较，但用户澄清会直接写 `corrected_intent` 进入 few-shot；反馈表没有会话证据；评测失败、Manager 需求和修复 PR 之间没有可审计链路。

## 目标

1. 用户澄清与管理员确认分权：用户只产生建议意图，管理员确认才进入训练数据。
2. Gateway 透传用户角色；Assistant 管理接口必须要求 admin，直连测试降级必须显式配置。
3. chat、feedback、intent log 与 assistant trace 可互相定位。
4. 用户反馈、用户澄清和 dev/regression 评测失败可转为 badcase。
5. badcase 转 regression case 后先跑修复前 baseline，目标样本必须非 pass。
6. Manager 需求按 badcase 幂等创建，并携带证据与验收条件。
7. 关闭 badcase 时硬校验修复 PR、Manager 状态、baseline/current 指纹与目标样本结果。

## 数据模型

- `intent_logs`：新增 suggested intent/source、correction source、confirmed_at、trace 与消息关联。
- `assistant_traces`：记录 conversation、user/assistant message、intent log、阶段、状态、路由、结果和错误。
- `feedback`：补充 conversation/user message/intent log/trace 关联。
- `assistant_badcases`：记录来源、阶段、状态、证据快照、期望、评测 case/run、Manager 需求和修复 PR。
- `evaluation_cases`：补充 source_type/source_ref/manager_requirement_id。
- Manager `requirements.source` 新增 `assistant_badcase`，并以 `(source, source_ref)` 幂等。

## 状态机

`new → classified → regression_ready → fix_planned → closed`，旁路 `rejected/duplicate`。禁止未生成 regression case 和 baseline 就创建需求或关闭。

## 验收

- 用户澄清后 `corrected_intent IS NULL`，few-shot/微调导出不含该样本。
- 管理员纠错记录 correction_source=admin 与 confirmed_at。
- feedback 可追到 conversation/message/intent，chat 可追到 trace。
- badcase regression baseline 目标 item 非 pass。
- 同一 badcase 重复创建 Manager 需求只生成一条。
- 未满足 PR、Manager 状态、指纹、目标 pass 或无异常项时拒绝关闭。
