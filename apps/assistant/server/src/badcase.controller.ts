import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { assertAdmin, type AdminRequest } from "./admin-auth";
import { BadcaseService } from "./badcase.service";
import { badcaseCloseSchema, badcaseConfirmSchema } from "./schemas";
import type { BadcaseRow } from "./badcase.repo";

@Controller("badcases")
export class BadcaseController {
  constructor(@Inject(BadcaseService) private readonly service: BadcaseService) {}

  @Get()
  list(@Query("status") status: BadcaseRow["status"] | undefined, @Req() request: AdminRequest) {
    assertAdmin(request);
    return this.service.list(status);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string, @Req() request: AdminRequest) {
    assertAdmin(request);
    return this.service.get(id);
  }

  @HttpCode(200)
  @Post("from-feedback/:feedbackId")
  fromFeedback(@Param("feedbackId", ParseUUIDPipe) feedbackId: string, @Req() request: AdminRequest) {
    assertAdmin(request);
    return this.service.fromFeedback(feedbackId);
  }

  @HttpCode(200)
  @Post("from-evaluation/:runId/:caseKey")
  fromEvaluation(@Param("runId") runId: string, @Param("caseKey") caseKey: string, @Req() request: AdminRequest) {
    assertAdmin(request);
    return this.service.fromEvaluationRun(runId, caseKey);
  }

  @HttpCode(200)
  @Post(":id/confirm")
  confirm(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: AdminRequest) {
    assertAdmin(request);
    const parsed = badcaseConfirmSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("badcase 分类参数非法");
    return this.service.confirm(id, parsed.data);
  }

  @HttpCode(200)
  @Post(":id/regression")
  regression(@Param("id", ParseUUIDPipe) id: string, @Req() request: AdminRequest) {
    assertAdmin(request);
    return this.service.createRegression(id);
  }

  @HttpCode(200)
  @Post(":id/requirement")
  requirement(@Param("id", ParseUUIDPipe) id: string, @Req() request: AdminRequest) {
    assertAdmin(request);
    return this.service.createRequirement(id);
  }

  @HttpCode(200)
  @Post(":id/close")
  close(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: AdminRequest) {
    assertAdmin(request);
    const parsed = badcaseCloseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("badcase 关闭参数非法");
    return this.service.close(id, parsed.data);
  }
}
