// 平台子项目注册表：用于外壳的应用切换下拉。
// path 与 gateway 路由 basename 保持一致（/applicant、/scholar…）。
export interface AppEntry {
  key: string;
  label: string;
  path: string;
}

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
