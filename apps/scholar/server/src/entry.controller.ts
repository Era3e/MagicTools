import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "./admin-auth";
import { EntryService } from "./entry.service";
import { SearchService } from "./search.service";

@Controller()
@UseGuards(AdminGuard)
export class EntryController {
  constructor(
    @Inject(EntryService) private readonly service: EntryService,
    @Inject(SearchService) private readonly searchService: SearchService
  ) {}

  @Get("entries/search")
  search(
    @Query("q") q?: string,
    @Query("mode") mode?: string,
    @Query("limit") limit?: string,
    @Query("spaceKey") spaceKey?: string
  ) {
    return this.searchService.search({ q, mode, limit, spaceKey });
  }

  @Get("entries")
  list(
    @Query("source") source?: string,
    @Query("category") category?: string,
    @Query("tag") tag?: string,
    @Query("spaceKey") spaceKey?: string
  ) {
    return this.service.list({ source, category, tag, spaceKey });
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
