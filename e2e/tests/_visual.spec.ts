import { test, expect } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PAGES } from "../fixtures/pages";

// D-18 跨平台基线：守卫改为「运行平台上是否已存在对应基线文件」——
// snapshotPathTemplate 含 {platform}，win32/linux 基线独立文件互不干扰。
// - 本地 win32：snapshots/…-win32.png 在仓库中 → 正常跑
// - CI linux：snapshots/…-linux.png 由 .github/workflows/visual-baseline.yml
//   生成入库（fonts-noto-cjk 保证渲染一致）→ 基线存在后自动开始真跑
// - 基线缺失的平台：显式 skip 计入汇总（提示走基线生成 workflow）
// - PLAYWRIGHT_UPDATE=1：基线生成模式（workflow 专用），跳过守卫强制跑
const isUpdateMode = process.env.PLAYWRIGHT_UPDATE === "1";
const platform = process.platform as string;

// 16 页映射表（含锚点与 mask）已抽至 ../fixtures/pages，与 responsive.spec 共享唯一来源。

// 基线探测：递归扫 snapshots 目录按平台后缀计数。
// 不按文件名拼接探测——Playwright 会 sanitize 测试名（空格/中括号→'-'，中文与→保留），
// 拼路径易与实际产物名错位；按「-<platform>.png 后缀数量」判断与命名规则完全解耦。
// 基线总是整批生成（16 张），≥16 视为该平台基线齐备。
function countPlatformBaselines(platform: string): number {
  const snapshotDir = join(__dirname, "..", "snapshots");
  if (!existsSync(snapshotDir)) return 0;
  let count = 0;
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(`-${platform}.png`)) count += 1;
    }
  })(snapshotDir);
  return count;
}
const platformBaselineCount = countPlatformBaselines(platform);
const hasBaseline = platformBaselineCount >= PAGES.length;
test.skip(
  !isUpdateMode && !hasBaseline,
  `${platform} 平台基线不足（${platformBaselineCount}/${PAGES.length} 张 -${platform}.png），视觉快照跳过；基线生成见 .github/workflows/visual-baseline.yml`
);

for (const { name, path, anchor, mask, waitFor, settleMs } of PAGES) {
  test(`视觉快照 [${name}] → ${path}`, async ({ page }) => {
    // 1. 进入页面，等待网络空闲 + load 事件
    await page.goto(path, { waitUntil: "networkidle", timeout: 45000 });

    // 2. 如果定义了锚点文案，等它可见（确保外壳挂载完）。
    //    fail fast：全页范围内锚点失配立即失败并点名 fixtures——静默降级（main 失败换全页再等 8s）
    //    会让截图时机不定，产生「基线 update 后比对仍漂移」的疑难杂症（gatherer 5% 漂移事故的根因）。
    if (anchor) {
      await expect(
        page.getByText(anchor).first(),
        `锚点未命中（文案已重构？请同步 e2e/fixtures/pages.ts 的 anchor）：${anchor}`
      ).toBeVisible({ timeout: 8000 });
    }

    // 2.5 数据容器就绪：锚点只保证外壳文案渲染（先于数据），waitFor 等数据请求返回后的
    //     容器出现（.ant-table 空库也有表头），替代 fail fast 前靠 8s 锚点超时提供的数据缓冲。
    if (waitFor) {
      await page.locator(waitFor).first().waitFor({ state: "visible", timeout: 8000 });
    }

    // 2.6 并发写收尾：与功能用例共享库的页面，等待并发写用例（创建/更新流程）收尾，
    //     消除 KPI 计数/分页总数的数据竞态。fail fast 前这窗口由 8s 锚点超时隐性提供。
    if (settleMs) {
      await page.waitForTimeout(settleMs);
    }

    // 3. 给 AntD 组件动画 / 字体渲染 一段缓冲（600ms 远大于默认过渡时间）
    await page.waitForTimeout(600);

    // 4. 拍视口截图（非 fullPage）：fullPage 画布高度 = 页面高度，
    //    动态列表行数随并发用例写库而变 → 画布尺寸不同 → 比对必失败；
    //    视口固定 1440x900 与页高解耦，样式退化（布局/颜色/遮挡）仍能在首屏暴露
    // mask：动态列表区遮罩为纯色块，让基线只锁定外壳/布局/主题样式
    await expect(page).toHaveScreenshot(`${name}.png`, {
      ...(mask ? { mask: [page.locator(mask)] } : {}),
    });
  });
}
