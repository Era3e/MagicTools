import { ForbiddenException } from "@nestjs/common";

export type AdminRequest = { headers: Record<string, string | string[] | undefined> };

export function assertAdmin(request: AdminRequest): void {
  if (process.env.ASSISTANT_ADMIN_AUTH === "disabled") return;
  if (request.headers["x-gateway-role"] === "admin") return;
  throw new ForbiddenException("需要管理员权限");
}
