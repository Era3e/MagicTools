import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import type { AddressInfo } from "node:net";
import { createGateway, APP_ACCENT } from "./app";

describe("gateway app", () => {
  it("未配置 token 时放行 /health", async () => {
    const app = createGateway({}, {});
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("up");
  });

  it("配置 token 后无凭证返回 401", async () => {
    const app = createGateway({}, { GATEWAY_TOKEN: "secret" });
    const res = await request(app).get("/health");
    expect(res.status).toBe(401);
  });

  it("携带正确 token 放行", async () => {
    const app = createGateway({}, { GATEWAY_TOKEN: "secret" });
    const res = await request(app).get("/health").set("X-Access-Token", "secret");
    expect(res.status).toBe(200);
  });

  it("web 路由根路径重定向补尾斜杠", async () => {
    const app = createGateway({ applicant: { web: 4008, server: 5008 } }, {});
    const res = await request(app).get("/applicant");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/applicant/");
  });

  it("根路径返回首页导航且包含全部应用卡片", async () => {
    const app = createGateway(
      { applicant: { web: 4008, server: 5008 }, scholar: { web: 4006, server: 5006 } },
      {}
    );
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain('href="/applicant/"');
    expect(res.text).toContain('href="/scholar/"');
    expect(res.text).toContain("求职工坊");
    expect(res.text).toContain("学者书库");
  });

  it("将请求代理到目标服务", async () => {
    const dummy = express();
    dummy.get("/dummy/", (_req, res) => res.json({ ok: true }));
    const server = dummy.listen(0);
    const port = (server.address() as AddressInfo).port;
    try {
      const app = createGateway({ dummy: { web: port } }, {});
      const res = await request(app).get("/dummy/");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    } finally {
      server.close();
    }
  });

  it("/api/health 返回聚合健康 JSON", async () => {
    const app = createGateway({ applicant: { web: 4008, server: 5008 } }, {});
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("services");
    expect(Array.isArray(res.body.services)).toBe(true);
  });

  it("/status 返回监控仪表盘 HTML", async () => {
    const app = createGateway({}, {});
    const res = await request(app).get("/status");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("系统监控");
    expect(res.text).toContain("chart.js");
  });

  it("drift guard：内联 accent 色板与 @mt/ui APP_ACCENT_TOKENS 逐应用一致", async () => {
    // 网关是纯 Node 服务（刻意不依赖 @mt/ui），色板双源是架构决定；
    // 「保持同步」从注释承诺升级为机器断言——任一侧改色漏改另一侧，此处立即红。
    // 注：不做跨包 import（tsc rootDir 不含 packages/），改为运行时读注册表源码解析 accent 值。
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    // cwd 兜底：turbo/pnpm 调用场景不同 cwd 不同（包目录 / monorepo 根均有出现），
    // 多候选探测直到命中 apps.ts。
    const base = process.env.INIT_CWD || process.cwd();
    const candidates = [
      resolve(base, "../../packages/ui/src/apps.ts"),
      resolve(base, "packages/ui/src/apps.ts"),
      resolve(base, "../packages/ui/src/apps.ts"),
    ];
    let source: string | null = null;
    for (const p of candidates) {
      try {
        source = await readFile(p, "utf-8");
        break;
      } catch {
        /* 试下一个候选路径 */
      }
    }
    expect(source, `drift guard 未定位到 packages/ui/src/apps.ts（cwd=${process.cwd()}）`).not.toBeNull();
    const registry = source as string;
    for (const [key, color] of Object.entries(APP_ACCENT)) {
      const re = new RegExp(`${key}:\\s*\\{[^}]*accent:\\s*"(${color})"`);
      expect(
        re.test(registry),
        `gateway APP_ACCENT.${key}(${color}) 与 @mt/ui APP_ACCENT_TOKENS.${key}.accent 漂移`
      ).toBe(true);
    }
    expect(Object.keys(APP_ACCENT).length).toBe(8);
  });
});