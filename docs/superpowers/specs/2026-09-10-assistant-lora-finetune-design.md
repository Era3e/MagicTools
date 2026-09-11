# D-09 LoRA 编排层设计（Assistant 意图路由微调就绪层）

> 来源：docs/memory/mvp-deferred.md D-09（意图路由自训练微调 LoRA 层，P3）——few-shot 在线学习层已上线（PR #43），真 LoRA 微调延期。
> 状态：已评审（2026-09-10，「编排层就绪」用户拍板——样本 10/500 未达触发条件，先落 API 客户端与任务编排，不消耗训练费用）。

## 1. 背景与决策依据

### 1.1 现状事实（2026-09-10 实测）

- intent_logs 纠错样本 10 条 / 触发条件 ≥500 条（缺口巨大）；
- 智谱微调产品事实：glm-4-flash 支持 LoRA 微调（SFT/DPO），训练数据 = JSON 文件（messages 格式，与现有 exportDataset 输出兼容）；LoRA 训练需开发者 Pro 权益；文生文 LoRA 后支持公有池推理（模型编码可直接用于 chat/completions）；
- 官方建议数百条高质量样本起训——10 条样本真跑无意义；
- 微调编排代码全仓零存量（model-client 仅 chat/embed 两端点）。

### 1.2 本期目标（编排层就绪）

样本达标 + 权益开通后，**免开发**即可完成一次完整微调闭环：

1. `@mt/model-client` 扩展智谱微调 API 客户端（文件上传/创建 LoRA 任务/查询任务/查询事件）；
2. assistant-server 落地编排服务：`GET /intent-logs/finetune/status`（就绪度 + 任务状态）、`POST /intent-logs/finetune`（发起微调）；
3. IntentLogPage 新增「微调编排」卡片：样本进度（10/500）、就绪门禁说明、发起按钮、任务状态轮询；
4. 微调完成后切换模型的承接机制文档化（ZHIPU_MODEL envModelKey 已有，零代码）。

### 1.3 非目标

本期不真跑训练（不消耗 Pro 权益费用、不产生真实任务）；不做自动定时微调；不做训练超参调优界面（用官方默认）。

## 2. 智谱微调 API 契约（对接依据）

依据智谱开放平台微调文档（docs.bigmodel.cn fine-tuning）：

| 端点（v4 下） | 用途 | 关键字段 |
|---|---|---|
| POST /files（purpose: fine-tune） | 上传训练 JSON 文件 | filename + file 多部分 |
| POST /fine-tuning/jobs | 创建任务 | model, training_file, suffix, (fineTuningType: "sft"\|"dpo") |
| GET /fine-tuning/jobs/:id | 查询任务 | status: created/running/succeeded/failed…, fine_tuned_model |
| GET /fine-tuning/jobs/:id/events | 训练事件日志 | after/limit 分页 |
| DELETE /fine-tuning/jobs/:id | 删除 | — |

> 实施时以官方 API 参考页为准核对字段名（fineTuningType vs fine_tuning_type 等大小写），客户端层做 zod 容错解析；所有调用失败均抛结构化错误（status + body 摘要），不静默。

## 3. @mt/model-client 扩展

### 3.1 新增 `src/finetune.ts`

```ts
export interface FinetuneJob { id: string; status: string; model?: string; fineTunedModel?: string; createdAt?: string; }
export interface FinetuneEvent { id: string; type?: string; message?: string; createdAt?: string; }

export interface FinetuneClient {
  uploadFile(apiKey: string, filename: string, content: string): Promise<{ id: string }>;
  createJob(apiKey: string, input: { model: string; trainingFileId: string; suffix?: string }): Promise<{ id: string }>;
  getJob(apiKey: string, jobId: string): Promise<FinetuneJob>;
  listEvents(apiKey: string, jobId: string, limit?: number): Promise<FinetuneEvent[]>;
}

export function createFinetuneClient(baseUrl?: string): FinetuneClient;
```

- fetch 直连（微调端点与 chat 同域 `https://open.bigmodel.cn/api/paas/v4`，复用 providers.ts 的 ZHIPU.baseUrl；注入 base url 便于测试）；
- **FT_STUB=1 桩模式**：uploadFile 返回 `file-stub-<ts>`、createJob 返回 `ftjob-stub-<ts>`、getJob 按 `FT_STUB_STATUS` env（缺省 running，可设 succeeded/failed）返回、listEvents 返回两条固定事件——与仓内 GITHUB_STUB/MT_LLM_STUB 桩惯例对齐；
- multipart 上传用原生 FormData + Blob（Node 18+ 原生支持，零新依赖）。

### 3.2 测试（packages/model-client/src/finetune.test.ts）

- stub 模式四端点行为；
- 真接口形态：用 vi.stubGlobal fetch 断言 URL/方法/Authorization 头/表单字段/响应解析与错误透传（非 2xx → 抛错含 status）。

## 4. assistant-server 编排

### 4.1 `src/finetune.service.ts`

