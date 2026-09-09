# Assistant 双路数据查询与质量兜底设计

> 日期：2026-09-08
> 状态：已评审通过（用户拍板：全量规划分阶段落地 / 双路对比 / 直连先行 / 直连为主+差异标签）
> 关联：docs/superpowers/specs/2026-08-20-assistant-design.md、docs/integrations/cybercloud-setup.md
> 契约来源：D:\cybercloud\cloud-meta（后端源码逆向）+ D:\cybercloud\cybercloud-app（前端 API 层实证）

## 1. 背景与目标

Assistant 的 data_query 意图当前仅依赖 cybercloud 智能体（block 对话）。存在三个问题：

1. **故障域不可分**：回答异常时无法区分「意图路由错 / cybercloud 平台故障 / 智能体本身回答不准」；
2. **质量不可控**：智能体回答错误数据（工具配置问题或幻觉）在链路上与正确回答无任何区分；
3. **无质量数据底座**：没有按调用记录的成功率/延迟/差异趋势，无法系统性把控智能问答质量。

**目标**：

- G1 可观测：chat 响应带结构化数据源元数据；data-source-status 真实探活；每路调用落库可查。
- G2 质量兜底：智能体回答不准或故障时，直连 cybercloud 数据 API 取数回答；双路数值对比，不一致时以直连为准并明示差异。
- G3 可运维：CYBERCLOUD_MODE 一键切换 agent/direct/dual。

## 2. 总体架构

```
用户提问（data_query 意图）
  ↓ ChatService.executeBranch 改造
  ├──────────────┬───────────────────────────────┐
  │ 直连路径（新）  │        智能体路径（现有）          │
  │ DirectQuery- │  CybercloudService.query()     │
  │ Service      │  （block 对话，可能 30s+）         │
  ↓ 秒级返回      │                                │
  先返回直连结果    │        （后台继续跑）              │
  +verify 任务ID  └──────────────┬────────────────┘
  ↓                              ↓ 智能体返回
  前端轮询 verify ──→ CompareEngine 数值比对 ──→ 终态更新气泡标签
```

新增模块（assistant-server，单服务多文件模式，不入 @mt 公共包）：

| 模块 | 职责 |
|------|------|
| `direct-query.service.ts` | 直连取数流水线（指标匹配 → 报表结构 → 单值聚合查询） |
| `compare.service.ts` | 数值提取与比对纯函数（CompareEngine） |
| `verify-task.registry.ts` | verify 任务内存注册表（TTL 10 分钟） |
| `cybercloud-calls.repo.ts` | cybercloud_calls 表读写 |
| `direct-query.schema.ts`（并入 schemas.ts） | LLM 匹配输出 Zod 校验 |
| migrations/004_assistant_cybercloud_calls.sql | 调用监控表 |

现有模块改造：

| 模块 | 改造点 |
|------|--------|
| `cybercloud.service.ts` | query() 返回结构化元数据（sseType/latencyMs/agentId）；SSE ERROR 不再降维成纯文本；暴露 ensureJwt/ensurePayload 供直连复用认证；新增 probe() 探活 |
| `chat.service.ts` | executeBranch data_query 分支改双路编排；chat 响应加 dataSource 元数据 |
| `chat.controller.ts` | 新增 GET /chat/verify/:taskId |
| `meta.controller.ts` | data-source-status 升级（真实探活，60s 缓存） |
| `app.module.ts` | 注册新 providers |
| 前端 `api.ts` / `ChatPage.tsx` / `IntentLogPage.tsx` | verify 轮询、气泡标签、监控卡片 |

## 3. 直连取数流水线（阶段一核心）

### 3.1 五步流水线

```
用户消息 ─→ ①指标列表(缓存10min) ─→ ②LLM匹配+时间解析 ─→ ③取报表结构 ─→ ④构造单值查询 ─→ ⑤取值应答
                 │                                             │
              失败/空 ────────────→ notApplicable ←─── 结构缺指标列/缺日期过滤字段
```

### 3.2 步骤①：指标列表

`POST /api/setup/report/indicators/list`，body `{}`。返回 `MultiResponse<ReportIndicatorDto[]>`，关键字段：`id`（= MD5(indicatorName+indicatorDesc)）、`indicatorName/indicatorDesc/indicatorUnit/reportId/reportName/objectCode`。

