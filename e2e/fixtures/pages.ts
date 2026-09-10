// 16 页映射表唯一来源：视觉基线（_visual.spec）与响应式巡检（responsive.spec）共用。
// - name：基线文件名片段与巡检用例名
// - path：网关代理路径
// - anchor：页面加载完成后等待的锚点文案（确保内容渲染完再截图/测量）
// - mask：视觉截图需屏蔽的动态区域选择器
// - waitFor：数据页必填——锚点只保证外壳渲染（文案先于数据），需再等数据容器出现
// - settleMs：与功能用例共享库的页面必填——fail fast 后截图提前到 1-2s，并发写用例
//   （岗位全流程/调研创建等）还在改 KPI 计数与分页总数；等待收尾窗口消除数据竞态
//   （fail fast 前靠 8s 锚点超时歪打正着提供了这个缓冲，v2.3.1 漂移事故实证不可省）
export interface VisualPage {
  name: string;
  path: string;
  anchor?: string | RegExp;
  mask?: string;
  waitFor?: string;
  settleMs?: number;
}

export const PAGES: VisualPage[] = [
  // ---------- 前台首屏 8 页 ----------
  {
    name: "front-applicant-position-wall",
    path: "/applicant/positions",
    anchor: /岗位博览|每一次投递/,
  },
  {
    name: "front-applicant-calendar",
    path: "/applicant/calendar",
    anchor: /投递日历|TIMELINE/,
    waitFor: "[data-testid=cal-empty]",
    // mask：今日格高亮随运行日期漂移、eyebrow 含年月——两处动态区遮罩，基线只锁布局与主题
    mask: "[data-testid=cal-month-grid], [data-testid=cal-eyebrow]",
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
  // gatherer / investigator / assessor 三应用前台本无内容，根路径展示报头后立即重定向到后台。
  // 锚点策略（v2.3.1 定稿）：锚定最终态 `· CONTROL`——AdminShell 侧栏（桌面）/顶栏 pill（移动）都渲染，
  // 且只在后台出现 = 重定向完成的确定信号。勿锚定前台 masthead 文案（只存在一帧，截图时机非确定）。
  {
    name: "front-gatherer-header-or-back",
    path: "/gatherer/",
    anchor: /·\s*CONTROL/,
    mask: "[data-testid=source-table]",
  },
  {
    name: "front-investigator-header-or-back",
    path: "/investigator/",
    anchor: /·\s*CONTROL/,
  },
  {
    name: "front-assessor-header-or-back",
    path: "/assessor/",
    anchor: /·\s*CONTROL/,
  },

  // ---------- 后台主列表 8 页 ----------
  {
    name: "back-applicant-position-list",
    path: "/applicant/admin/positions",
    anchor: /ADMIN · JOBS|岗位管理/,
  },
  {
    name: "back-scholar-entry-admin",
    path: "/scholar/admin/entries",
    anchor: /ADMIN · COLLECTION|馆藏管理/,
    mask: "[data-testid=entry-rows], [data-testid=entry-count]",
  },
  {
    name: "back-manager-requirement-admin",
    path: "/manager/admin/requirements",
    anchor: /ADMIN · REQUIREMENTS|需求管理/,
    mask: "[data-testid=requirement-table]",
    waitFor: "[data-testid=requirement-table], .as-content .ant-table",
    settleMs: 9000,
  },
  {
    name: "back-assistant-feedback-admin",
    path: "/assistant/admin/feedback",
    anchor: /ADMIN · FEEDBACK|反馈/,
    waitFor: ".ant-table",
    settleMs: 9000,
  },
  {
    name: "back-designer-component-admin",
    path: "/designer/admin/components",
    anchor: /ADMIN · COMPONENTS|组件馆藏/,
  },
  {
    name: "back-gatherer-source-admin",
    path: "/gatherer/admin/sources",
    anchor: /ADMIN · SOURCES|采集源管理/,
    mask: "[data-testid=source-table]",
  },
  {
    name: "back-investigator-survey-admin",
    path: "/investigator/admin/surveys",
    anchor: /ADMIN · RESEARCH|调研管理/,
    waitFor: ".ant-table",
    settleMs: 9000,
  },
  {
    name: "back-assessor-request-admin",
    path: "/assessor/admin/requests",
    anchor: /ADMIN · REVIEWS|评审请求/,
    waitFor: ".ant-table",
    settleMs: 9000,
  },
];
