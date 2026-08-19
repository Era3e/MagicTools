import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ResumeService } from "./resume.service";

@Controller()
export class ResumeController {
  constructor(@Inject(ResumeService) private readonly service: ResumeService) {}

  @Get("resumes")
  list() {
    return this.service.list();
  }

  @Post("resumes")
  create(@Body() body: { name: string; contentText: string }) {
    return this.service.create(body);
  }

  @Post("resumes/:id/analyze")
  analyze(@Param("id") id: string) {
    return this.service.analyze(id);
  }

  @Post("resumes/:id/rewrite")
  rewrite(@Param("id") id: string, @Body() body: { sectionType: string; originalText: string; positionId?: string }) {
    return this.service.rewrite(id, body);
  }

  @Post("resumes/:id/match/:positionId")
  match(@Param("id") id: string, @Param("positionId") positionId: string) {
    return this.service.match(id, positionId);
  }

  @Get("meta/quota")
  quota() {
    return this.service.quota();
  }
}