**源码实证**：indicatorValue 字段是从报表结构 JSON 里直接读的预设值（ReportService.groovy:704-722），不是实时计算值。**直连路径禁止把 indicatorValue 当答案**，必须跑真实查询。这也是智能体回答不准的一个可能根源（把预设值当实时值表述）。

指标列表缓存 10 分钟（服务实例内存）。

### 3.3 步骤②：LLM 匹配与时间解析

走 `@mt/model-client`（parseJson 容错），输入用户消息 + 指标列表摘要（id/name/desc/unit/reportName），输出：

```json
{
  "metricId": "string | null",
  "confidence": 0.0,
  "timeFilter": {
    "mode": "semantic | explicit | none",
    "enumValue": "THIS_MONTH",
    "from": "2026-03-01",
    "to": "2026-03-15"
  },
  "reasoning": "string"
}
```

- 时间语义优先映射服务端枚举（TimeFilterEnum 22 个值，常用：THIS_MONTH/PRE_MONTH/PAST_7_DAYS/PAST_30_DAYS/THIS_YEAR/PRE_YEAR/CUSTOM_ONE_DAY 等），服务端自动解析起止时间；
- 显式日期区间（"3月1日到15日"）→ explicit 模式，from/to 传日期串；
- 无时间限定 → none。
- **metricId=null 或 confidence<0.6 → notApplicable（no_match / low_confidence）**，不硬造答案。

### 3.4 步骤③：取报表结构

`POST /api/setup/report/getReportStructure`（body `{reportId}`）→ structure JSON。定位：

- **指标列**：outline.columns[] 中 MD5(indicatorName+indicatorDesc)==metricId 的列（取其 id/code/summarize/alisaName）；
- **日期过滤字段**：userFilters[] ∪ filters[] 中 type 为日期类的项，作为时间过滤骨架（直接复用该字段原生 JSON 结构，只改 value/operator，避免自造格式）。

### 3.5 步骤④：构造单值聚合查询

镜像 dashboard/value 语义（构建报表结构 → 去除所有分组 → 单一聚合值）：

`POST /api/app/corm/report/queryByStructure`，body = 修改后的完整 structure：

- `outline.groups.rows = []`、`outline.groups.columns = []`（去分组 → 单行聚合）；
- 指标列保留（summarize/单位随列定义）；
- 时间过滤：在**原 userFilters 全量基础上**改日期字段值——
  - 语义枚举：`"{"actualTime":true,"timeFilter":"THIS_MONTH"}"`；
  - 显式区间：`"{"actualTime":false,"value":"2026-03-01,2026-03-15"}"`；
  - operator 固定 `between`。
  - **userFilters 整体替换语义**（CormReportService.groovy:250-252）：queryById 的 userFilters 参数会覆盖报表自带过滤，因此必须在原全量基础上修改，不得只传新增项。

**源码实证**：DateTimeControlUtil.format（corm-util）解析上述 value JSON；ReportFilter 结构（id/code/table/type/operator/value/timeFilter）见 ReportStructure.groovy:396-415。

**运行期待验证项**（阶段一 testcybercloud-dev 实测落定，不阻塞开发）：queryByStructure 对无分组结构的响应 JSON 字段名（预期 data 为行对象数组，key=列 alisaName）；若报错，降级链 queryById（报表无行分组时列表模式）→ dashboard/value（需 item 结构，最后手段）。

### 3.6 步骤⑤：取值应答

从响应行对象取指标列值 + indicatorUnit，组装模板：

> 「本月销售额」本月为 12345 元（直连实时查询）

### 3.7 notApplicable 全枚举

| 原因码 | 场景 |
|--------|------|
| no_match / low_confidence | 指标列表匹配失败或置信度 < 0.6 |
| no_date_field | 问题有时间限定但报表结构无日期过滤字段 |
| structure_invalid | 缺指标列 / 结构解析失败 |
| query_failed / timeout | 查询报错 / 超过直连超时（默认 8s） |
| unconfigured | CYBERCLOUD_BASE_URL/API_KEY 未配置 |

所有 notApplicable 落 cybercloud_calls（route=direct, ok=false, error=原因码）。直连不可用率本身是质量指标。

### 3.8 认证复用

直连与智能体路径复用 CybercloudService 的 jwt（缓存 100 分钟，401 自动重登）与 payload（缓存 30 分钟），同一 apiKey 用户 → 同源同权（queryById Controller 强制 checkPermission=true，数据权限口径一致）。

