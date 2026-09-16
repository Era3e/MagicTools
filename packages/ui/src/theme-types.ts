export interface UserShellTheme {
  primary: string;
  background: string;
  ink: string;
  muted: string;
  displayFont: string;
  bodyFont: string;
  /** 各应用可选扩展色板键（按项目约定自行填入页面需要的面板/分割线/纸底色等） */
  [key: string]: string;
}

/** v2.3 报头式默认主题：墨蓝 accent + 平台亮色底（设计稿 us-* 亮色锚点） */
export const MAGAZINE_THEME: UserShellTheme = {
  primary: "#2c4a6e",
  background: "#f4f6f8",
  ink: "#1c2530",
  muted: "#5f6c7c",
  displayFont: `"Noto Serif SC", "Source Serif 4", "Songti SC", serif`,
  bodyFont: `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`,
  accent: "#2c4a6e",
  tint: "#e3eaf2",
  panel: "#ffffff",
  rule: "#d9dde3",
  card: "#ffffff",
  border: "#d9dde3",
};
