import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from "@nestjs/common";
import { assertAdmin, type AdminRequest } from "./admin-auth";
import { EvaluationSuiteService } from "./evaluation-suite.service";
import { evaluationRunSchema } from "./schemas";

@Controller("evaluation-suite")
export class EvaluationSuiteController {
  constructor(@Inject(EvaluationSuiteService) private readonly evaluationSuite: EvaluationSuiteService) {}

  @Get("cases")
  cases(@Req() request: AdminRequest) {
    assertAdmin(request);
    return this.evaluationSuite.cases();
  }

  @Post("runs")
  async createRun(@Body() body: unknown, @Req() request: AdminRequest) {
    assertAdmin(request);
    const parsed = evaluationRunSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException("split 必填，label 为 1-80 字符");
    return this.evaluationSuite.run(parsed.data.split, parsed.data.label);
  }

  @Get("runs")
  runs(@Req() request: AdminRequest) {
    assertAdmin(request);
    return this.evaluationSuite.listRuns();
  }

  @Get("runs/:id")
  run(@Param("id") id: string, @Req() request: AdminRequest) {
    assertAdmin(request);
    return this.evaluationSuite.runDetail(id);
  }

  @HttpCode(200)
  @Post("runs/:baselineId/compare/:currentId")
  compare(@Param("baselineId") baselineId: string, @Param("currentId") currentId: string, @Req() request: AdminRequest) {
    assertAdmin(request);
    return this.evaluationSuite.compare(baselineId, currentId);
  }
}
