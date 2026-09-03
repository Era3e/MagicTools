/**
 * MagicTools v2.1 设计令牌（墨蓝石墨·工房感 · 质感升级）
 * 参考系：Linear 四级表面阶梯 + Stripe 双层投影 + GitHub 发丝边框 + Vercel 排版精度
 * 唯一规范来源：.design_library/magictools/colors_and_type.css（docs/ui-spec.md v2）
 * 兼容说明：color/spacing/fontSize/radius 保持 v1 键结构（存量业务代码零改动），
 * 值全部替换为 v2 色板；新增 dark/admin/shadow/craft/motion/size/font 扩展块。
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
  // ---------- v2.1 升级：暗色板（Linear 四级表面阶梯 + 透明度文字层级） ----------
  dark: {
    primary: "#6e8bad", // mt-ink-400
    text: "#dde4ec", // 兼容存量代码（= textPrimary 的实色映射）
    textSecondary: "#9aa7b6", // 兼容存量代码
    // 透明度文字层级（Notion/Vercel 风格：一色多变，换底自动适配）
    textPrimary: "rgba(245, 247, 250, 0.95)", // 主文字
    textTertiary: "rgba(245, 247, 250, 0.65)", // 次级文字
    textFaint: "rgba(245, 247, 250, 0.40)", // 辅助文字
    textDisabled: "rgba(245, 247, 250, 0.28)", // 禁用/占位
    // Linear 式四级表面亮度阶梯（非投影承载层级）
    background: "#0e1218", // 画布——带蓝调微调的近黑，非纯黑
    surface0: "#14181f", // 基础表面（侧栏/底栏）
    surface1: "#181d26", // 卡片表面
    surface2: "#1e2530", // 悬停表面
    surface3: "#252e3b", // 抬起/active 表面
    surface4: "#2d3848", // 下拉/弹层表面
    card: "#181d26", // = surface1
    border: "#2a3340", // 发丝边框色（冷蓝调）
    accent: "#cfa04c", // mt-amber-400
    rowHover: "#1e2530", // 表格悬浮行（= surface2）
    // 暗色发丝边框（GitHub 式半透明白）
    hairline: "rgba(255, 255, 255, 0.07)",
    hairlineStrong: "rgba(255, 255, 255, 0.12)",
    hairlineHover: "rgba(255, 255, 255, 0.16)",
    // 暗色交互表面 tint（透明度层，供 AntD 组件注入用）
    tableHeaderBg: "rgba(255, 255, 255, 0.025)",
    tableRowHoverBg: "rgba(255, 255, 255, 0.035)",
    rowSelectedBg: "rgba(110, 139, 173, 0.08)",
    rowSelectedHoverBg: "rgba(110, 139, 173, 0.12)",
    menuSelectedBg: "rgba(110, 139, 173, 0.10)",
    menuHoverBg: "rgba(255, 255, 255, 0.04)",
    tagBg: "rgba(255, 255, 255, 0.04)",
  },
  // ---------- v2.1 升级：后台外壳（对齐四级表面阶梯） ----------
  admin: {
    siderBg: "#0e1218", // = dark.background（画布级深色）
    contentBg: "#0e1218",
    headerBg: "#14181f", // = dark.surface0
    border: "#2a3340", // = dark.border
    text: "rgba(245, 247, 250, 0.95)", // 透明度文字层级
    textSecondary: "rgba(245, 247, 250, 0.65)",
    accent: "#6e8bad", // 墨蓝 400（暗色下主色）
    accentHover: "#9db3ca", // mt-ink-300
  },
  // ---------- v2.1 升级：海拔（Stripe 双层投影 + 暗色 inset 高光） ----------
  shadow: {
    card: "inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 1px 2px rgba(27, 46, 69, 0.07), 0 1px 1px rgba(27, 46, 69, 0.04)",
    cardHover: "inset 0 1px 0 rgba(255, 255, 255, 0.65), 0 2px 6px -1px rgba(27, 46, 69, 0.10), 0 1px 2px rgba(27, 46, 69, 0.06)",
    dropdown: "0 0 0 1px rgba(27, 46, 69, 0.05), 0 8px 20px -6px rgba(27, 46, 69, 0.16), 0 2px 6px -2px rgba(27, 46, 69, 0.08)",
    modal: "0 16px 36px -12px rgba(27, 46, 69, 0.22), 0 4px 10px -4px rgba(27, 46, 69, 0.10)",
    overlay: "0 24px 56px -20px rgba(20, 33, 48, 0.30), 0 8px 18px -8px rgba(20, 33, 48, 0.14)",
    // Stripe 式暗色双层投影：近距小模糊 + 远距大模糊 + inset 顶部高光线
    darkCard: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)",
    darkCardHover: "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 8px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
    darkDropdown: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 24px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.25)",
    darkModal: "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 16px 48px rgba(0, 0, 0, 0.5), 0 8px 24px rgba(0, 0, 0, 0.3)",
    // GitHub 式焦点环：品牌色 3px 透明度
    focusRing: "0 0 0 3px rgba(110, 139, 173, 0.4)",
  },
  // ---------- v2.1 升级：质感工艺层（Linear 噪点 + 多层环境光 + 渐变描边） ----------
  craft: {
    hairline: "rgba(20, 33, 48, 0.08)", // 亮色发丝分隔
    hairlineStrong: "rgba(20, 33, 48, 0.14)",
    // Linear 式多层环境聚光灯（非 box-shadow，径向渐变产生羽化光）
    glowDark: "radial-gradient(900px 420px at 50% -120px, rgba(110, 139, 173, 0.10), transparent 70%)", // 后台顶部主氛围光
    glowDarkSecondary: "radial-gradient(600px 300px at 85% 15%, rgba(207, 160, 76, 0.05), transparent 60%)", // 琥珀色副氛围光
    glowLight: "radial-gradient(1100px 380px at 50% -100px, rgba(44, 74, 110, 0.05), transparent 70%)",
    // Linear 式侧栏纵向渐变（更深更丰富）
    siderGrad: "linear-gradient(180deg, #161b24 0%, #121620 40%, #0e1218 100%)",
    // 毛玻璃顶栏底色
    headerGlass: "rgba(14, 18, 24, 0.82)",
    // Linear 式噪点：baseFrequency 0.65 + numOctaves 3 + saturate 0（去色）
    noise: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
    noiseOpacity: 0.045, // 噪点叠加透明度（Linear 标准 4%）
    // Linear 式渐变描边（顶部亮 → 底部暗，mask-composite 技法用）
    cardBorderGradient: "linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.04) 100%)",
    // Linear 式悬浮聚光灯（径向渐变，inset -40% 外延）
    hoverSpotlight: "radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0.035), transparent 90%)",
    dark: {
      hairline: "rgba(255, 255, 255, 0.07)",
      hairlineStrong: "rgba(255, 255, 255, 0.12)",
      hairlineHover: "rgba(255, 255, 255, 0.16)",
      cardBorderGradient: "linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.04) 100%)",
      hoverSpotlight: "radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0.035), transparent 90%)",
    },
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
  // ---------- v2.1 升级：字体三层 + 暗色光学修正 ----------
  font: {
    display: `"Noto Serif SC", "Source Serif 4", "Songti SC", serif`,
    body: `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`,
    mono: `"JetBrains Mono", "Cascadia Mono", Consolas, monospace`,
    // 暗色光学修正：亮文字在暗底上有"光渗"幻觉，视觉显重 → 字重降一档
    weightBodyDark: "350", // 暗色正文（亮色 400 → 暗色 350）
    weightHeadingDark: "500", // 暗色标题（亮色 600 → 暗色 500）
    // 字距修正：暗色微正字距抵消增重，标题负字距递进（Linear 风格）
    letterSpacingBodyDark: "0.01em",
    letterSpacingHeadingSm: "-0.01em",
    letterSpacingHeadingLg: "-0.015em",
  },
  // ---------- v2 扩展：圆角细则 ----------
  radiusTokens: { sm: 4, md: 6, lg: 10, full: 9999 },
} as const;

export type Tokens = typeof tokens;
