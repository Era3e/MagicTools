import { Body, Controller, Get, Header, Inject, Param, Post } from "@nestjs/common";
import { InterviewService } from "./interview.service";

@Controller()
export class InterviewController {
  constructor(@Inject(InterviewService) private readonly service: InterviewService) {}

  @Get("positions/:positionId/interviews")
  list(@Param("positionId") positionId: string) {
    return this.service.list(positionId);
  }

  @Post("positions/:positionId/interviews")
  create(@Param("positionId") positionId: string, @Body() body: { round: number; qaNotes: string; reflection: string }) {
    return this.service.create(positionId, body);
  }

  @Post("interviews/:id/analyze")
  analyze(@Param("id") id: string) {
    return this.service.analyze(id);
  }

  @Get("interviews/:id/export.md")
  @Header("Content-Type", "text/markdown; charset=utf-8")
  async exportMarkdown(@Param("id") id: string) {
    return this.service.exportMarkdown(id);
  }
}
