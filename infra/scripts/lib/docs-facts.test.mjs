import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkHistoricalSpecs,
  checkDocumentationImpact,
  parseCoverageMatrix,
  parseExpressRoutes,
  parseExpressEndpoints,
  parseGatewayEndpoints,
  parseNestControllers,
  parseReactRoutes,
} from "./docs-facts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("parseCoverageMatrix 保留模块、功能、状态与原始证据列", () => {
  const md = [
    "# matrix",
    "",
    "## 1. Applicant（求职）",
    "",
    "| # | 功能点 | Spec | 实现文件 | 状态 | E2E |",
    "|---|---|---|---|---|---|",
    "| A1 | 岗位 CRUD | spec 1 | apps/applicant/server/position.ts | ✅ 已实现 | applicant.spec.ts |",
    "| A2 | 视觉识别 | spec 2 | server/vision.ts | ⚠️ 部分实现 | — |",
  ].join("\n");
  const facts = parseCoverageMatrix(md);
  assert.deepEqual(facts.modules, ["Applicant"]);
  assert.equal(facts.items.length, 2);
  assert.deepEqual(facts.items[0], {
    module: "Applicant",
    id: "A1",
    title: "岗位 CRUD",
    status: "✅ 已实现",
    implementation: "apps/applicant/server/position.ts",
    evidence: "applicant.spec.ts",
    paths: ["apps/applicant/server/position.ts"],
  });
  assert.equal(facts.items[1].status, "⚠️ 部分实现");
});

test("接口与功能代码变更必须携带文档影响证据", () => {
  assert.deepEqual(checkDocumentationImpact([
    "apps/manager/web/src/App.tsx",
    "docs/generated/interface-index.md",
  ]), []);
  assert.deepEqual(checkDocumentationImpact([
    "apps/manager/server/src/requirement.service.ts",
    "docs/superpowers/coverage-matrix.md",
  ]), []);
  assert.deepEqual(checkDocumentationImpact([
    "apps/manager/server/src/requirement.controller.ts",
  ]), [
    { file: "apps/manager/server/src/requirement.controller.ts", reason: "route-or-controller-change-without-interface-doc" },
  ]);
  assert.deepEqual(checkDocumentationImpact([
    "packages/db/src/outbox.ts",
  ]), [
    { file: "packages/db/src/outbox.ts", reason: "package-behavior-change-without-feature-doc" },
  ]);
  assert.deepEqual(checkDocumentationImpact([
    "apps/gateway/src/app.ts",
    "apps/gateway/src/routes.ts",
    "apps/gateway/src/auth.ts",
    "infra/ports.yaml",
    "docs/generated/interface-index.md",
  ]), []);
  assert.deepEqual(checkDocumentationImpact([
    "apps/gateway/src/app.ts",
    "apps/gateway/src/routes.ts",
    "apps/gateway/src/auth.ts",
    "infra/ports.yaml",
  ]), [
    { file: "apps/gateway/src/app.ts", reason: "gateway-route-change-without-interface-doc" },
    { file: "apps/gateway/src/routes.ts", reason: "gateway-route-change-without-interface-doc" },
    { file: "apps/gateway/src/auth.ts", reason: "gateway-route-change-without-interface-doc" },
    { file: "infra/ports.yaml", reason: "gateway-proxy-route-change-without-interface-doc" },
  ]);
  assert.deepEqual(checkDocumentationImpact([
    "apps/manager/server/src/requirement.service.test.ts",
  ]), []);
});

test("接口解析覆盖 React Route 与 Nest Controller 组合路径", () => {
  const app = `
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/items/:id" element={<Item />} />
    </Routes>
  `;
  const server = `
    @Controller("requirements")
    export class RequirementController {
      @Get() list() {}
      @Post(":id/approve") approve() {}
    }
    @Controller()
    export class MetaController {
      @Get("meta/status") status() {}
    }
  `;
  assert.deepEqual(parseReactRoutes(app), ["/", "/items/:id"]);
  assert.deepEqual(parseNestControllers(server), [
    { method: "GET", path: "/requirements" },
    { method: "POST", path: "/requirements/:id/approve" },
    { method: "GET", path: "/meta/status" },
  ]);
});

test("接口解析覆盖 Gateway Express 字面路由", () => {
  const source = `
    app.get("/health", handler);
    app.get("/status", handler);
    app.get("/", handler);
  `;
  assert.deepEqual(parseExpressRoutes(source), ["/health", "/status", "/"]);
});

test("接口解析覆盖 Gateway 字面方法、认证入口与 ports 动态代理", () => {
  const app = `
    app.get("/health", handler);
    app.get("/status", handler);
  `;
  const auth = `
    if (req.path === "/login" && req.method === "POST") {}
    if (req.path === "/login" && req.method === "GET") {}
    if (req.path === "/logout" && req.method === "POST") {}
  `;
  const ports = "gateway: { web: 3000 }\nmanager: { web: 4004, server: 5004 }\n";
  assert.deepEqual(parseExpressEndpoints(app), [
    { method: "GET", path: "/health" },
    { method: "GET", path: "/status" },
  ]);
  assert.deepEqual(parseGatewayEndpoints(app, auth, ports), [
    { method: "GET", path: "/health" },
    { method: "GET", path: "/status" },
    { method: "GET", path: "/login" },
    { method: "POST", path: "/login" },
    { method: "POST", path: "/logout" },
    { method: "GET", path: "/manager" },
    { method: "ALL", path: "/manager/*" },
    { method: "ALL", path: "/api/manager/*" },
  ]);
});

test("历史 spec 必须显式标识，当前设计不误报", () => {
  const files = new Map([
    ["old-design.md", "# 旧设计\n\n## 内容\n"],
    ["current-design.md", "# 当前设计\n\n> 设计状态：当前设计基线。\n"],
  ]);
  assert.deepEqual(checkHistoricalSpecs(files), [
    { file: "old-design.md", reason: "missing-historical-marker" },
  ]);
});

test("活守卫：真实生成文档必须与当前功能映射与接口源码一致", async () => {
  const docsFacts = await import("./docs-facts.mjs");
  const result = docsFacts.validateRepository(root);
  assert.deepEqual(
    result,
    { ok: true, generated: ["docs/generated/feature-map.md", "docs/generated/coverage-view.md", "docs/generated/interface-index.md"] },
    `文档事实漂移：${JSON.stringify(result, null, 2)}`,
  );
});
