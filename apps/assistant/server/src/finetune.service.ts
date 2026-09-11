import { ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createFinetuneClient, type FinetuneClient, type FinetuneJob } from "@mt/model-client";
import { EvaluationService } from "./evaluation.service";
import { countCorrectedLogs } from "./intent-log.repo";
import { getLatestFinetuneJob, hasRunningFinetuneJob, insertFinetuneJob, updateFinetuneJob, type FinetuneJobRow } from "./finetune.repo";

export const FINETUNE_MIN_SAMPLES = 500;
export const FINETUNE_BASE_MODEL = "glm-4-flash";

function zhipuApiKey(): string {
  return process.env.ZHIPU_API_KEY ?? "";
}

@Injectable()
export class FinetuneService {
  private readonly client: FinetuneClient;

  constructor(@Inject(EvaluationService) private readonly evaluation: EvaluationService) {
    this.client = createFinetuneClient();
  }

  /** 就绪度 + 最近任务状态（远端查询失败时降级为 DB 快照） */
  async status(): Promise<{
    corrected: number;
    threshold: number;
    ready: boolean;
    launchEnabled: boolean;
    busy: boolean;
    latest: (Pick<FinetuneJobRow, "id" | "remoteJobId" | "status" | "fineTunedModel" | "sampleCount" | "error" | "createdAt" | "updatedAt"> & { degraded?: boolean }) | null;
  }> {
    const [corrected, latest, busy] = await Promise.all([countCorrectedLogs(), getLatestFinetuneJob(), hasRunningFinetuneJob()]);
    const launchEnabled = process.env.FT_LAUNCH_ENABLED === "1";
    let latestOut: Pick<FinetuneJobRow, "id" | "remoteJobId" | "status" | "fineTunedModel" | "sampleCount" | "error" | "createdAt" | "updatedAt"> & { degraded?: boolean } | null = latest
      ? {
          id: latest.id,
          remoteJobId: latest.remoteJobId,
          status: latest.status,
          fineTunedModel: latest.fineTunedModel,
          sampleCount: latest.sampleCount,
          error: latest.error,
          createdAt: latest.createdAt,
          updatedAt: latest.updatedAt,
        }
      : null;

    if (latestOut) {
      try {
        const remote: FinetuneJob = await this.client.getJob(zhipuApiKey(), latestOut.remoteJobId);
        const merged = await updateFinetuneJob(latestOut.id, {
          status: remote.status,
          fineTunedModel: remote.fineTunedModel ?? undefined,
        });
        if (merged) {
          latestOut = {
            id: merged.id,
            remoteJobId: merged.remoteJobId,
            status: merged.status,
            fineTunedModel: merged.fineTunedModel,
            sampleCount: merged.sampleCount,
            error: merged.error,
            createdAt: merged.createdAt,
            updatedAt: merged.updatedAt,
          };
        }
      } catch {
        latestOut = { ...latestOut, degraded: true };
      }
    }

    return {
      corrected,
      threshold: FINETUNE_MIN_SAMPLES,
      ready: corrected >= FINETUNE_MIN_SAMPLES,
      launchEnabled,
      busy,
      latest: latestOut,
    };
  }

  /** 发起微调：导出 JSONL → 上传 → 创建 LoRA 任务 → 落库 */
  async launch(): Promise<{ jobId: string; sampleCount: number; remoteJobId: string }> {
    if (process.env.FT_LAUNCH_ENABLED !== "1") {
      throw new ForbiddenException({ error: "launch_disabled", hint: "编排层就绪但未启用真跑；设置 FT_LAUNCH_ENABLED=1 并确认智谱开发者 Pro 权益后重试" });
    }
    if (await hasRunningFinetuneJob()) {
      throw new ConflictException({ error: "job_running", hint: "已有进行中的微调任务，等待完成后再发起" });
    }
    const corrected = await countCorrectedLogs();
    if (process.env.FT_STUB !== "1" && corrected < FINETUNE_MIN_SAMPLES) {
      throw new ConflictException({ error: "samples_below_threshold", corrected, threshold: FINETUNE_MIN_SAMPLES, hint: "继续在意图日志页纠错积累样本" });
    }
    const apiKey = zhipuApiKey();
    if (!apiKey && process.env.FT_STUB !== "1") {
      throw new ServiceUnavailableException({ error: "missing_api_key", hint: "未配置 ZHIPU_API_KEY" });
    }

    const { jsonl, count } = await this.evaluation.exportDataset();
    if (count === 0) throw new ConflictException({ error: "empty_dataset", hint: "无已纠错样本可训练" });

    const file = await this.client.uploadFile(apiKey, `intent-dataset-${Date.now()}.jsonl`, jsonl);
    const job = await this.client.createJob(apiKey, { model: FINETUNE_BASE_MODEL, trainingFileId: file.id });
    const row = await insertFinetuneJob({ remoteJobId: job.id, remoteFileId: file.id, baseModel: FINETUNE_BASE_MODEL, sampleCount: count });
    return { jobId: row.id, sampleCount: count, remoteJobId: job.id };
  }
}
