import { test, expect } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// D-18 跨平台基线：守卫改为「运行平台上是否已存在对应基线文件」——
// snapshotPathTemplate 含 {platform}，win32/linux 基线独立文件互不干扰。
// - 本地 win32：snapshots/…-win32.png 在仓库中 → 正常跑
// - CI linux：snapshots/…-linux.png 由 .github/workflows/visual-baseline.yml
//   生成入库（fonts-noto-cjk 保证渲染一致）→ 基线存在后自动开始真跑
// - 基线缺失的平台：显式 skip 计入汇总（提示走基线生成 workflow）
// - PLAYWRIGHT_UPDATE=1：基线生成模式（workflow 专用），跳过守卫强制跑
const isUpdateMode = process.env.PLAYWRIGHT_UPDATE === "1";
const platform = process.platform as string;

/**
 * 16 页映射表：[测试名, 访问路径, 页面加载后等待的锚点元素（确保内容渲染完再拍）]
 * - 前台 8 页：带 front- 前缀
 * - 后台 8 页：带 back- 前缀
 */
const PAGES: Array<{ name: string; path: string; anchor?: string | RegExp; mask?: string }> = [
  // ---------- 前台首屏 8 页 ----------
  {
    name: "front-applicant-position-wall",
    path: "/applicant/positions",
    anchor: /岗位博览|每一次投递/,
  },
  {
    name: "front-scholar-entry-list",
    path: "/scholar/entries",
    anchor: /知识书院|馆 藏 目 录/,
    mask: "[data-testid=entry-rows], [data-testid=entry-count]",
  },
  {
    name: "front-manager-requirement-board",
    path: "/manager/requirements",
    anchor: /交付驾驶舱|需求在轨/,
    mask: "[data-testid=board-lanes], [data-testid=board-total]",
  },
  {
    name: "front-assistant-chat",
    path: "/assistant/chat",
    anchor: /智能助手|有问题，就直接问/,
  },
  {
    name: "front-designer-generate",
    path: "/designer/generate",
    anchor: /组件画廊|定制生成/,
  },
  // gatherer / investigator / assessor 三应用前台本无内容，根路径会展示报头后重定向到后台
  // 这里故意拍「重定向前的报头瞬间」，如果重定向过快，拍到后台也不算错（依然是页面视觉基线）
  {
    name: "front-gatherer-header-or-back",
    path: "/gatherer/",
    anchor: /知识采集部|信息源管理|ADMIN CONSOLE/,
    mask: "[data-testid=source-table]",
  },
  {
    name: "front-investigator-header-or-back",
    path: "/investigator/",
    anchor: /调研档案馆|主题档案管理|ADMIN CONSOLE/,
  },
  {
    name: "front-assessor-header-or-back",
    path: "/assessor/",
    anchor: /评审文书房|分析请求审批|ADMIN CONSOLE/,
  },

  // ---------- 后台主列表 8 页 ----------
  {
    name: "back-applicant-position-list",
    path: "/applicant/admin/positions",
    anchor: /ADMIN CONSOLE|岗位列表/,
  },
  {
    name: "back-scholar-entry-admin",
    path: "/scholar/admin/entries",
    anchor: /ADMIN CONSOLE|条目编目|馆 藏 目 录/,
    mask: "[data-testid=entry-rows], [data-testid=entry-count]",
  },
  {
    name: "back-manager-requirement-admin",
    path: "/manager/admin/requirements",
    anchor: /ADMIN CONSOLE|需求管理/,
    mask: "[data-testid=requirement-table]",
  },
  {
    name: "back-assistant-feedback-admin",
    path: "/assistant/admin/feedback",
    anchor: /ADMIN CONSOLE|反馈处理|反馈/,
  },
  {
    name: "back-designer-component-admin",
    path: "/designer/admin/components",
    anchor: /ADMIN CONSOLE|组件馆藏/,
  },
  {
    name: "back-gatherer-source-admin",
    path: "/gatherer/admin/sources",
    anchor: /ADMIN CONSOLE|信息源管理/,
    mask: "[data-testid=source-table]",
  },
  {
    name: "back-investigator-survey-admin",
    path: "/investigator/admin/surveys",
    anchor: /ADMIN CONSOLE|主题档案管理/,
  },
  {
    name: "back-assessor-request-admin",
    path: "/assessor/admin/requests",
    anchor: /ADMIN CONSOLE|分析请求审批/,
  },
];

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

for (const { name, path, anchor, mask } of PAGES) {
  test(`视觉快照 [${name}] → ${path}`, async ({ page }) => {
    // 1. 进入页面，等待网络空闲 + load 事件
    await page.goto(path, { waitUntil: "networkidle", timeout: 45000 });

    // 2. 如果定义了锚点文案，等它可见（确保数据加载完/外壳挂载完）
    if (anchor) {
      try {
        await expect(page.getByRole("main").getByText(anchor).first()).toBeVisible({
          timeout: 8000,
        });
      } catch {
        // 有些页面 main 可能没明确 role，降级为全页搜索
        await expect(page.getByText(anchor).first()).toBeVisible({ timeout: 8000 });
      }
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
