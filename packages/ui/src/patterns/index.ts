/**
 * @mt/ui patterns — 通用页面模式库
 *
 * 设计原则：
 *   - 「前台各异、后台统一」架构的通用布局骨架，避免 8 应用各写各的卡片栅格/表格容器/详情头
 *   - 100% 使用 tokens 颜色/间距/字号/圆角，禁止硬编码色值（ESLint no-hardcoded-colors 校验通过）
 *   - 与 AntD 5 组件（Row/Col/Divider/Table 等）组合可直接用，不是替代 AntD，是约束其外层布局
 *
 * 用法（子项目 pages 内）：
 *   import { ControlTable, MagazineList, DetailHero } from "@mt/ui";
 */
export { MagazineList } from "./MagazineList";
export type { MagazineListProps } from "./MagazineList";
export { ControlTable } from "./ControlTable";
export type { ControlTableProps } from "./ControlTable";
export { DetailHero } from "./DetailHero";
export type { DetailHeroProps, DetailHeroMetaItem } from "./DetailHero";
export { TimelineBurndown } from "./TimelineBurndown";
export type { TimelineBurndownProps, BurndownRequirement, BurndownStatus } from "./TimelineBurndown";
