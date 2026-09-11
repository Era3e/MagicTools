import { Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { RequirementApprovalService } from "./requirement-approval.service";

@Controller()
export class RequirementApprovalController {
  constructor(@Inject(RequirementApprovalService) private readonly service: RequirementApprovalService) {}

  @Get("meta/approval-policy")
  policy() { return this.service.policy(); }

  @Post("requirements/:id/approve-revision")
  @HttpCode(200)
  approve(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown,
    @Headers("x-manager-approval-token") token?: string) { return this.service.approve(id, body, token); }

  @Post("requirements/:id/revoke-approval")
  @HttpCode(200)
  revoke(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown,
    @Headers("x-manager-approval-token") token?: string) { return this.service.revoke(id, body, token); }

  @Get("requirements/:id/approvals")
  history(@Param("id", ParseUUIDPipe) id: string, @Query() query: unknown) { return this.service.history(id, query); }
}
