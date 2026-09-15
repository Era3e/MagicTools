# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`a4aace1`（P20 已合并）。PR #91、Release `34997694613` 与 main CI `34997694616` 均成功；P21 以该 main 为开发基线。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P21 模型超时、取消、用量与调用记录；P01-P20 已完整闭环。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P21 模型调用观测（2026-09-16，开发中）**：模型请求超时/取消、重试逐次记录、流式真实 usage/unknown、7 服务 `model_calls` 迁移与 Assistant 链路上下文已实现；待完整 qa、独立 0 bug loop、PR quality/smoke/e2e 与合并后 Release/main CI。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P21 后继续 P22 自动任务领取/租约、P23 隔离执行器、P24 进度通知、P25 条件自动合并与 P26 资源面板。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单和自动执行合并仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。
