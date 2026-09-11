import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["../../../infra/testing/unit-database-boundary.mjs"],
    fileParallelism: false,
    // 关键数据库套件由 test:db 在独立测试库强制执行，普通单测不依赖数据库。
    exclude: [...configDefaults.exclude, "src/action.e2e.test.ts", "src/chat.dual.e2e.test.ts", "src/chat.e2e.test.ts", "src/clarify.e2e.test.ts", "src/cybercloud-calls.repo.test.ts", "src/data-query.e2e.test.ts", "src/feedback.e2e.test.ts", "src/intent-log.e2e.test.ts", "src/multi-turn.e2e.test.ts", "src/trouble.e2e.test.ts"],
  },
});
