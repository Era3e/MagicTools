---
"@mt/ui": minor
"@mt/applicant-web": minor
"@mt/scholar-web": minor
"@mt/manager-web": minor
"@mt/assistant-web": minor
"@mt/designer-web": patch
---

质量治理三角闭环：
- E2E 强化：8 应用 e2e 用例加副作用断言（URL 跳转 / Modal 开关 / 列表增改 / 接口请求拦截 URL+method），新增 16 页视觉快照基线 `_visual.spec.ts`（视口截图 + 动态列表区 mask，与并发写库解耦）；`pnpm e2e:visual:update` / `pnpm e2e:visual` 脚本。
- E2E 可信度治理：本地启动脚本 `infra/scripts/start-services.mjs` 桩环境对齐 CI（FEED_STUB/FEISHU_STUB/GITHUB_STUB/CYBERCLOUD_STUB 等）；修正 12 处测试契约失配（AntD 双字按钮字间空格、onOk 页脚确定、路由/字段名、disabled 竞态、waitForResponse 完成事件、并发 [0] 位置断言）；guard-skip 静默跳过全部改为显式 `test.skip`，暴露 2 个导航入口缺失（mvp-deferred D-16/D-17）；全量 51 passed / 2 skipped / 0 failed。
- 文档追溯：新增 `docs/superpowers/coverage-matrix.md`（规格-代码-测试三维追踪矩阵）与 `docs/memory/mvp-deferred.md`（MVP 明确推迟项、原因、重启触发条件），区分「未实现」与「不做」。
- UI 规范工程化：`@mt/ui` 新增三种页面模式 MagazineList / ControlTable / DetailHero、`ThemeContext` + `useTheme` 钩子；自定义 ESLint 规则 `@mt/rules/no-hardcoded-colors` 禁业务页硬编码色值（豁免 tokens.ts、应用顶层 *_THEME、AdminShell/UserShell 专用键）；manager/scholar/applicant/assistant/designer 共 11 前台页迁移 `useTheme()` 取色；PR 模板新增 UI Checklist 与 0 bug loop 验收表格；AGENTS.md 新增硬性约定 8（E2E 校准纪律）。
- 配套修复：MtEmptyState 扩展 description 属性，兼容 patterns 类型。
