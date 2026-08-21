# Assistant 多系统意图路由迭代设计

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-21
- 状态：✅ 已确认（用户 2026-08-21 批准按建议方案落地）
- 上游：Assistant MVP（PR #15）/ 意图扩展（PR #19）/ 路由修复（PR #21）；cybercloud 集成手册

## 1. 定位

Assistant 已对接 MagicTools 内部（知识问答/需求/采集/排查/反馈）与 cybercloud 域（数据查询/插件/对象/字段）两大系统，单层关键词+LLM 分类存在跨域语义冲突与不可观测问题。本迭代按四层演进：**可观测日志 → 分层路由 → 双轨置信度 → 澄清闭环**。

## 2. 功能模块

### 2.1 intent_logs 意图日志（可观测层，先行）
- 每次 chat 分类后落库：message、domain（magictools/cybercloud/chitchat）、intent、confidence、corrected_intent（纠错后）、created_at
- 列表 API + 单条纠错 API + Web 意图日志页（列表/筛选/纠错按钮）
- 用途：统计混淆矩阵，驱动规则与 few-shot 迭代

### 2.2 分层路由（系统归属 → 域内意图）
- 第一层 domain：cybercloud 域（插件/对象/字段/智能体/数据指标）/ MagicTools 内部 / 闲聊兜底
- 第二层 intent：域内六类意图
- 输出统一 schema：{domain, intent, confidence}

### 2.3 规则 + 模型双轨
- 桩规则（关键词）：确定性输出，confidence=1，作为回归测试基线
- 真实模式：LLM 提示词输出 {domain, intent, confidence(0~1)}；解析失败回退规则结果（confidence=0）
- 两轨结果均落 intent_logs，可对比

### 2.4 低置信度澄清反问
- confidence < 0.6 且 intent 非 chitchat 时，回复反问澄清（附 2~3 个候选意图按钮文案），用户下一轮确认后执行；澄清问答也落日志（corrected_intent 回填）

## 3. 数据模型（assistant 库新增）

| 表 | 关键字段 |
|---|---|
| intent_logs | id, message, domain, intent, confidence numeric(3,2), corrected_intent, created_at |

## 4. API 设计（新增，前缀 /api/assistant）

| 方法/路径 | 说明 |
|---|---|
| GET /intent-logs?domain=&intent= | 意图日志列表（筛选） |
| POST /intent-logs/:id/correct | 纠错 {correctedIntent} |
| （POST /chat 复用，response 增加 domain/confidence，澄清时增加 clarifyOptions） | |

## 5. 技术要点

1. 桩规则 domain 判别：cybercloud 域词（插件/对象/字段/智能体/cybercloud/数据/查询/指标/报表）→ cybercloud；问候 → chitchat；其余 MagicTools 域
2. 真实模式提示词升级为 {domain, intent, confidence}；解析失败回退桩规则（confidence=0）
3. 澄清阈值 CLARIFY_THRESHOLD=0.6（环境变量可调）；澄清轮 reply 附 clarifyOptions（候选意图数组），用户回复后按「选项序号/原文匹配」执行对应分支并把 corrected_intent 写入最近一条日志
4. 日志保留最近 1000 条（列表 LIMIT），不做分页（MVP）
5. CI：e2e 增加意图日志落库/纠错/澄清用例

## 6. 验收标准（DoD）

1. 每次 chat 产生 intent_logs 记录（含 domain/intent/confidence）
2. 纠错 API + Web 意图日志页可用（e2e）
3. 分层路由：cybercloud 域词 → domain=cybercloud + intent=data_query；MagicTools 动作 → domain=magictools + intent=process_execution（回归用例保留）
4. 低置信度触发澄清反问（桩模式可注入低置信度模拟）
5. CI 全绿 + docs/迭代日志 + 合并 main

## 7. 任务拆解

| 任务 | 内容 |
|---|---|
| T0 | 迁移 003 intent_logs + intent-log.repo + chat 落库（domain 判别 helper + confidence）+ GET /intent-logs + POST /intent-logs/:id/correct + e2e |
| T1 | 分层路由重构：IntentService 输出 {domain, intent, confidence}（规则双轨；真实模式提示词升级 + 回退） |
| T2 | 澄清反问：低置信度回复 clarifyOptions，用户确认后执行并回填 corrected_intent + e2e |
| T3 | Web 意图日志页（列表/筛选/纠错）+ 聊天页澄清选项按钮 + 测试 |
| T4 | CI/E2E 接入 + 全量门禁 + changeset + 文档 + PR 合并 + 清理 |
