import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { SourceService } from "./source.service";

@Controller()
export class SourceController {
  constructor(@Inject(SourceService) private readonly service: SourceService) {}

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
}
