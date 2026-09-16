const businessApps = [
  "applicant",
  "assessor",
  "assistant",
  "designer",
  "gatherer",
  "investigator",
  "manager",
  "scholar",
];

const TEST_FILE_PATH = "(^e2e/|((\\.test|\\.spec|\\.e2e)\\.(ts|tsx|js|jsx|mjs|cjs)$))";
const PRODUCTION_FILE_PATH = "^(apps|packages)/.+\\.(ts|tsx|js|jsx|mjs|cjs)$";

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "循环依赖会让模块边界与初始化顺序不可解释。",
      from: {},
      to: { circular: true },
    },
    {
      name: "packages-no-apps",
      severity: "error",
      comment: "公共包不得反向依赖业务应用。",
      from: { path: "^packages/[^/]+/" },
      to: { path: "^apps/" },
    },
    ...businessApps.map((app) => ({
      name: `apps-isolated-${app}`,
      severity: "error",
      comment: "应用间协作必须经 Gateway REST、outbox 或公共包，不直接引用彼此源码。",
      from: { path: `^apps/${app}/` },
      to: { path: "^apps/", pathNot: `^apps/${app}/` },
    })),
    {
      name: "no-production-to-test",
      severity: "error",
      comment: "生产源码不得引用测试文件。",
      from: {
        path: PRODUCTION_FILE_PATH,
        pathNot: TEST_FILE_PATH,
      },
      to: { path: TEST_FILE_PATH },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: "(^|/)dist(/|$)",
    moduleSystems: ["es6", "cjs"],
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports", "main"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    },
  },
};