```ts
const FINETUNE_MIN_SAMPLES = 500;   // 就绪门禁（mvp-deferred 触发条件）
const FINETUNE_BASE_MODEL = "glm-4-flash";  // LoRA 支持且对所有用户开放（官方文档）

@Injectable() export class FinetuneService {
  status(): 就绪度（correctedCount/500、有无进行中任务、最近任务终态、fineTunedModel）
  launch(): 校验门禁（<500 → 409 结构化拒绝）→ exportDataset 产出 JSONL → uploadFile → createJob → 落库任务记录 → 返回 job 概要
}
```

- 任务持久化：intent_logs 库新表（migration 005，既有迁移止于 004）：

```sql
CREATE TABLE IF NOT EXISTS finetune_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remote_job_id text NOT NULL,
  remote_file_id text NOT NULL,
  base_model text NOT NULL,
  sample_count int NOT NULL,
  status text NOT NULL DEFAULT 'created',
  fine_tuned_model text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- status() 联查：DB 最近任务 + 远端 getJob 刷新（远端不可达时降级返回 DB 快照 + degraded 标记，不 500）；
- 门禁拒绝（409）payload：`{ error: "samples_below_threshold", corrected, threshold: 500, hint: "继续在意图日志页纠错积累样本" }`；
- **真跑开关**：`FT_LAUNCH_ENABLED=0`（缺省 0）时 launch 一律返回 `{ error: "launch_disabled", hint }`（403）——编排层就绪但明确不产生费用，等用户显式开启；FT_STUB=1 时跳过门禁数（样本门禁仅在真跑时校验，桩模式允许小样本走通全链路测试）。

### 4.2 controller 挂载（intent-log.controller.ts）

- `GET /intent-logs/finetune/status` → status()；
- `POST /intent-logs/finetune` → launch()（body 可选 `{ suffix }`）。

### 4.3 测试（finetune.service.spec.ts）

- stub 全链路：launch → file/job id 形态、finetune_jobs 落库、status 联查刷新；
- 门禁：FT_LAUNCH_ENABLED=0 → 403；真跑模式 <500 → 409（样本计数 mock）；
- 远端不可达降级：getJob 抛错 → status 返回 DB 快照 + degraded=true。

## 5. 前端 IntentLogPage「微调编排」卡

- 位置：「路由评估」区之下、「数据查询监控」之上；AdminPageHead 徽章追加「微调未就绪/就绪」态；
- 内容：MtKpiRow（纠错样本 N/500 · 就绪门禁 · 最近任务状态 · 微调模型编码）；进度条（corrected/500，达线变色）；「发起微调」按钮（未就绪 disabled + tooltip 说明；就绪且 FT_LAUNCH_ENABLED=0 时点击提示「编排就绪，需设置 FT_LAUNCH_ENABLED=1 启用」）；
- 轮询：存在进行中任务时 5s 轮询 status，终态停止；
- api.ts：`finetuneStatus()` / `finetuneLaunch()`。

### 测试（IntentLogPage.finetune.test.tsx）

- 未就绪态渲染（进度条 + disabled 按钮）；就绪态按钮可点；launch 调用与结果提示；任务态轮询启停（fake timers）。

## 6. 模型切换承接（零代码，文档化）

微调成功 → 模型广场取 `fine_tuned_model` 编码 → 主仓根 .env 设 `ZHIPU_MODEL=<编码>`（envModelKey 机制既有）→ 重启 assistant-server。该流程写入 CODE_WIKI §6.7 与本 spec，不新开发 UI。

## 7. 测试与文档收尾

- e2e：不新增独立 spec（IntentLogPage 已有 e2e 覆盖路径，微调卡在 FT_STUB=1 下随页面渲染断言）；Playwright 断言卡片区可见（designer 同轮 spec 校准纪律）；
- coverage-matrix 补行（finetune.ts / finetune.service.ts / IntentLogPage 微调卡，全路径）；
- mvp-deferred D-09 LoRA 层 → ✅（编排层就绪；真跑条件与操作路径写入降级说明列）；
- changeset（@mt/model-client minor——新增导出；assistant 双包私有不参与发布）；CHANGELOG 条目；CODE_WIKI §6.7 补微调编排模块行；state.md + PR body 双勾选。

## 8. Backlog

| 项 | 说明 | 重启触发 |
|----|------|---------|
| 真跑首次 LoRA 训练 | 消耗 Pro 权益 | 纠错样本 ≥500 且用户开通权益 |
| 自动定时微调 | 样本增量阈值触发 | 首次真跑验证收益后 |
| DPO 偏好训练 | 偏好对齐数据格式导出 | SFT 收益评估后 |

## 9. 验收标准

1. model-client finetune 四端点 stub + fetch 形态测试全绿；
2. assistant-server finetune.service 全链路 stub 测试绿（launch/门禁/降级三态）；
3. IntentLogPage 微调卡渲染与交互测试绿；
4. qa:gate 全绿；smoke 17 服务 PASS；
5. 文档收尾完成（§7 清单）。
