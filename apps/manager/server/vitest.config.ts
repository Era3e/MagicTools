import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // e2e 测试文件共享同一数据库，串行执行避免互相清场干扰
    fileParallelism: false,
    // 关键数据库契约由 test:integration 强制连接专用库，不在无数据库的单元测试阶段空跑。
    exclude: [...configDefaults.exclude, "src/requirement-foundation.e2e.test.ts", "src/import-batch.e2e.test.ts"],
  },
});
