import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { EntryService } from "./entry.service";

@Controller()
export class EntryController {
  constructor(@Inject(EntryService) private readonly service: EntryService) {}

  @Get("entries")
  list(@Query("source") source?: string, @Query("category") category?: string, @Query("tag") tag?: string) {
    return this.service.list({ source, category, tag });
  }

  @Get("entries/:id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post("entries")
  create(@Body() body: unknown) {
    return this.service.create(body);
  }

  @Patch("entries/:id")
  patch(@Param("id") id: string, @Body() body: unknown) {
    return this.service.patch(id, body);
  }

  @Post("entries/scope-category")
  scopeCategory(@Body() body: { category?: string; scope?: boolean }) {
    return this.service.scopeCategory(body.category ?? "", body.scope !== false);
  }
}
