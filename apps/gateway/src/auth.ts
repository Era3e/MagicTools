import type { NextFunction, Request, Response } from "express";
import { parseUsers, parseUserApps, verifyPassword, LoginThrottle } from "./users";
import { signSession, verifySession, SESSION_COOKIE } from "./session";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_FAILURE_DELAY_MS = 500;
const THROTTLE_MAX_FAILURES = 5;
const THROTTLE_LOCK_MS = 5 * 60 * 1000;

export interface AuthDeps {
  now?: () => number;
}

interface AuthContext {
  users: Map<string, { hash: string; role: "admin" | "user" }>;
  userApps: Map<string, string[]>;
  serviceTokens: Map<string, string>;
  sessionSecret?: string;
  gatewayToken?: string;
  throttle: LoginThrottle;
  now: () => number;
  loginPage: (error?: string) => string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char] ?? char;
  });
}

export function renderLoginPage(error?: string): string {
  const errorBlock = error ? `<p class="login-error">${escapeHtml(error)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MagicTools · 登录</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --background: #f4f6f8; --surface-1: #ffffff;
    --text-strong: #1c2530; --text-muted: #5f6c7c;
    --ink-600: #2c4a6e; --amber-600: #a06f2a;
    --hairline: rgba(20,33,48,0.08);
    --error-600: #b42318; --error-50: #fef3f2;
    --serif: "Noto Serif SC", Georgia, serif;
    --sans: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  body { font-family: var(--sans); background: var(--background); color: var(--text-strong); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .login-card { width: 100%; max-width: 380px; background: var(--surface-1); border: 1px solid var(--hairline); border-radius: 8px; padding: 40px 36px 36px; display: flex; flex-direction: column; gap: 20px; }
  .login-brand { display: flex; flex-direction: column; gap: 6px; text-align: center; }
  .login-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); font-family: ui-monospace, monospace; }
  .login-title { font-family: var(--serif); font-size: 24px; font-weight: 600; }
  form { display: flex; flex-direction: column; gap: 14px; }
  label { font-size: 13px; font-weight: 500; color: var(--text-muted); display: flex; flex-direction: column; gap: 6px; }
  input { height: 40px; padding: 0 12px; border: 1px solid var(--hairline); border-radius: 6px; font-size: 14px; font-family: var(--sans); background: var(--surface-1); color: var(--text-strong); }
  input:focus { outline: 2px solid var(--ink-600); outline-offset: 1px; border-color: var(--ink-600); }
  button { height: 42px; border: none; border-radius: 6px; background: var(--ink-600); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--sans); }
  button:hover { background: #233c5a; }
  .login-error { padding: 10px 12px; background: var(--error-50); border-radius: 6px; font-size: 13px; color: var(--error-600); text-align: center; }
  .login-footer { text-align: center; font-size: 12px; color: var(--text-muted); }
</style>
</head>
<body>
  <main class="login-card">
    <div class="login-brand">
      <div class="login-eyebrow">MAGICTOOLS GATEWAY</div>
      <h1 class="login-title">工具工房 · 登录</h1>
    </div>
    ${errorBlock}
    <form method="post" action="/login">
      <label>用户名<input name="username" autocomplete="username" required autofocus /></label>
      <label>口令<input name="password" type="password" autocomplete="current-password" required /></label>
      <button type="submit">登 录</button>
    </form>
    <p class="login-footer">MagicTools · 统一网关入口</p>
  </main>
</body>
</html>`;
}

function parseServiceTokens(raw: string | undefined): Map<string, string> {
  const tokens = new Map<string, string>();
  if (!raw) return tokens;
  for (const entry of raw.split(",")) {
    const sep = entry.indexOf(":");
    if (sep <= 0) continue;
    const service = entry.slice(0, sep).trim();
    const token = entry.slice(sep + 1).trim();
    if (service && token) tokens.set(token, service);
  }
  return tokens;
}

function appOfPath(path: string): string | null {
  const apiMatch = /^\/api\/([a-z-]+)(?:\/|$)/.exec(path);
  if (apiMatch) return apiMatch[1];
  const webMatch = /^\/([a-z-]+)(?:\/|$)/.exec(path);
  if (webMatch && webMatch[1]) return webMatch[1];
  return null;
}

function wantsHtml(req: Request): boolean {
  if (req.path.startsWith("/api/")) return false;
  const accept = req.headers.accept ?? "";
  return accept.includes("text/html");
}

function setGatewayIdentity(req: Request, identity: string): void {
  req.headers["x-gateway-user"] = identity;
}

