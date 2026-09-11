import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["../../../infra/testing/unit-database-boundary.mjs"],
    fileParallelism: false,
    // 关键数据库套件由 test:db 在独立测试库强制执行，普通单测不依赖数据库。
    exclude: [...configDefaults.exclude, "src/import-batch.e2e.test.ts", "src/iteration.e2e.test.ts", "src/requirement-foundation.e2e.test.ts", "src/requirement-revisions.e2e.test.ts", "src/requirement.e2e.test.ts", "src/runtime-readiness.e2e.test.ts"],
  },
});
