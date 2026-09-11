import { defineConfig } from "vitest/config";
import { loadRootEnv } from "@mt/config";

loadRootEnv();

const databaseUrl = process.env.MANAGER_TEST_DATABASE_URL;
if (!databaseUrl || !/^\/mt_[a-z0-9_]*test$/.test(new URL(databaseUrl).pathname)) {
  throw new Error("MANAGER_TEST_DATABASE_URL 必须指向 mt_*test 专用测试库");
}

export default defineConfig({
  test: {
    environment: "node",
    env: { DATABASE_URL: databaseUrl },
    fileParallelism: false,
    include: ["src/requirement-foundation.e2e.test.ts", "src/import-batch.e2e.test.ts", "src/requirement-revisions.e2e.test.ts"],
  },
});
