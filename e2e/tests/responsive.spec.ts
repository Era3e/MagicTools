import { test, expect } from "@playwright/test";
import { PAGES } from "../fixtures/pages";

// 响应式巡检：每页在窄视口下不允许出现横向溢出（pageSW ≤ viewport + 1px 容差）。
// 不拍截图、不做像素比对，纯几何断言，跑完全部页面 <30s。
// 防线背景：UI v2.3 曾因双壳 max-width 定宽与表格无折叠，375px 下全站横向溢出。
const VIEWPORTS = [
  { label: "mobile-375", width: 375, height: 812 },
  { label: "tablet-768", width: 768, height: 1024 },
] as const;

for (const vp of VIEWPORTS) {
  for (const { name, path, anchor } of PAGES) {
    test(`[${vp.label}] [${name}] 无横向溢出`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(path, { waitUntil: "networkidle", timeout: 45000 });

      if (anchor) {
        // 锚点失配即失败（fail fast）：锚点文案过期必须同步 fixtures/pages.ts，
        // 不做静默降级——否则测量时机不定，溢出会时现时隐。
        await expect(
          page.getByText(anchor).first(),
          `锚点未命中（文案已重构？请同步 e2e/fixtures/pages.ts 的 anchor）：${anchor}`
        ).toBeVisible({ timeout: 8000 });
      }

      await page.waitForTimeout(300);

      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return { scrollWidth: el.scrollWidth, innerWidth: window.innerWidth };
      });
      expect(
        overflow.scrollWidth,
        `[${vp.label}] ${path} 横向溢出：scrollWidth ${overflow.scrollWidth} > viewport ${overflow.innerWidth}`
      ).toBeLessThanOrEqual(overflow.innerWidth + 1);
    });
  }
}
