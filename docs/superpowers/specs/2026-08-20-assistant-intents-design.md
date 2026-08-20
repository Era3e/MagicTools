# Assistant 意图扩展设计（process_execution / trouble_shooting / complaint_feedback）

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-20
- 状态：🟡 待确认（E1~E3 设计假设待用户确认后改为 ✅）
- 上游：平台设计 5.7 节（「不做」项升级）；Assistant MVP（PR #15）

## 1. 定位

在 Assistant 三意图基础上扩展三类「行动型」意图，让助手从问答型升级为可执行平台动作、可协助排查、可收集反馈的助手。

## 2. 功能模块

### 2.1 process_execution（流程执行）
- LLM 从用户指令解析出平台动作（结构化输出 {action, params}）
- MVP 动作集：create_requirement（写 Manager 需求）、trigger_collect（触发 Gatherer 采集）
- 执行结果由 LLM 格式化回复；动作失败回执友好错误

### 2.2 trouble_shooting（故障排查）
- 实时探测各子服务 /health（经网关）收集状态 + 用户问题描述 → LLM 生成排查建议
- 输出：状态概览 + 排查步骤/建议

### 2.3 complaint_feedback（投诉反馈）
- 收集反馈内容 → assistant 库 feedback 表落库 → 礼貌确认回复
- 反馈列表 API + Web 页面查看

### 2.4 意图路由升级
- 分类从 3 类扩到 6 类；桩模式关键词判别扩展；多轮历史沿用

## 3. 数据模型（assistant 库新增）

| 表 | 关键字段 |
|---|---|
| feedback | id, content, contact, created_at |

## 4. API 设计（新增）

| 方法/路径 | 说明 |
|---|---|
| GET /feedback | 反馈列表 |
| DELETE /feedback/:id | 删除反馈 |
| （POST /chat 复用，response 增加 actionResult 字段） | |

## 5. 技术要点

1. **动作执行**：经网关调目标子项目 REST（BASE_URL 可配置 INTERNAL_GATEWAY_URL，缺省 http://127.0.0.1:3000）；CI 用 ACTION_STUB=1 桩模式返回固定成功回执
2. **健康探测**：并发生成探测各服务 /health（读 infra/ports.yaml 同款端口表），容错单点失败；探测结果 JSON 交给 LLM 生成建议（桩模式固定建议）
3. **意图判别**：桩关键词（「创建/建一个需求」→ process_execution；「报错/失败/排查/怎么了」→ trouble_shooting；「投诉/反馈/不满意」→ complaint_feedback）；真实模式提示词升级为 6 类
4. **CI**：e2e 增加三意图用例（ACTION_STUB=1）

## 6. 待确认设计假设（用户确认后本节改为 ✅）

- **E1（动作范围）**：MVP 动作 = 创建需求（写 Manager）+ 触发采集（调 Gatherer）（推荐）｜备选：只做创建需求一个动作
- **E2（排查数据源）**：实时探测各服务 /health（经网关）+ LLM 结合探测结果生成建议（推荐）｜备选：纯 LLM 按平台架构知识回答，不探测
- **E3（反馈展示）**：feedback 表落库 + 列表 API + Web 反馈页查看/删除（推荐）｜备选：仅落库无界面

## 7. 验收标准（DoD）

1. 三新意图各至少一个 e2e 用例（桩模式：ACTION_STUB）
2. process_execution 创建需求动作端到端打通（assistant → gateway → manager 落库）
3. trouble_shooting 返回服务状态概览 + 排查建议
4. complaint_feedback 落库可查
5. CI 全绿 + docs/迭代日志 + 合并 main
