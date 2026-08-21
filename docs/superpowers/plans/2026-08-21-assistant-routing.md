# Assistant 多系统意图路由实施计划

- 文档类型：实施计划（plan）
- 创建日期：2026-08-21
- 上游：docs/superpowers/specs/2026-08-21-assistant-routing-design.md（✅）
- 分支：feat/assistant-ROUTING

## 任务与验收（TDD：先失败测试后实现）

| 任务 | 内容 | 验证 |
|---|---|---|
| T0 | intent_logs 可观测层：迁移 003（intent_logs 表）、intent-log.repo（insert/list/correct）、domain 判别 helper（classifyDomain 桩规则）、chat.service 每次分类后落库（domain/intent/confidence）、GET /api/assistant/intent-logs、POST /api/assistant/intent-logs/:id/correct | intent-log e2e：chat 后日志落库（字段正确）、列表、纠错回填 |
| T1 | 分层路由：IntentService.classify 返回 {domain, intent, confidence}（桩规则 confidence=1；真实模式提示词输出三字段，解析失败回退规则 confidence=0）；chat 响应携带 domain/confidence | intent 单测更新 + chat e2e 断言 domain/confidence |
| T2 | 澄清反问：confidence < 0.6（CLARIFY_THRESHOLD）时回复澄清文案 + clarifyOptions（候选意图），用户按序号确认后执行对应分支并回填最近日志 corrected_intent | 澄清 e2e（桩注入低置信度） |
| T3 | Web：意图日志页（列表/筛选/纠错）+ 聊天页澄清选项按钮 + 动作气泡带 domain 标签 | web 测试全绿 |
| T4 | CI/E2E 接入（复用 assistant 服务，无新环境变量除 CLARIFY_THRESHOLD 可选）、全量门禁、changeset、memory/CHANGELOG、PR 合并、清理 | CI 全绿 + 合并 |

## 关键实现约定

1. 桩 domain 判别（classifyDomain）与 intent 判别同文件（llm.ts），规则顺序：cybercloud 域词 → 问候 → magictools；confidence 桩模式恒 1
2. 真实模式 INTENT_PROMPT 输出 {domain: "cybercloud"|"magictools"|"chitchat", intent: 六类, confidence: 0~1}；intentSchema 相应扩展（confidence 默认 1）
3. 澄清流程：clarifyOptions = [{label, intent}] 取置信度前 2 候选（桩模式注入测试用低置信度通过 CLARIFY_STUB_CONFIDENCE 环境变量）；用户回复「1」或候选标签原文 → 执行对应 intent 分支；其余按新消息重新分类
4. intent_logs 索引：idx_intent_logs_created；列表按 created_at 倒序 LIMIT 200，支持 domain/intent 筛选
