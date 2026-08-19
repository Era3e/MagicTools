import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { RequirementService } from "./requirement.service";

@Controller()
export class RequirementController {
  constructor(@Inject(RequirementService) private readonly service: RequirementService) {}

  @Post("inbox/poll")
  poll() {
    return this.service.pollInbox();
  }

  @Get("requirements")
  list(@Query("status") status?: string, @Query("source") source?: string, @Query("iterationId") iterationId?: string) {
    return this.service.list({ status, source, iterationId });
  }

  @Get("requirements/:id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post("requirements")
  create(@Body() body: { title: string; description?: string; priority?: string }) {
    return this.service.create(body);
  }

  @Patch("requirements/:id")
  patch(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.service.patch(id, body as never);
  }

  @Post("requirements/:id/refresh-pr")
  refreshPr(@Param("id") id: string) {
    return this.service.refreshPr(id);
  }

  @Post("sync/github")
  syncGithub(@Body() body: { repo: string }) {
    if (!body.repo?.trim()) {
      throw new BadRequestException("repo 必填");
    }
    return this.service.syncGithub(body.repo);
  }
}