## 4. 双路编排与核验任务

### 4.1 ChatService 编排（executeBranch data_query 分支）

```ts
// CYBERCLOUD_MODE=dual（默认）
const directPromise = directQuery.run(message);        // 带 8s 超时
const agentPromise = cybercloud.query(message);        // 带 60s 超时
const direct = await directPromise;
if (direct.applicable) {
  const task = verifyRegistry.create({ direct, agentPromise });
  return { reply: direct.reply, verify: { taskId, status: "pending" } };  // 立即返回
}
const agent = await agentPromise;                      // 阻塞兜底
return { reply: agent.reply, verify: { status: "not_applicable" } };
// CYBERCLOUD_MODE=agent → 仅智能体（现状）；=direct → 仅直连（notApplicable 时回退智能体，见 §8）
```

### 4.2 verify 任务生命周期

- 状态机：`pending → consistent | divergent | unverifiable | agent_failed | agent_timeout`；另有 not_applicable（未建任务）。
- TTL 10 分钟，内存注册表（同 pendingClarify 模式）；重启丢失可接受，前端轮询 404 即停止并标注「核验超时」。
- 智能体 promise 无论成败终态化任务并写 cybercloud_calls（route=agent）；**比对在服务端完成**。
- `GET /chat/verify/:taskId` 响应：

```json
{
  "status": "divergent",
  "verdict": { "directValue": 12345, "agentNumbers": [99999], "diffPct": 710 },
  "agentReply": "智能体原文（divergent/unverifiable 时附）",
  "dataSource": { "mode": "dual", "agent": { "latencyMs": 32000, "sseType": "MARKDOWN" } }
}
```

verdict 与 dataSource 字段结构同 §4.3 chat 响应。

### 4.3 chat 响应新增字段

```json
{
  "sessionId": "...",
  "reply": "「本月销售额」本月为 12345 元（直连实时查询）",
  "intent": "data_query",
  "verify": { "taskId": "uuid", "status": "pending" },
  "dataSource": {
    "mode": "dual",
    "direct": { "applicable": true, "metricName": "本月销售额", "value": 12345, "unit": "元", "latencyMs": 1800, "endpoint": "queryByStructure", "timeFilter": "THIS_MONTH" },
    "agent": { "agentId": "...", "sseType": "MARKDOWN", "latencyMs": 32000, "error": null }
  }
}
```

## 5. 比对算法（CompareEngine 纯函数）

### 5.1 数值提取

```
extractNumbers(text):
  正则：/-?\d[\d,]*(?:\.\d+)?\s*(万|亿|k|K|%|元|人|次|单|个)?/g
  归一：去千分位逗号；万→×1e4；亿→×1e8；%→×0.01
```

### 5.2 比对

```
compare(directValue, agentNumbers[], tolerance=0.01):
  任一 |a−d| / max(|d|, 1) ≤ tolerance → consistent
  agentNumbers 为空                       → unverifiable（诚实态：智能体未给出可比数值）
  否则                                    → divergent（记录全部数值与差值）
```

- 容差默认 1%，`CYBERCLOUD_COMPARE_TOLERANCE` 可调。
- 与直连单位对齐后再比较（智能体「1.2万」vs 直连 12000 视为一致）。

## 6. 可观测性三件套

### 6.1 chat 响应结构化元数据

见 §4.3。前端 ChatPage 气泡底部渲染数据源标签。

### 6.2 data-source-status 升级

`GET /meta/data-source-status` 升级为真实探活（60s 缓存）：登录 → 换 payload → 列智能体，返回：

```json
{
  "configured": true, "stub": false, "baseUrl": "...", "agentId": "...",
  "probe": { "at": "ISO 时间", "gatewayOk": true, "authOk": true, "agentsReachable": true, "agentCount": 3, "latencyMs": 850, "errorDomain": null }
}
```

errorDomain 枚举：gateway（登录/网络）| auth（apiKey 换 payload）| agent（列智能体）| null。

### 6.3 cybercloud_calls 调用监控表

migrations/004（对齐既有风格：uuid 主键 gen_random_uuid()、timestamptz、jsonb）：

