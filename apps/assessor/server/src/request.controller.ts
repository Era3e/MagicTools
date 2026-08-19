import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { RequestService } from "./request.service";

@Controller()
export class RequestController {
  constructor(@Inject(RequestService) private readonly service: RequestService) {}

  @Post("inbox/poll")
  poll() {
    return this.service.pollInbox();
  }

  @Get("requests")
  list(@Query("status") status?: string) {
    return this.service.list(status);
  }

  @Get("requests/:id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch("requests/:id")
  updateContext(@Param("id") id: string, @Body() body: { contextText?: string; repoUrl?: string }) {
    return this.service.updateContext(id, body);
  }

  @Post("requests/:id/generate")
  generate(@Param("id") id: string) {
    return this.service.generate(id);
  }

  @Post("requests/:id/review")
  review(@Param("id") id: string, @Body() body: { approve: boolean; comment?: string }) {
    return this.service.review(id, body);
  }

  @Post("requests/:id/push")
  push(@Param("id") id: string) {
    return this.service.push(id);
  }

  @Get("meta/github-status")
  githubStatus() {
    return this.service.githubStatus();
  }
}
