export function extractApiErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    // 经网关：扁平 {error, reason, line}；直连服务：{message: {error, reason, line} | string}
    const candidates = [body, (body as { message?: unknown }).message];
    for (const c of candidates) {
      if (typeof c === "string" && c) return c;
      if (c && typeof c === "object") {
        const m = c as { error?: string; reason?: string; line?: number };
        const parts = [m.reason ?? m.error].filter(Boolean);
        if (typeof m.line === "number") parts.push("（第 " + m.line + " 行）");
        if (parts.length > 0) return parts.join(" ");
      }
    }
  }
  return "请求失败 " + status;
}
