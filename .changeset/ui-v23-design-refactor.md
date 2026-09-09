---
"@mt/ui": minor
---

v2.3 设计稿全量重构：UserShell 报头式外壳（us-*）/AdminShell 控制台外壳（as-* 琥珀激活条）/AdminToolbar 工具栏模式/APP_ACCENT_TOKENS 八应用 accent 三件套；8 应用后台页 AdminPageHead+KPI+工具栏+直铺表格版式全量铺开；5 前台页按设计稿重构（岗位墙特稿式/书库书脊目录/对话双栏/驾驶舱 KPI/画廊委托单）；gateway 落地页编辑部目录构图；ChatPage 重试恢复流、gatherer FailLab 自动暂停演示、assessor BatchLab 批量部分成功演示落地；多端适配收尾：双壳与 5 前台页补 640-960px 折叠断点（KPI 两列折叠/表格内滚动/泳道横滚/会话栏条带化），UserShell 移动端 max-width 修复，assistant 页面 stash 冲突双功能合并（重试演示+双查询核验共存），e2e 锚点与文案断言同步校准。v2.3.1 质量基建：responsive.spec 375/768 溢出巡检（32 用例）+ 双壳 960 表格横滚断点；apps.ts 外壳文案入库（frontEyebrow/subtitle/controlEyebrow）单源化 + gateway drift guard 用例；turbo test ^build 依赖 + 8 web vitest alias 直连 @mt/ui src；.githooks/pre-commit 冲突标记与 dist 陈旧守卫；视觉基线 PAGES 抽 fixtures 共享 + 锚点 fail fast + waitFor/settleMs 时序机制
