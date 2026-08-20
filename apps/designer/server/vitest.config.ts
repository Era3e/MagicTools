import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // e2e 测试文件共享同一数据库，串行执行避免互相清场干扰
    fileParallelism: false,
  },
});
