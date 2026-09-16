# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`774d227`（P23 已通过 PR #96 合并）。PR CI 三段成功，Release `35031525272` 与合并后 main CI `35031525200` 均成功；P24 以该 main 为开发基线。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P24 执行进度、待验收与通知开发；P01-P23 已完整闭环。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P24 执行进度与通知（2026-09-16，开发中）**：成功回写结构化校验、待验收推进、PR/部署分离、稳定 outbox 通知、webhook 租约投递和详情页证据面板已实现；Manager DB 55/55、db outbox 10/10、Manager Web 32/32 和全仓构建通过。待完整 qa、独立 0 bug loop、PR quality/smoke/e2e 与合并后 Release/main CI。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P24 后继续 P25 条件自动合并与 P26 资源面板。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单和自动执行合并仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。
