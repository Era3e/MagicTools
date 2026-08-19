import { Body, Controller, Get, Inject, Param, Patch, Post, Query, BadRequestException } from "@nestjs/common";
import { SurveyService } from "./survey.service";

@Controller()
export class SurveyController {
  constructor(@Inject(SurveyService) private readonly service: SurveyService) {}

  @Get("surveys")
  list() {
    return this.service.list();
  }

  @Get("surveys/:id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post("surveys")
  create(@Body() body: { name: string; description?: string; appToken?: string; tableId?: string; answerFields?: string[] }) {
    return this.service.create(body);
  }

  @Patch("surveys/:id")
  update(@Param("id") id: string, @Body() patch: Record<string, unknown>) {
    return this.service.update(id, patch as never);
  }

  @Get("meta/feishu-status")
  feishuStatus() {
    return this.service.feishuStatus();
  }

  @Post("surveys/:id/sync")
  sync(@Param("id") id: string) {
    return this.service.sync(id);
  }

  @Get("surveys/:id/responses")
  responses(@Param("id") id: string, @Query("sentiment") sentiment?: string, @Query("priority") priority?: string) {
    return this.service.responses(id, { sentiment, priority });
  }

  @Post("surveys/:id/summarize")
  summarize(@Param("id") id: string) {
    return this.service.summarize(id);
  }

  @Post("surveys/:id/push")
  push(@Param("id") id: string, @Body() body: { recordIds: string[] }) {
    if (!Array.isArray(body.recordIds) || body.recordIds.length === 0) {
      throw new BadRequestException("recordIds 不能为空");
    }
    return this.service.push(id, body.recordIds);
  }

  @Post("surveys/:id/send-link")
  sendLink(@Param("id") id: string) {
    return this.service.sendLink(id);
  }
}