export function createAuthMiddleware(env: NodeJS.ProcessEnv, deps: AuthDeps = {}) {
  const users = parseUsers(env.GATEWAY_USERS);
  const userApps = parseUserApps(env.GATEWAY_USER_APPS);
  const serviceTokens = parseServiceTokens(env.GATEWAY_SERVICE_TOKENS);
  const sessionSecret = env.GATEWAY_SESSION_SECRET;
  const gatewayToken = env.GATEWAY_TOKEN;
  const now = deps.now ?? (() => Date.now());
  const throttle = new LoginThrottle(THROTTLE_MAX_FAILURES, THROTTLE_LOCK_MS);

  if (users.size > 0 && !sessionSecret) {
    throw new Error("GATEWAY_USERS 已配置但缺少 GATEWAY_SESSION_SECRET，拒绝启动");
  }

  const ctx: AuthContext = {
    users, userApps, serviceTokens, sessionSecret, gatewayToken, throttle, now,
    loginPage: renderLoginPage,
  };

  return function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    // 剥离客户端伪造的身份头：下游的 x-gateway-user 只能由本中间件按认证结果回填，
    // 防止全放行/部分放行模式下伪造身份透传（http-proxy-middleware 转发修改后的 req.headers）。
    delete req.headers["x-gateway-user"];
    if (req.path === "/login" || req.path === "/logout") {
      if (req.method !== "POST" || !req.is("urlencoded")) {
        handleLoginLogout(ctx, req, res, next);
        return;
      }
      readUrlencodedBody(req)
        .then((body) => {
          (req as Request & { body: Record<string, string> }).body = body;
          handleLoginLogout(ctx, req, res, next);
        })
        .catch(() => {
          res.status(400).type("html").send(ctx.loginPage("请求格式不正确"));
        });
      return;
    }
    if (ctx.users.size === 0) {
      if (!ctx.gatewayToken) {
        next();
        return;
      }
      if (req.headers["x-access-token"] === ctx.gatewayToken) {
        setGatewayIdentity(req, "service");
        next();
        return;
      }
      respondUnauthorized(ctx, req, res);
      return;
    }
    const serviceToken = req.headers["x-access-token"];
    if (typeof serviceToken === "string" && serviceToken) {
      if (ctx.gatewayToken && serviceToken === ctx.gatewayToken) {
        setGatewayIdentity(req, "service");
        next();
        return;
      }
      const service = ctx.serviceTokens.get(serviceToken);
      if (service) {
        setGatewayIdentity(req, "service:" + service);
        next();
        return;
      }
    }
    const cookieHeader = req.headers.cookie;
    if (cookieHeader && ctx.sessionSecret) {
      const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(SESSION_COOKIE + "="));
      if (match) {
        const session = verifySession(match.slice(SESSION_COOKIE.length + 1), ctx.sessionSecret, ctx.now());
        if (session) {
          if (session.needsRefresh(ctx.now(), SESSION_TTL_MS)) {
            res.setHeader(
              "Set-Cookie",
              `${SESSION_COOKIE}=${signSession({ user: session.user, role: session.role }, ctx.sessionSecret, ctx.now(), SESSION_TTL_MS)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
            );
          }
          const app = appOfPath(req.path);
          if (app && session.role !== "admin") {
            const allowed = ctx.userApps.get(session.user);
            if (allowed && !allowed.includes(app)) {
              res.status(403).json({ code: 403, message: "无权访问该应用" });
              return;
            }
          }
          setGatewayIdentity(req, session.user);
          next();
          return;
        }
      }
    }
    respondUnauthorized(ctx, req, res);
  };
}

function respondUnauthorized(ctx: AuthContext, req: Request, res: Response): void {
  if (wantsHtml(req)) {
    res.redirect("/login");
    return;
  }
  res.status(401).json({ code: 401, message: "未授权" });
}

async function handleLoginLogout(ctx: AuthContext, req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.path === "/login" && req.method === "GET") {
    res.type("html").send(ctx.loginPage());
    return;
  }
  if (req.path === "/login" && req.method === "POST") {
    if (ctx.users.size === 0) {
      res.redirect("/");
      return;
    }
    const { username, password } = req.body as { username?: string; password?: string };
    const user = typeof username === "string" ? username : "";
    if (ctx.throttle.isLocked(user, ctx.now())) {
      await delay(LOGIN_FAILURE_DELAY_MS);
      res.type("html").send(ctx.loginPage("尝试次数过多，请稍后再试"));
      return;
    }
    const record = ctx.users.get(user);
    const ok = record ? await verifyPassword(typeof password === "string" ? password : "", record.hash) : false;
    if (!ok) {
      ctx.throttle.recordFailure(user, ctx.now());
      await delay(LOGIN_FAILURE_DELAY_MS);
      res.type("html").send(ctx.loginPage("用户名或口令不正确"));
      return;
    }
    ctx.throttle.recordSuccess(user);
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${signSession({ user, role: record!.role }, ctx.sessionSecret!, ctx.now(), SESSION_TTL_MS)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
    );
    res.redirect("/");
    return;
  }
  if (req.path === "/logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.redirect("/login");
    return;
  }
  next();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_LOGIN_BODY_BYTES = 16 * 1024;

function readUrlencodedBody(req: Request): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_LOGIN_BODY_BYTES) {
        req.destroy();
        reject(new Error("body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const body: Record<string, string> = {};
      const text = Buffer.concat(chunks).toString("utf8");
      if (text) {
        for (const pair of text.split("&")) {
          const eq = pair.indexOf("=");
          if (eq <= 0) continue;
          // decodeURIComponent 对非法百分号编码（如 %ZZ）抛 URIError；
          // 该异常在事件回调内不会走到外层 .catch，会击穿进程（未认证远程 DoS）。
          // 畸形对按无效键处理跳过，映射到 400 由外层 catch 统一响应。
          let key: string;
          let value: string;
          try {
            key = decodeURIComponent(pair.slice(0, eq).replace(/\+/g, " "));
            value = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
          } catch {
            reject(new Error("malformed urlencoded pair"));
            return;
          }
          if (!(key in body)) body[key] = value;
        }
      }
      resolve(body);
    });
    req.on("error", reject);
  });
}
