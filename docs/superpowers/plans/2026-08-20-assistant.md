# Assistant（助手）实施计划（MVP）

- 文档类型：实施计划（plan）
- 创建日期：2026-08-20
- 上游：docs/superpowers/specs/2026-08-20-assistant-design.md（✅ 已确认）
- 分支：feat/assistant-MVP；端口：web 4007 / server 5007；独立库 assistant

## 任务拆解（TDD：先失败测试后实现，每任务测试全绿才提交）

| 任务 | 内容 | 产物/验证 |
|---|---|---|
| T0 | 数据层：assistant 库自举、迁移 001（conversations/messages，gen_random_uuid）、db.ts（assistant pool + scholarPool 跨库只读）、llm.ts（意图分类 + 桩关键词判别 + chat 封装）、schemas.ts；infra/postgres-init.sql 加 assistant 库 | llm.test.ts（桩意图判别确定性）；迁移实库验证 |
| T1 | 意图路由：intent.service（LLM 结构化输出 {intent}；桩：数据/查询/统计→data_query，你好/谢谢/再见→chitchat_reject，其余→product_inquiry；多轮随上下文） | intent 单测 + chat e2e 三意图各一 |
| T2 | chat 核心：product_inquiry 检索（scholarPool：assistant_scope=true 向量 top-k + FTS ILIKE 兜底）→ LLM 带引用回答（citations 标题/来源/相似度）；POST /chat 自动建会话 | chat.e2e：圈定过滤、引用、未命中诚实回答 |
| T3 | data_query：cybercloud 客户端（CYBERCLOUD_STUB 桩返回固定数据集）+ LLM 生成查询参数 → 格式化回答；未配置优雅降级；GET /meta/data-source-status | data-query e2e：桩模式 + 未配置降级 |
| T4 | 多轮对话：conversation.repo/message.repo、上下文组装（最近 10 轮）、GET /conversations、GET /conversations/:id/messages、DELETE /conversations/:id | 多轮 e2e：指代消解（「那第二个呢」） |
| T5 | Web 聊天页：会话侧栏（新建/切换/删除）+ 气泡对话 + 引用卡片（点击跳转 /scholar/entries）；api.ts + 页面测试 | web 测试全绿 |
| T6 | CI/基础设施：ci.yml smoke/e2e 接入 assistant（MT_LLM_STUB=1 + CYBERCLOUD_STUB=1 + SCHOLAR_DATABASE_URL）、compose.prod 配置、e2e/tests/assistant.spec.ts（经网关三意图全流程） | 本地冒烟 + Playwright 通过 |
| T7 | 收尾：qa:gate 全绿（含新脚本）、changeset、docs/memory + CHANGELOG、PR 合并 main、worktree/分支清理、Phase 3 目标完成 | CI 全绿 + 合并 |

## 关键实现约定

1. 意图分类提示词要求只输出 JSON：{intent: "product_inquiry"|"data_query"|"chitchat_reject"}；桩模式按系统提示词 marker 判别（{intent}）+ 关键词规则
2. 圈定检索 SQL：SELECT ... FROM entries WHERE assistant_scope = true AND embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT $2；FTS 兜底 ILIKE 标题/内容
3. 上下文窗口：最近 10 轮（user/assistant 交替），超出截断；首条消息前 30 字符作为会话标题
4. 桩模式检索向量：复用 scholar 的 bigram 哈希伪向量逻辑（@mt/model-client embed 桩），保证「苹果」检索命中「苹果公司」类条目
5. 跨库只读：SCHOLAR_DATABASE_URL 缺省 127.0.0.1:5432/scholar；quality job 无 scholar 库时 e2e 用 skip 兜底（沿用 scholar 收件箱模式）
6. data_query 降级：CYBERCLOUD_BASE_URL 未配置 → 返回「数据查询暂未配置」提示（HTTP 200，不报错）
