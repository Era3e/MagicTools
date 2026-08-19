import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CollectService } from "./collect.service";
import { schedulerStatus } from "./scheduler";
import { SourceService } from "./source.service";

@Controller()
export class SourceController {
  constructor(
    @Inject(SourceService) private readonly service: SourceService,
    @Inject(CollectService) private readonly collectService: CollectService
  ) {}

  @Get("sources")
  list() {
    return this.service.list();
  }

  @Get("sources/:id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post("sources")
  create(@Body() body: { name: string; type?: string; url?: string; cron?: string; options?: Record<string, unknown> }) {
    return this.service.create(body);
  }

  @Patch("sources/:id")
  update(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.service.update(id, body as never);
  }

  @Post("sources/:id/test")
  test(@Param("id") id: string) {
    return this.service.test(id);
  }

  @Post("sources/:id/collect")
  collect(@Param("id") id: string) {
    return this.collectService.collect(id);
  }

  @Get("items")
  items(@Query("sourceId") sourceId?: string, @Query("pushed") pushed?: string) {
    return this.collectService.items({ sourceId, pushed });
  }

  @Post("items/push")
  push(@Body() body: { ids: string[] }) {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException("ids 不能为空");
    }
    return this.collectService.push(body.ids);
  }

  @Get("meta/scheduler-status")
  schedulerStatus() {
    return schedulerStatus();
  }
}
