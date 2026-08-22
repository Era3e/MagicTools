import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { correctIntentLog, listIntentLogs } from "./intent-log.repo";
import { intentCorrectionSchema } from "./schemas";

@Controller()
export class IntentLogController {
  constructor() {}

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
    return row;
  }
}
