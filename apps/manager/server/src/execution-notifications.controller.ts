import { Controller, ForbiddenException, Get, Headers, Inject, Post, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ExecutionNotificationsService } from "./execution-notifications.service";

@Controller()
export class ExecutionNotificationsController {
  constructor(@Inject(ExecutionNotificationsService) private readonly service: ExecutionNotificationsService) {}

  @Get("execution-notifications")
  status() {
    return this.service.status();
  }

  @Post("execution-notifications/dispatch")
  async dispatch(@Headers("x-manager-approval-token") token?: string) {
    this.authorizeOwner(token);
    const result = await this.service.dispatchOnce();
    return { ...result, ...(result.configured ? {} : { reason: "notification webhook not configured" }) };
  }

  private authorizeOwner(token?: string) {
    const expected = process.env.MANAGER_APPROVAL_TOKEN ?? "";
    if (!/^[\x21-\x7e]{32,1024}$/.test(expected)) throw new ServiceUnavailableException("尚未配置有效审批凭证");
    if (!token || token.length > 1024) throw new ForbiddenException("通知调度凭证无效");
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!digest(token).equals(digest(expected))) throw new ForbiddenException("通知调度凭证无效");
  }
}
