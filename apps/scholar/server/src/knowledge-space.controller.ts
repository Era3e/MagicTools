import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, Req } from "@nestjs/common";
import { KnowledgeSpaceService, type HttpRequest } from "./knowledge-space.service";

@Controller()
export class KnowledgeSpaceController {
  constructor(@Inject(KnowledgeSpaceService) private readonly service: KnowledgeSpaceService) {}

  @Get("spaces")
  list(@Req() req: HttpRequest) {
    return this.service.list(req);
  }

  @Post("spaces")
  create(@Req() req: HttpRequest, @Body() body: unknown) {
    return this.service.create(req, body);
  }

  @Put("spaces/:key/members")
  upsertMember(@Req() req: HttpRequest, @Param("key") key: string, @Body() body: unknown) {
    return this.service.upsertMember(req, key, body);
  }

  @Delete("spaces/:key/members/:userId")
  removeMember(@Req() req: HttpRequest, @Param("key") key: string, @Param("userId") userId: string) {
    return this.service.removeMember(req, key, userId);
  }

  @Get("spaces/:key/entries")
  spaceEntries(@Req() req: HttpRequest, @Param("key") key: string) {
    return this.service.spaceEntries(req, key);
  }

  @Post("spaces/:key/versions")
  createVersion(@Req() req: HttpRequest, @Param("key") key: string, @Body() body: unknown) {
    return this.service.createVersion(req, key, body);
  }

  @Get("versions/:id")
  version(@Req() req: HttpRequest, @Param("id") id: string) {
    return this.service.versionDetail(req, id);
  }

  @Post("versions/:id/publish")
  publish(@Req() req: HttpRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.service.publishVersion(req, id, body);
  }

  @Get("public/version/current")
  currentVersion() {
    return this.service.currentVersion();
  }

  @Get("public/entries/search")
  search(@Query("q") q?: string, @Query("mode") mode?: string, @Query("limit") limit?: string) {
    return this.service.publicSearch({ q, mode, limit });
  }

  @Post("public/search")
  @HttpCode(200)
  searchUnified(@Body() body: unknown) {
    return this.service.publicSearchUnified(body);
  }

  @Get("public/entries")
  entries() {
    return this.service.publicEntries();
  }

  @Get("public/entries/:id")
  entry(@Param("id") id: string) {
    return this.service.publicEntry(id);
  }

  @Post("entries/:id/requirement-links")
  linkRequirement(@Req() req: HttpRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.service.linkRequirement(req, id, body);
  }

  @Post("entries/:id/unpublish")
  unpublish(@Req() req: HttpRequest, @Param("id") id: string) {
    return this.service.unpublishEntry(req, id);
  }

  @Delete("entries/:id")
  delete(@Req() req: HttpRequest, @Param("id") id: string) {
    return this.service.deleteEntry(req, id);
  }
}
