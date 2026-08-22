import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: { statements: 70, lines: 70, functions: 70, branches: 50 },
    },
  },
});
