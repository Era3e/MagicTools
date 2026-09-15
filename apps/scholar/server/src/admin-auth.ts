import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.SCHOLAR_ADMIN_AUTH === "disabled") return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    if (request.headers["x-gateway-role"] === "admin") return true;
    throw new ForbiddenException("需要管理员权限");
  }
}
