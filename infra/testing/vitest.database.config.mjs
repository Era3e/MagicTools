if (process.env.MT_DATABASE_TEST_MODE !== "required" || !process.env.MT_DATABASE_TEST_FILES) {
  throw new Error("请通过 pnpm test:db 启动关键数据库验证，先初始化隔离测试库");
}

export default {
  test: {
    environment: "node",
    fileParallelism: false,
    include: JSON.parse(process.env.MT_DATABASE_TEST_FILES),
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
};
