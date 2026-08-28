/**
 * rawBody 中间件
 *
 * 在 NestJS 默认 JSON 解析之前先把原始请求体 buffer 存到 req.rawBody，
 * 供 webhook 签名校验使用（x-hub-signature-256 校验必须拿原始 body，
 * JSON 解析后的字符串因为空格/键顺序不同会导致签名失配）。
 *
 * 实现方式：hook request 的 data/end 事件，把 body 收集进 buffer。
 * 对非 webhook 路由无副作用。
 */

interface RawBodyReq {
  method: string;
  path: string;
  on(event: string, cb: (chunk: Buffer | string) => void): void;
  rawBody?: Buffer;
}

export function rawBodyMiddleware() {
  return (req: RawBodyReq, _res: unknown, next: () => void) => {
    if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") {
      next();
      return;
    }
    // 只对 /webhook 路径收集 raw body，避免全局 buffer 性能损耗
    if (!req.path.includes("webhook")) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      req.rawBody = Buffer.concat(chunks);
      next();
    });
    // 如果连接已关闭则直接放行（不会触发 end）
    req.on("close", () => {
      if (chunks.length === 0) next();
    });
  };
}