```sql
CREATE TABLE IF NOT EXISTS cybercloud_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,                -- agent | direct
  endpoint text NOT NULL DEFAULT '',  -- block | indicators/list | getReportStructure | queryByStructure | ...
  ok boolean NOT NULL,
  latency_ms integer NOT NULL DEFAULT 0,
  error text,                         -- 原因码或异常消息
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,  -- verifyStatus/metricName/value/差异明细等
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cybercloud_calls_created ON cybercloud_calls (created_at DESC);
```

写库策略：每路调用结束即写（agent 路含 sseType；direct 路含 reasonCode/value）；verify 终态化时 UPDATE 对应 agent 记录的 detail.verify_status。读取：IntentLogPage 新增「数据查询监控」卡片（近 200 条 + 双路成功率/平均延迟），复用既有 API 模式新增 GET /meta/cybercloud-calls（limit 200）。

## 7. 前端设计

### 7.1 ChatPage 双路标签

- 气泡正文 = 直连结果（applicable 时）；
- 底部小标签（MtStatusTag，tone 语义色，遵守 ui-spec）：
  - pending：「直连数据 · 核验中」
  - consistent：「✅ 已核验 · 智能体一致」
  - divergent：「⚠️ 智能体回答不一致 · 已采用直连（差 710%）」，可展开看智能体原文
  - unverifiable：「智能体未给出可比数值 · 已采用直连」
  - agent_failed / agent_timeout：「智能体超时/故障 · 已采用直连」
  - not_applicable：「来自智能体 · 直连不适用」
- 轮询 GET /chat/verify/:taskId，2s 间隔，终态或 404 停止（404 → 「核验超时」标签）。

### 7.2 IntentLogPage 监控卡片

新增「数据查询监控」卡片：近 200 条 cybercloud_calls 列表（route/endpoint/ok/latency/error/时间）+ 双路成功率与平均延迟统计行（MtKpiRow）。

## 8. 配置与降级矩阵

env 新增（.env.template 同步）：

```
CYBERCLOUD_MODE=dual                  # agent | direct | dual（默认 dual）
CYBERCLOUD_DIRECT_TIMEOUT_MS=8000     # 直连整条流水线超时
CYBERCLOUD_VERIFY_TIMEOUT_MS=60000    # 智能体核验超时
CYBERCLOUD_COMPARE_TOLERANCE=0.01     # 比对容差
# 桩：CYBERCLOUD_STUB=1；CYBERCLOUD_STUB_AGENT_ANSWER（缺省 "本月销售额 12345 元" → consistent）
```

| 场景 | 行为 |
|------|------|
| dual（默认，全配置） | 双路对比，直连先行 |
| mode=agent | 仅智能体（现状行为，dataSource.mode=agent，无 verify 任务） |
| mode=direct | 仅直连（智能体不跑，无对比；直连 notApplicable 时回退仅智能体） |
| 直连 notApplicable | 仅智能体（阻塞），标「直连不适用」 |
| 智能体故障/超时 | 直连结果直接终态（agent_failed / agent_timeout） |
| 直连故障 | 仅智能体，calls 记 error |
| 双路全故障 | 现有 DATA_QUERY_DEGRADE（补 errorDomain） |
| CYBERCLOUD_STUB=1 | 双路桩：①固定指标 stub-metric；②LLM 桩固定匹配；④⑤固定 12345；智能体回复由 CYBERCLOUD_STUB_AGENT_ANSWER 控制（默认同值→consistent；改值→divergent；`\_\_FAIL\_\_`→agent_failed） |

## 9. 阶段划分

| 阶段 | 范围 | 状态 |
|------|------|------|
| 一 | 可观测三件套 + 直连指标查询（§3 全流水线）+ 双路对比 + 前端标签/轮询 + 监控卡片 + 全套测试 | 本期实施 |
| 二 | 报表明细直连（report/list → LLM 选报表 → detailRows/queryById 参数化） | 后续 |
| 三 | 仪表盘直连（dashboard/value 单值、getItem 图表 JSON） | 后续 |

## 10. 测试策略（TDD）

先写失败测试再实现（AGENTS.md 硬性约定 1）：

