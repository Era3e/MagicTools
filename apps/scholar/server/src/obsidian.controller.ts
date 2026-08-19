import { Body, Controller, Get, Inject, Patch, Post } from "@nestjs/common";
import { ObsidianService } from "./obsidian.service";

@Controller()
export class ObsidianController {
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
  sync() {
    return this.service.sync();
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
