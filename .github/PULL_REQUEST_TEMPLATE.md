## 变更说明

<!-- 简述本次变更内容与动机。涉及 MVP 延期功能时请关联 docs/memory/mvp-deferred.md 对应 ID。 -->

## 关联与追踪

- 关联功能点（请更新 coverage-matrix 对应行）：`docs/superpowers/coverage-matrix.md` → __行号 / 功能 ID__
- 若为 MVP 延期兑现 / 功能裁剪：`docs/memory/mvp-deferred.md` → __ID__

## 自检清单

- [ ] 已更新相关文档（spec / plan / 集成文档）
- [ ] 已追加更新 **docs/memory/state.md**（当前状态 / 关键决策 / 进行中 任一项变更即需更新，禁止事后补记）
- [ ] 已添加 changeset 迭代日志（如为用户可见变更）
- [ ] **0 bug loop 验收记录**：测试智能体独立验收链接（Issue / 讨论 / 截图 / 录屏，附在描述中），或说明为何单人自验即可通过
- [ ] 功能-代码追踪矩阵 `coverage-matrix.md` 已更新对应行的「实现文件 / 状态 / E2E 覆盖」
- [ ] CI 全绿：lint / build / unit / smoke / e2e（含视觉快照如涉及 UI 变更）
- [ ] 无 TODO / TBD 占位符（AGENTS.md 硬性约定）
- [ ] 遵循 Conventional Commits（中文 subject，动词开头 ≤50 字）与 `feat-<项目>-<任务ID>-<描述>` 分支命名

## UI 变更专项（前端/视觉变更必勾选）

- [ ] **视觉快照基线已更新**（若改动前台/后台壳/颜色/字体/布局）：执行 `pnpm e2e:visual:update` 并把 `e2e/snapshots/**` 新快照纳入本 PR
- [ ] 全页无横向滚动（1280 / 1440 / 1920 三档窗口分别确认）
- [ ] 所有可点击元素存在 **hover 态 + active 态** 两种视觉反馈（按钮/链接/卡片/切换 Tab 等）
- [ ] 文字未溢出容器；截断处有省略号（长标题/长摘要/表格长单元格等）
- [ ] 空态 / 加载态 / 错误态 三态均不为白屏，使用 MtEmptyState 或统一骨架屏
- [ ] 颜色 100% 来自 tokens.color / UserShellTheme 六字段，业务代码无硬编码色值（ESLint no-hardcoded-colors 无 error）

## 测试说明

<!-- 说明新增/修改的测试用例与验证方式；E2E 点击操作需附：副作用断言类型（URL / Modal / 列表变化 / API 请求发出）。 -->
