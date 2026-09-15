# P19 实施计划

| 任务 | 内容 | 验证 |
|---|---|---|
| T1 数据层 | `004_entry_chunks.sql` 建表、存量修订分块回填、索引；`entry.repo.ts` 在每个不可变修订下生成分块向量 | Scholar 真实数据库迁移与条目/知识空间回归 |
| T2 Scholar API | 新增公共混合检索 schema、repo 查询、service 合成排序与 controller `POST /public/search` | `public-search.e2e.test.ts` 4 条关键回归 |
| T3 Assistant 边界 | 删除直连 repo与 `scholarPool`，新增 Gateway `ScholarClient` 与响应 zod 校验 | `scholar.client.test.ts`、全仓 grep 无直连配置 |
| T4 引用对齐 | `KnowledgeService` 输出编号化上下文，解析模型 citations，仅映射真实候选并扩展引用证据字段 | `knowledge.service.test.ts`、chat/multi-turn/evaluation DB 回归 |
| T5 运行配置 | 移除 Assistant 的 Scholar DB env 与恢复上游连接，CI/start-services 改为服务调用 | infra 测试、17 服务 smoke、完整 `qa:gate` |
| T6 文档事实 | spec/plan、覆盖矩阵、模块文档、通信/依赖/恢复文档、CHANGELOG/state/changeset | `docs:facts`、docs lint、独立 0 bug review |
