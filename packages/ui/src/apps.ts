// 平台子项目注册表：用于外壳的应用切换下拉与前台 accent 派生。
// path 与 gateway 路由 basename 保持一致（/applicant、/scholar…）。
// accent 三件套口径：ui-spec §三 v2 派生（.design_library colors_and_type.css v2.2）。
export interface AppEntry {
  key: string;
  label: string;
  path: string;
}

/**
 * 八应用前台 accent 派生令牌（ui-spec §三 v2 派生口径）。
 * - accent：应用主强调色（导航激活/卡片顶边/聚焦环）
 * - tint：accent 的浅底（选中面/胶囊底）
 * - ink：accent 的深字（tint 底上的文字/标题 hover 提亮）
 * - monoKey / controlKey：报头 eyebrow 与后台侧栏的 mono 短名
 * - frontEyebrow / subtitle / controlEyebrow：外壳文案唯一来源（防双源漂移——
 *   v2.3 曾出现 App.tsx 手写副本与页面 Hero 重复渲染），App.tsx 应从 appAccent() 取用而非手写
 */
export interface AppAccentTokens {
  accent: string;
  tint: string;
  ink: string;
  monoKey: string;
  controlKey: string;
  /** 前台报头 eyebrow（mono 小字，如 GATHERER · 采集工坊） */
  frontEyebrow: string;
  /** 前台副标题（页面 Hero 已承载同文案的应用留空，避免双显） */
  subtitle?: string;
  /** 后台侧栏 eyebrow（如 GATHERER · CONTROL，缺省取 controlKey） */
  controlEyebrow?: string;
}

/** 唯一定义点（no-hardcoded-colors 豁免：顶层 *TOKENS 色板常量） */
export const APP_ACCENT_TOKENS: Record<string, AppAccentTokens> = {
  applicant: { accent: "#a8522e", tint: "#f7ece6", ink: "#6f3013", monoKey: "APPLICANT", controlKey: "APPLICANT · CONTROL", frontEyebrow: "APPLICANT · 求职工坊" },
  scholar: { accent: "#2f5a3b", tint: "#ecf2ea", ink: "#1f3d27", monoKey: "SCHOLAR", controlKey: "SCHOLAR · CONTROL", frontEyebrow: "SCHOLAR · 学者书库", subtitle: "每一则知识，皆入馆藏" },
  assistant: { accent: "#4a688c", tint: "#edf1f6", ink: "#2c4a6e", monoKey: "ASSISTANT", controlKey: "ASSISTANT · CONTROL", frontEyebrow: "ASSISTANT · 智能助手", subtitle: "有问题，就直接问" },
  manager: { accent: "#3a5f84", tint: "#e9eef4", ink: "#233c5a", monoKey: "MANAGER", controlKey: "MANAGER · CONTROL", frontEyebrow: "MANAGER · WORKSPACE" },
  gatherer: { accent: "#1f3a5c", tint: "#e8ecf2", ink: "#12233b", monoKey: "GATHERER", controlKey: "GATHERER · CONTROL", frontEyebrow: "GATHERER · 采集工坊", subtitle: "网络世界的消息，由本报为你搜集" },
  investigator: { accent: "#8a6a3b", tint: "#f5efe4", ink: "#5c4423", monoKey: "INVESTIGATOR", controlKey: "INVESTIGATOR · CONTROL", frontEyebrow: "INVESTIGATOR · 调研工坊", subtitle: "每一次寻访，都立卷归档" },
  assessor: { accent: "#6e3b28", tint: "#f2e9e4", ink: "#4a2418", monoKey: "ASSESSOR", controlKey: "ASSESSOR · CONTROL", frontEyebrow: "ASSESSOR · 评审工坊", subtitle: "每一份方案，都经三读而定" },
  designer: { accent: "#1c2530", tint: "#eef0f3", ink: "#0d141c", monoKey: "DESIGNER", controlKey: "DESIGNER · CONTROL", frontEyebrow: "DESIGNER · 组件工坊", subtitle: "描述你的想象，取走你的组件" },
};

export const APPS: AppEntry[] = [
  { key: "applicant", label: "求职", path: "/applicant" },
  { key: "investigator", label: "调研", path: "/investigator" },
  { key: "assessor", label: "评审", path: "/assessor" },
  { key: "manager", label: "管理", path: "/manager" },
  { key: "gatherer", label: "采集", path: "/gatherer" },
  { key: "scholar", label: "知识", path: "/scholar" },
  { key: "assistant", label: "助手", path: "/assistant" },
  { key: "designer", label: "设计", path: "/designer" },
];

/** 取应用 accent 三件套（未知 key 回退墨蓝主色） */
export function appAccent(key: string): AppAccentTokens {
  return APP_ACCENT_TOKENS[key] ?? APP_ACCENT_TOKENS.assistant;
}
