import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ConflictInfo, ObsidianService } from "./obsidian.service";

@Controller()
export class ObsidianController {
  // 显式 @Inject：vitest 走 esbuild 转译不生成装饰器元数据，隐式构造注入在测试内解析失败
  constructor(@Inject(ObsidianService) private readonly service: ObsidianService) {}

  @Get("settings")
  getSettings() {
    return this.service.getSettings();
  }

  @Patch("settings")
  patchSettings(@Body() body: unknown) {
    return this.service.updateSettings(body);
  }

  @Post("sync/obsidian")
  async sync() {
    const result = await this.service.sync();
    return result;
  }

  /** D-06: 列出待解决的冲突 */
  @Get("sync/conflicts")
  listConflicts(): Promise<ConflictInfo[]> {
    return this.service.listConflicts();
  }

  /** D-06: 解决单个冲突 */
  @Post("sync/conflicts/:entryId/resolve")
  resolveConflict(
    @Param("entryId") entryId: string,
    @Body() body: { strategy: "keep-db" | "take-obsidian" | "merge"; mergedContent?: string }
  ) {
    return this.service.resolveConflict(entryId, body.strategy, body.mergedContent);
  }

  /** D-06: 批量解决冲突 */
  @Post("sync/conflicts/batch-resolve")
  batchResolve(
    @Body()
    body: {
      resolutions: Array<{
        entryId: string;
        strategy: "keep-db" | "take-obsidian" | "merge";
        mergedContent?: string;
      }>;
    }
  ) {
    return this.service.batchResolve(body.resolutions);
  }

  @Get("meta/embedding-status")
  embeddingStatus() {
    return {
      stub: process.env.MT_LLM_STUB === "1",
      provider: "zhipu",
      model: "embedding-2",
      apiKeyConfigured: Boolean(process.env.ZHIPU_API_KEY),
    };
  }
}
