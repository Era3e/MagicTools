import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { EvaluationSuiteService } from "./evaluation-suite.service";
import { evaluationRunSchema } from "./schemas";

@Controller("evaluation-suite")
export class EvaluationSuiteController {
  constructor(@Inject(EvaluationSuiteService) private readonly evaluationSuite: EvaluationSuiteService) {}

  @Get("cases")
  cases() {
    return this.evaluationSuite.cases();
  }

  @Post("runs")
  async createRun(@Body() body: unknown) {
    const parsed = evaluationRunSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException("split 必填，label 为 1-80 字符");
    return this.evaluationSuite.run(parsed.data.split, parsed.data.label);
  }

  @Get("runs")
  runs() {
    return this.evaluationSuite.listRuns();
  }

  @Get("runs/:id")
  run(@Param("id") id: string) {
    return this.evaluationSuite.runDetail(id);
  }

  @HttpCode(200)
  @Post("runs/:baselineId/compare/:currentId")
  compare(@Param("baselineId") baselineId: string, @Param("currentId") currentId: string) {
    return this.evaluationSuite.compare(baselineId, currentId);
  }
}
