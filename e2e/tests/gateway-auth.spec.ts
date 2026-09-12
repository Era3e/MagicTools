import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { scryptSync, randomBytes } from "node:crypto";
import { resolve } from "node:path";

const AUTH_PORT = 3999;
const BASE = "http://127.0.0.1:" + AUTH_PORT;
// playwright 的 cwd 是 e2e/ 包目录；网关需要仓库根（ports.yaml 在根目录）
const REPO_ROOT = resolve(process.cwd(), "..");

let gateway: ChildProcess | undefined;
let usersValue = "";

test.beforeAll(async () => {
  const salt = randomBytes(8).toString("hex");
  const hash = "scrypt$" + salt + "$" + scryptSync("e2e-pass-123", salt, 32).toString("hex");
  usersValue = "e2e-user:" + hash;
  gateway = spawn(process.execPath, [resolve(REPO_ROOT, "apps/gateway/dist/index.js")], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      GATEWAY_USERS: usersValue,
      GATEWAY_SESSION_SECRET: "e2e-session-secret",
      PORT_OVERRIDE: String(AUTH_PORT),
    },
    stdio: "ignore",
    detached: false,
  });
  // 等待认证网关就绪：登录页可访问即就绪
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(BASE + "/login");
      if (res.ok) return;
    } catch {
      /* 尚未就绪 */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("认证网关未在 15s 内就绪");
});

test.afterAll(async () => {
  gateway?.kill();
  if (gateway && !gateway.killed) {
    await new Promise((resolve) => {
      gateway!.once("exit", resolve);
      setTimeout(resolve, 2000);
    });
  }
});

test.describe.configure({ mode: "serial" });

test.describe("P06 网关用户登录", () => {
  test("未登录浏览器访问首页重定向到登录页", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("工具工房 · 登录")).toBeVisible();
    await context.close();
  });

  test("正确凭证登录后可访问首页并登出失效", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await page.goto("/login");
    await page.fill('input[name="username"]', "e2e-user");
    await page.fill('input[name="password"]', "e2e-pass-123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(BASE + "/");
    await expect(page.getByText("工具工房，八件套")).toBeVisible();
    // 登出
    await page.evaluate(() => fetch("/logout", { method: "POST" }).then((r) => r.status));
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await context.close();
  });

  test("错误口令显示统一错误不泄漏用户存在性", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await page.goto("/login");
    await page.fill('input[name="username"]', "e2e-user");
    await page.fill('input[name="password"]', "wrong-password");
    await page.click('button[type="submit"]');
    await expect(page.getByText("用户名或口令不正确")).toBeVisible();
    // 同样文案也适用于不存在用户
    await page.fill('input[name="username"]', "no-such-user");
    await page.fill('input[name="password"]', "whatever");
    await page.click('button[type="submit"]');
    await expect(page.getByText("用户名或口令不正确")).toBeVisible();
    await context.close();
  });

  test("API 请求无凭证返回 401 JSON", async ({ request }) => {
    const res = await request.get(BASE + "/api/health");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe(401);
  });
});