1. **CompareEngine 纯函数单测**：数值提取（千分位/万/亿/%/单位后缀）、单位归一、容差边界（0.9%/1%/1.1%）、unverifiable。
2. **DirectQueryService 单测**：指标列表缓存、LLM 匹配失败/低置信度→notApplicable、无日期字段→notApplicable、时间过滤构造（语义枚举/显式区间 JSON 断言）、超时降级。桩：MT_LLM_STUB + CYBERCLOUD_STUB=1。
3. **verify 任务生命周期单测**：五终态 + TTL 过期 + 404。
4. **cybercloud.service 单测**：query() 元数据（sseType/latencyMs）、SSE ERROR 不降维、probe() 探活 60s 缓存。
5. **chat e2e（stub）**：consistent / divergent / agent_failed 三场景（CYBERCLOUD_STUB_AGENT_ANSWER 控制）+ verify 轮询终态 + chat 响应 dataSource 字段。
6. **前端单测**：气泡标签五终态渲染、轮询停止条件；IntentLogPage 监控卡片渲染。
7. **E2E 前端**：ChatPage 标签终态流转（复用 e2e 现有 stub 环境约定）。
8. **真环境验收**：testcybercloud-dev 实测（§3.5 运行期验证项 + 验收清单）。

## 11. 风险与开放问题

| 风险 | 缓解 |
|------|------|
| queryByStructure 响应字段名运行期未知 | §3.5 降级链 + 阶段一真环境实测落定 |
| 报表结构无日期过滤字段时语义时间无法注入 | notApplicable(no_date_field)，如实标注 |
| LLM 指标匹配错（选错指标） | confidence 阈值 + 指标名带 unit/reportName 上下文；错例经纠错反馈闭环沉淀 |
| 内存 verify 注册表重启丢失 | 前端 404 → 「核验超时」标签；TTL 10 分钟；不做持久化（YAGNI） |
| 智能体 60s 核验超时占满事件循环担忧 | promise 并发 + 超时截断，Nest 默认无阻塞 |
| cybercloud 侧报表结构变更破坏直连 | 结构解析失败 → notApplicable(structure_invalid) 优雅降级，不白屏不硬造 |

## 12. 异常检测与优化闭环

### 12.1 发现：三道检测线

1. **实时逐题检测**：CompareEngine 每问一题给出终态判定（consistent/divergent/unverifiable/agent_failed/agent_timeout），用户可见；
2. **数据底座**：cybercloud_calls 记录双路每次调用（verify_status/diffPct/agentReply 原文/timeFilter），可统计分歧率、直连不可用率、双路延迟趋势——区分「偶发 vs 系统性」；
3. **平台探活**：data-source-status 的 errorDomain（gateway/auth/agent）先排除平台故障，避免把故障误判为质量差。

### 12.2 优化：按根因分流

| 异常 | 根因归属 | 优化动作 |
|------|---------|---------|
| agent_failed / timeout、探活红 | cybercloud 平台/凭据/智能体未发布 | 运维修 cybercloud 侧；期间 CYBERCLOUD_MODE=direct 保命 |
| divergent 系统性出现在某指标 | 智能体侧配置（工具挂错/prompt 引导错/用预设值当实时值） | 用 cybercloud_calls 分歧记录（智能体原文 vs 直连值）为证据，去 cybercloud 控制台修该智能体 |
| divergent 但复查直连错 | 直连侧（时间过滤语义/结构解析） | detail 记录 timeFilter/endpoint 可精确复现；修复前可 mode=agent 临时切回 |
| 直连 no_match / low_confidence 率高 | 指标目录覆盖不足 / LLM 匹配弱 | cybercloud 侧补配指标；low_confidence 样本沉淀 few-shot（复用 D-09 纠错闭环模式）；覆盖不到的类型推进阶段二 |
| unverifiable 多 | 智能体回答不带数字 | 改智能体 prompt 要求给出具体数值（cybercloud 侧） |
| no_date_field | 报表结构缺日期过滤 | cybercloud 报表配置侧补字段 |

**职责边界**：MagicTools 侧负责「绝不静默给错数 + 提供可定位的证据」；数据质量根因大多在 cybercloud 侧配置，修复动作也在那边，监控数据为修复指路。

## 13. 验收标准（阶段一）

1. chat e2e 三终态场景全绿（stub）；
2. testcybercloud-dev 真环境：指标列表命中 ≥1 真实指标、直连查询返回真值、双路对比端到端 <10s 直连先行、divergent 场景差异标签正确；
3. qa:gate 全绿（lint 0 err / build / test / coverage / infra / docs）；
4. IntentLogPage 监控卡片可见双路记录；
5. data-source-status 探活返回 gatewayOk/authOk/agentsReachable。
