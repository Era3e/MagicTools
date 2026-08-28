import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { EvaluationService } from "./evaluation.service";
import { correctIntentLog, listIntentLogs } from "./intent-log.repo";
import { IntentService } from "./intent.service";
import { intentCorrectionSchema } from "./schemas";

@Controller()
export class IntentLogController {
  constructor(
    @Inject(EvaluationService) private readonly evaluation: EvaluationService,
    @Inject(IntentService) private readonly intents: IntentService
  ) {}

  @Get("intent-logs")
  list(@Query("domain") domain?: string, @Query("intent") intent?: string) {
    return listIntentLogs({ domain, intent });
  }

  @Post("intent-logs/:id/correct")
  async correct(@Param("id") id: string, @Body() body: unknown) {
    const parsed = intentCorrectionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("correctedIntent 非法");
    const row = await correctIntentLog(id, parsed.data.correctedIntent);
    if (!row) throw new NotFoundException("日志不存在");
    // D-09: 纠错落库即清 few-shot 缓存，下一轮分类立即吸收新样本（在线学习闭环）
    this.intents.clearFewshotCache();
    return row;
  }

  /** D-09: 路由评估报告（混淆矩阵 + 各意图纠错率） */
  @Get("intent-logs/evaluation")
  report() {
    return this.evaluation.report();
  }

  /** D-09: 回放评估——当前路由器对已纠错样本重新分类的命中率 */
  @Get("intent-logs/evaluation/replay")
  replay() {
    return this.evaluation.replay();
  }

  /** D-09: 导出微调数据集（JSON 文本，OpenAI 兼容 JSONL 格式，前端组装文件下载） */
  @Get("intent-logs/export")
  exportDataset() {
    return this.evaluation.exportDataset();
  }

  /** D-09: 数据集预览（前 5 行解析为对象，供前端展示） */
  @HttpCode(200)
  @Post("intent-logs/export/preview")
  async preview() {
    const { jsonl, count } = await this.evaluation.exportDataset();
    const lines = jsonl.split("\n").filter(Boolean);
    return { count, preview: lines.slice(0, 5).map((l) => JSON.parse(l) as unknown) };
  }
}
