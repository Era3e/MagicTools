import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["../../../infra/testing/unit-database-boundary.mjs"],
    fileParallelism: false,
    // 关键数据库套件由 test:db 在独立测试库强制执行，普通单测不依赖数据库。
    exclude: [...configDefaults.exclude, "src/source.e2e.test.ts"],
  },
});
