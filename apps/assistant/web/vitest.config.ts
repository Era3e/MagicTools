import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// @mt/ui 直连源码：单测永远测最新 src（dist 陈旧构建曾致 AdminPageHead undefined 假失败）；
// dist 仅在 build/smoke（vite preview）链路验证，两轨职责分离。
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@mt\/ui$/, replacement: resolve(__dirname, "../../../packages/ui/src/index.ts") },
      { find: /^@mt\/ui\/(.*)$/, replacement: resolve(__dirname, "../../../packages/ui/src/$1") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
