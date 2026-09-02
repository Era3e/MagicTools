/**
 * MagicTools v2 设计令牌（墨蓝石墨·工房感）
 * 唯一规范来源：.design_library/magictools/colors_and_type.css（docs/ui-spec.md v2）
 * 兼容说明：color/spacing/fontSize/radius 保持 v1 键结构（存量业务代码零改动），
 * 值全部替换为 v2 色板；新增 dark/admin/shadow/motion/size/font 扩展块。
 */
export const tokens = {
  color: {
    primary: "#2c4a6e", // mt-ink-600
    success: "#3a7049", // mt-success-600
    warning: "#9a6a25", // mt-warning-600
    error: "#943d35", // mt-error-600
    info: "#3a5f84", // mt-info-600
    text: "#1c2530", // text-strong
    textSecondary: "#5f6c7c", // text-muted
    bgLayout: "#f4f6f8", // background
    bgContainer: "#ffffff", // surface-1 / card
    bgNeutral: "#eceef1", // mt-graphite-100（表格表头/代码块底）
    bgActive: "#e3eaf2", // mt-ink-100（选中/悬浮 tint）
    bgUser: "#eef1f5", // surface-2（凹面/输入底）
    border: "#d9dde3", // mt-graphite-200
    purple: "#3a5f84", // v2：去 AntD 紫改墨蓝系 info（applicant 笔试状态）
    cyan: "#4a8a5d", // v2：去 AntD 青改 success-500（applicant offer 状态）
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  fontSize: { sm: 12, md: 14, lg: 16, xl: 20 },
  radius: 6, // radius-md；组件圆角细则 radiusTokens（4/6/10）
  // ---------- v2 扩展：色阶（10 阶，供主题派生与状态标签用） ----------
  scale: {
    ink: ["#f3f6fa", "#e3eaf2", "#c6d4e3", "#9db3ca", "#6e8bad", "#2c4a6e", "#233c5a", "#1b2e45", "#142130", "#101923"],
    graphite: ["#f6f7f9", "#eceef1", "#d9dde3", "#bcc3cd", "#96a0ad", "#74808f", "#5a6573", "#454f5b", "#333c46", "#232b33"],
    amber: ["#fbf6ec", "#f5ebd3", "#ead5a6", "#dcbb74", "#cfa04c", "#c08a35", "#a06f2a", "#7f5724", "#5f411f", "#47301a"],
    success: ["#f0f7f1", "#dcecdf", "#b9d9c0", "#8fc09c", "#67a478", "#4a8a5d", "#3a7049", "#2f5a3b", "#25462f", "#1c3524"],
    warning: ["#fbf6ea", "#f5e9cd", "#ead29e", "#ddb768", "#cf9c40", "#bb852f", "#9a6a25", "#7a531f", "#5b3d19", "#432e15"],
    error: ["#faf1f0", "#f4dedb", "#e8bcb7", "#d9958d", "#c76d63", "#b04f45", "#943d35", "#76312b", "#582622", "#401d1a"],
    info: ["#eff5fa", "#dce9f3", "#bcd2e5", "#92b4d2", "#6893bc", "#4a77a1", "#3a5f84", "#2f4c69", "#253a50", "#1b2a3c"],
  },
  // ---------- v2 扩展：暗色板（一等公民，AdminShell 常驻） ----------
  dark: {
    primary: "#6e8bad", // mt-ink-400
    text: "#dde4ec",
    textSecondary: "#9aa7b6",
    background: "#14181f",
    surface0: "#171c24",
    surface1: "#1b212b",
    surface2: "#232b37",
    card: "#1b212b",
    border: "#2d3644",
    accent: "#cfa04c", // mt-amber-400
    rowHover: "#263040", // 后台表格悬浮行（surface2 与 surface1 之间的墨蓝 tint）
  },
  // ---------- v2 扩展：后台外壳（石墨深色控制台锚点） ----------
  admin: {
    siderBg: "#14181f",
    contentBg: "#14181f",
    headerBg: "#171c24",
    border: "#2d3644",
    text: "#dde4ec",
    textSecondary: "#9aa7b6",
    accent: "#6e8bad", // 墨蓝 400（暗色下主色）
    accentHover: "#9db3ca", // mt-ink-300
  },
  // ---------- v2 扩展：海拔（墨调投影，海拔即层级） ----------
  shadow: {
    card: "0 1px 2px rgba(27, 46, 69, 0.06), 0 1px 1px rgba(27, 46, 69, 0.04)",
    cardHover: "0 2px 6px -1px rgba(27, 46, 69, 0.10), 0 1px 2px rgba(27, 46, 69, 0.06)",
    dropdown: "0 8px 20px -6px rgba(27, 46, 69, 0.16), 0 2px 6px -2px rgba(27, 46, 69, 0.08)",
    modal: "0 16px 36px -12px rgba(27, 46, 69, 0.22), 0 4px 10px -4px rgba(27, 46, 69, 0.10)",
    overlay: "0 24px 56px -20px rgba(20, 33, 48, 0.30), 0 8px 18px -8px rgba(20, 33, 48, 0.14)",
  },
  // ---------- v2 扩展：动效 ----------
  motion: {
    durationFast: "120ms",
    durationBase: "200ms",
    durationSlow: "320ms",
    easeStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
    easeEntrance: "cubic-bezier(0, 0, 0.2, 1)",
  },
  // ---------- v2 扩展：尺寸（工房密度） ----------
  size: { buttonSm: 32, buttonMd: 36, buttonLg: 44, input: 36, iconSm: 16, iconMd: 20, iconLg: 24 },
  // ---------- v2 扩展：字体三层 ----------
  font: {
    display: `"Noto Serif SC", "Source Serif 4", "Songti SC", serif`,
    body: `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`,
    mono: `"JetBrains Mono", "Cascadia Mono", Consolas, monospace`,
  },
  // ---------- v2 扩展：圆角细则 ----------
  radiusTokens: { sm: 4, md: 6, lg: 10, full: 9999 },
} as const;

export type Tokens = typeof tokens;
