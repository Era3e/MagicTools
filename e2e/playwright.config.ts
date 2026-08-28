import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: {
    // 视觉快照：允许 2% 像素级偏差，避免 AntD 动画/字体反锯齿等微差导致失败
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.2 },
    timeout: 10000,
  },
  snapshotDir: "./snapshots",
  // 视觉基线按平台分文件（win32/linux 字体光栅化不同，像素基线不可跨平台复用）；
  // 基线当前仅 win32（本机生成），CI 上跳过视觉用例（见 _visual.spec.ts 的 CI 守卫）
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testName}-{arg}-{platform}{ext}",
  use: {
    baseURL: "http://127.0.0.1:3000",
    // 统一桌面端 1440x900：与深度设计的基准分辨率对齐
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    // CI 与本地生成的快照一致（字体/颜色等环境因素降噪）
    colorScheme: "light",
  },
  reporter: [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]],
  // 本地用 pnpm e2e:update 更新快照（package.json 脚本）
});
