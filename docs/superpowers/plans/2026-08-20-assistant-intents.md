# Assistant 意图扩展实施计划

- 文档类型：实施计划（plan）
- 创建日期：2026-08-20
- 上游：docs/superpowers/specs/2026-08-20-assistant-intents-design.md（✅ 已确认）
- 分支：feat/assistant-INTENTS

## 任务拆解（TDD：先失败测试后实现，每任务测试全绿才提交）

| 任务 | 内容 | 产物/验证 |
|---|---|---|
| T0 | 意图路由升级：Intent 类型扩 6 类、classifyIntent 桩关键词扩展（创建需求/采集→process_execution；报错/失败/排查→trouble_shooting；投诉/反馈/不满意→complaint_feedback）、intentSchema 枚举扩展；迁移 002 加 feedback 表 | intent 单测更新（6 类判别） |
| T1 | process_execution：action.service（LLM 结构化 {action, params}，桩模式固定动作）+ 经网关 REST 调 manager/gatherer（INTERNAL_GATEWAY_URL 缺省 127.0.0.1:3000；ACTION_STUB=1 桩回执）；chat.service 分支接入，response 增加 actionResult | action 单测（桩/真实 fetch mock）+ chat e2e 新意图 |
| T2 | trouble_shooting：health-probe（读 ports.yaml 端口表并发生成探测 /api/<svc>/health + 网关 /health，容错单点失败）+ LLM 生成建议（桩固定建议）；chat 分支接入 | probe 单测（全挂/部分挂）+ e2e |
| T3 | complaint_feedback：feedback.repo（落库/列表/删除）、GET /feedback、DELETE /feedback/:id；chat 分支接入（礼貌确认） | feedback e2e + chat e2e |
| T4 | Web：反馈页（列表/删除）+ 聊天页动作结果展示（actionResult 气泡）；api.ts 扩展 | web 测试全绿 |
| T5 | CI/基础设施：ci.yml smoke/e2e 加 ACTION_STUB=1、e2e/tests/assistant-intents.spec.ts（经网关三新意图全流程）、compose 无变化（复用 assistant 库） | 本地冒烟 + Playwright 通过 |
| T6 | 收尾：全量门禁、changeset、docs/memory + CHANGELOG、PR 合并 main、worktree/分支清理、目标完成 | CI 全绿 + 合并 |

## 关键实现约定

1. 意图提示词升级为 6 类枚举；桩判别关键词顺序：数据类 → 动作类（创建需求/采集）→ 排查类（报错/失败/排查/挂了）→ 反馈类（投诉/反馈/不满意）→ 问候 → 默认 product_inquiry
2. 动作执行经网关：POST http://<gateway>/api/manager/requirements（body {title, description}）；POST http://<gateway>/api/gatherer/sources/:id/collect —— sourceId 由动作参数携带，未提供时提示需先配置信息源
3. 健康探测读 infra/ports.yaml（findPortsFile 同款向上查找），并发 fetch 每服务 /api/<svc>/health（timeout 3s），结果 JSON 交 LLM
4. ACTION_STUB=1：动作不真实发 HTTP，直接返回 {ok: true, stub: true} 固定回执
5. feedback 表：id uuid、content text、contact text 默认 ''、created_at；列表倒序
