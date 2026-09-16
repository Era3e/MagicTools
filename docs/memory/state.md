# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`d4ac35e`。P26 已合入，P27 以该内容为开发基线；PR/CI 合并回执以最终核验为准。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P27 Code Wiki 与依赖图加固开发中；P01-P26 已合并。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P27 Code Wiki 与依赖图加固（2026-09-16，本地验收通过）**：已修复 16 个 Code Wiki 坏链接和已确认陈旧事实；docs-guard 支持 Markdown 相对链接、代码块、reference、HTML 与完整 destination 语法；dependency-cruiser 覆盖 apps/packages、拆除 4 个循环依赖，生成防漂移依赖索引，`graph:check` 并入 test:infra/qa:gate。目标测试、独立 0 bug loop（最终 PASS）与完整 qa 全绿，quality evidence 为 `.qa/quality/1aecb33164c39b9e5efd6a28/quality.json`。待 PR quality/smoke/e2e、quality artifact 独立核验、合并后 Release/main CI。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P25 合并后 main CI 四段与 main quality artifact 仍需最终核验。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单、生产条件合并凭证和云/秘密管理系统只读同步仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。P25 live GitHub 合并与 P26 生产资源同步保持 not-run；P26 资源面板不保存任何秘密明文。
