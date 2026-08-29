/**
 * 视觉快照回归（P0-1c + D-18 落地）
 * 覆盖：8 应用前台首屏 + 8 应用后台主列表 = 共 16 页
 * 用途：样式跑版 / 颜色错位 / 字体硬编码 / 元素遮挡 等低级 UI bug 在 CI 直接拦截
 *
 * 基准快照更新：
 *   - 本地 win32：pnpm --filter @mt/e2e exec playwright test _visual.spec.ts --update-snapshots
 *   - CI linux：  CI 安装 fonts-noto-cjk 后自动生成 linux 基线（首次需手动触发基线生成 workflow）
 *   - 或根目录：pnpm e2e:update（见 package.json 脚本）
 *
 * 基线按平台分文件（snapshotPathTemplate 含 {platform}），win32/linux 独立维护。
 */

import { test, expect } from "@playwright/test";

// CI 守卫：仓库仅维护 win32 基线（字体光栅化/反锯齿跨平台差异），CI（linux）无 -linux.png
// 基线文件，跑必失败于 snapshot missing。装 CJK 字体只解决渲染差异，不解决基线缺失——
// linux 基线需专门的基线生成 workflow 产出后入库（见 mvp-deferred D-18）。
// CI 上显式跳过并计入汇总行；本地跑法不变：pnpm e2e:visual（或全量 pnpm e2e）。
const isCi = !!process.env.CI;
test.skip(
  isCi,
  "CI(linux) 无 linux 像素基线，视觉快照仅本地跑（基线生成方案 mvp-deferred D-18）"
);

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
