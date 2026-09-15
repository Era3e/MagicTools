# P21 实施计划

基线：P20 合并后的 `a4aace1`。工作区：`work/mt-p21`，分支 `feat-model-client-P21-timeout-usage`。

| 任务 | 内容 | 验证 |
|---|---|---|
| T1 客户端控制 | signal、timeout、默认超时、上下文合并、流式提前取消 | model-client 单测 |
| T2 调用记录 | UsageLog、重试逐次记录、真实 usage/unknown 语义 | model-client 单测 |
| T3 持久化 | `recordModelCall`、7 服务迁移、wrapper 异步落库 | db 单测 + 7 迁移一致性 |
| T4 Assistant 上下文 | 意图分类、澄清确认、执行分支 trace/task 关联 | assistant 单测 + 数据库用例 |
| T5 数据库验收 | 真实表约束、unknown、非法来源、ID 幂等 | assistant test:integration，skip=0 |
| T6 文档沉淀 | feature/spec/plan、code-wiki、coverage、CHANGELOG、state、changeset、docs:facts | 生成物无漂移 |
| T7 完整闭环 | build、qa:gate、独立 0 bug review、PR CI、合并后 Release/main CI | 全部回执 |
