import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { checkDependencyIndex, summarizeDependencyGraph, renderDependencyIndex } from "./code-graph.mjs";

const require = createRequire(import.meta.url);

test("summarizeDependencyGraph 汇总 workspace 模块边并过滤自环", () => {
  const summary = summarizeDependencyGraph({
    modules: [
      {
        source: "apps/manager/server/src/a.ts",
        dependencies: [
          { resolved: "packages/db/src/index.ts" },
          { resolved: "@mt/model-client" },
          { resolved: "apps/manager/server/src/b.ts" },
          { resolved: "apps/scholar/server/src/c.ts" },
        ],
      },
      {
        source: "packages/ui/src/UserShell.tsx",
        dependencies: [{ resolved: "packages/ui/src/theme.tsx" }],
      },
      {
        source: "node_modules/react/index.js",
        dependencies: [],
      },
    ],
  });

  assert.equal(summary.sourceModuleCount, 2);
  assert.equal(summary.graphNodeCount, 3);
  assert.equal(summary.dependencyCount, 5);
  assert.equal(summary.moduleCount, 2);
  assert.deepEqual(summary.workspaceEdges, [
    { from: "apps/manager/server", to: "apps/scholar/server" },
    { from: "apps/manager/server", to: "packages/db" },
    { from: "apps/manager/server", to: "packages/model-client" },
  ]);
});

test("renderDependencyIndex 输出稳定的事实索引", () => {
  const rendered = renderDependencyIndex({
    sourceModuleCount: 2,
    graphNodeCount: 3,
    dependencyCount: 5,
    moduleCount: 2,
    workspaceEdges: [{ from: "apps/manager/server", to: "packages/db" }],
    rules: ["no-circular", "packages-no-apps", "apps-isolated", "no-production-to-test"],
  });

  assert.match(rendered, /# MagicTools 依赖图索引/);
  assert.match(rendered, /\| 源码模块 \| 2 \|/);
  assert.match(rendered, /\| Graph 节点 \| 3 \|/);
  assert.match(rendered, /\| 依赖边 \| 5 \|/);
  assert.match(rendered, /\| apps\/manager\/server \| packages\/db \|/);
  assert.match(rendered, /no-circular、packages-no-apps、apps-isolated、no-production-to-test/);
  assert.doesNotMatch(rendered, /undefined/);
});

test("dependency-cruiser 配置覆盖四类架构守卫", () => {
  const config = require("../../../.dependency-cruiser.cjs");
  const names = config.forbidden.map((rule) => rule.name);

  assert.ok(names.includes("no-circular"));
  assert.ok(names.includes("packages-no-apps"));
  assert.equal(names.filter((name) => name.startsWith("apps-isolated-")).length, 8);
  assert.ok(names.includes("no-production-to-test"));
});

test("生产引用测试规则覆盖 e2e 目录与 JS 系测试文件", () => {
  const config = require("../../../.dependency-cruiser.cjs");
  const rule = config.forbidden.find((item) => item.name === "no-production-to-test");
  const to = new RegExp(rule.to.path, "u");
  const from = new RegExp(rule.from.path, "u");
  const fromNot = new RegExp(rule.from.pathNot, "u");

  assert.equal(to.test("e2e/fixtures/helper.ts"), true);
  assert.equal(to.test("apps/demo/server/src/a.test.mjs"), true);
  assert.equal(to.test("apps/demo/server/src/a.ts"), false);
  assert.equal(from.test("apps/demo/server/src/a.ts"), true);
  assert.equal(fromNot.test("apps/demo/server/src/a.ts"), false);
  assert.equal(fromNot.test("e2e/tests/demo.spec.ts"), true);
});

test("checkDependencyIndex 拒绝陈旧生成物", () => {
  const summary = {
    sourceModuleCount: 2,
    graphNodeCount: 3,
    dependencyCount: 5,
    moduleCount: 2,
    workspaceEdges: [{ from: "apps/manager/server", to: "packages/db" }],
    rules: ["no-circular"],
  };

  assert.deepEqual(checkDependencyIndex(summary, renderDependencyIndex(summary)), []);
  assert.deepEqual(checkDependencyIndex(summary, renderDependencyIndex(summary) + "\n"), [
    { reason: "dependency-index-stale" },
  ]);
});
