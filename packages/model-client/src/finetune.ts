import { ZHIPU } from "./providers";

export interface FinetuneJob {
  id: string;
  status: string;
  model?: string;
  fineTunedModel?: string;
  createdAt?: string;
}

export interface FinetuneEvent {
  id: string;
  type?: string;
  message?: string;
  createdAt?: string;
}

export interface CreateFinetuneJobInput {
  model: string;
  trainingFileId: string;
  suffix?: string;
}

export interface FinetuneClient {
  uploadFile(apiKey: string, filename: string, content: string): Promise<{ id: string }>;
  createJob(apiKey: string, input: CreateFinetuneJobInput): Promise<{ id: string }>;
  getJob(apiKey: string, jobId: string): Promise<FinetuneJob>;
  listEvents(apiKey: string, jobId: string, limit?: number): Promise<FinetuneEvent[]>;
}

function stubClient(): FinetuneClient {
  return {
    async uploadFile(_apiKey: string, filename: string) {
      return { id: "file-stub-" + Date.now().toString(36) + "-" + filename };
    },
    async createJob(_apiKey: string, input: CreateFinetuneJobInput) {
      return { id: "ftjob-stub-" + Date.now().toString(36) + "-" + input.model };
    },
    async getJob(_apiKey: string, jobId: string) {
      const status = process.env.FT_STUB_STATUS ?? "running";
      return {
        id: jobId,
        status,
        model: "glm-4-flash",
        fineTunedModel: status === "succeeded" ? "ftglm-stub-" + jobId.slice(-6) : undefined,
        createdAt: new Date().toISOString(),
      };
    },
    async listEvents(_apiKey: string, jobId: string) {
      return [
        { id: jobId + "-ev1", type: "TRAIN_PROGRESS", message: "epoch 1/3 loss 0.42", createdAt: new Date().toISOString() },
        { id: jobId + "-ev2", type: "TRAIN_PROGRESS", message: "epoch 2/3 loss 0.18", createdAt: new Date().toISOString() },
      ];
    },
  };
}

async function ensureOk(res: Response, action: string): Promise<void> {
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    throw new Error(`微调 ${action}失败: ${res.status} ${text}`);
  }
}

export function createFinetuneClient(baseUrl?: string): FinetuneClient {
  if (process.env.FT_STUB === "1") return stubClient();
  const base = baseUrl ?? ZHIPU.baseUrl;

  return {
    async uploadFile(apiKey, filename, content) {
      const fd = new FormData();
      fd.append("purpose", "fine-tune");
      fd.append("file", new Blob([content], { type: "application/jsonl" }), filename);
      const res = await fetch(base + "/files", {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey },
        body: fd,
      });
      await ensureOk(res, "上传数据集");
      const data = (await res.json()) as { id?: string };
      if (!data.id) throw new Error("微调 上传数据集失败: 响应缺 id");
      return { id: data.id };
    },

    async createJob(apiKey, input) {
      const res = await fetch(base + "/fine-tuning/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        body: JSON.stringify({
          model: input.model,
          training_file: input.trainingFileId,
          suffix: input.suffix ?? "mtintent",
          fineTuningType: "sft",
        }),
      });
      await ensureOk(res, "创建任务");
      const data = (await res.json()) as { id?: string };
      if (!data.id) throw new Error("微调 创建任务失败: 响应缺 id");
      return { id: data.id };
    },

    async getJob(apiKey, jobId) {
      const res = await fetch(base + "/fine-tuning/jobs/" + encodeURIComponent(jobId), {
        method: "GET",
        headers: { Authorization: "Bearer " + apiKey },
      });
      await ensureOk(res, "查询任务");
      const data = (await res.json()) as Record<string, unknown>;
      return {
        id: String(data.id ?? jobId),
        status: String(data.status ?? "unknown"),
        model: data.model ? String(data.model) : undefined,
        fineTunedModel: data.fine_tuned_model ? String(data.fine_tuned_model) : undefined,
        createdAt: data.created_at ? String(data.created_at) : undefined,
      };
    },

    async listEvents(apiKey, jobId, limit = 20) {
      const res = await fetch(base + "/fine-tuning/jobs/" + encodeURIComponent(jobId) + "/events?limit=" + limit, {
        method: "GET",
        headers: { Authorization: "Bearer " + apiKey },
      });
      await ensureOk(res, "查询事件");
      const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
      return (data.data ?? []).map((e) => ({
        id: String(e.id ?? ""),
        type: e.type ? String(e.type) : undefined,
        message: e.message ? String(e.message) : undefined,
        createdAt: e.created_at ? String(e.created_at) : undefined,
      }));
    },
  };
}
