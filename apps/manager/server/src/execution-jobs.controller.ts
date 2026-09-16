import { Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ExecutionJobsService } from "./execution-jobs.service";

@Controller()
export class ExecutionJobsController {
  constructor(@Inject(ExecutionJobsService) private readonly service: ExecutionJobsService) {}

  @Post("requirements/:id/execution-jobs")
  queue(@Param("id", ParseUUIDPipe) id: string, @Headers("x-manager-approval-token") token?: string) {
    return this.service.queue(id, token);
  }

  @Get("requirements/:id/execution-jobs")
  listByRequirement(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.list({ requirementId: id });
  }

  @Get("execution-jobs")
  list(@Query() query: unknown) {
    return this.service.list(query);
  }

  @Get("execution-jobs/:id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post("execution-jobs/claim")
  @HttpCode(200)
  async claim(@Body() body: unknown, @Headers("x-manager-executor-token") token?: string) {
    const job = await this.service.claim(body, token);
    return job ?? { claimed: false };
  }

  @Post("execution-jobs/recover")
  @HttpCode(200)
  recover(@Headers("x-manager-executor-token") token?: string) {
    return this.service.recover(token);
  }

  @Post("execution-jobs/:id/heartbeat")
  @HttpCode(200)
  heartbeat(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Headers("x-manager-executor-token") executorToken?: string,
    @Headers("x-manager-run-token") runToken?: string,
  ) {
    return this.service.heartbeat(id, body, executorToken, runToken);
  }

  @Post("execution-jobs/:id/complete")
  @HttpCode(200)
  complete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Headers("x-manager-executor-token") executorToken?: string,
    @Headers("x-manager-run-token") runToken?: string,
  ) {
    return this.service.complete(id, body, executorToken, runToken);
  }

  @Post("execution-jobs/:id/fail")
  @HttpCode(200)
  fail(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Headers("x-manager-executor-token") executorToken?: string,
    @Headers("x-manager-run-token") runToken?: string,
  ) {
    return this.service.fail(id, body, executorToken, runToken);
  }

  @Post("execution-jobs/:id/cancel")
  @HttpCode(200)
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Headers("x-manager-approval-token") token?: string,
  ) {
    return this.service.cancel(id, body, token);
  }

  @Post("requirements/:id/deployment-status")
  @HttpCode(200)
  deploymentStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Headers("x-manager-approval-token") token?: string,
  ) {
    return this.service.updateDeployment(id, body, token);
  }
}
