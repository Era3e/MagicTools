# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`9ee0234`（P19 已合并）；PR #89 的 Release `34944290180` 已通过。首次 main CI `34944290212` 因 Assessor 测试 teardown 竞态失败，修复 PR #90 正在等待 CI；P20 以 P19 最终 head `0f9432b` 为开发基线。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P20 用户帮助与项目代码检索入口；P19 已合并，main CI 测试稳定性修复 PR #90 收口中。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P20 用户帮助与代码检索（2026-09-15，开发中）**：40 条版本化内容、幂等同步、product 显式发布、用户帮助目录、公共混合检索入口和 development 代码检索入口已实现；待 P19 合并后统一完整 qa、独立审查、17 服务 smoke 与 PR。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P20 起继续帮助内容入口、自动执行队列、隔离执行器与资源面板。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单和自动执行合并仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。
