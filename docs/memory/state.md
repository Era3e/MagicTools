# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`80d4c80`（P22 已合并）。PR #95、Release `35022579711` 与 main CI `35022579740` 均成功；P23 以该 main 为开发基线。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P23 隔离编码执行器开发；P01-P22 已完整闭环。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P23 隔离编码执行器（2026-09-16，开发中）**：executor CLI、环境白名单、隔离 HOME/Git 配置、候选 SHA 独立验收、进程树超时、证据包、PR 发布编排与 claim 需求上下文已实现；核心 infra 测试 10/10 通过。待目标 Manager 测试、完整 qa、独立 0 bug loop、PR quality/smoke/e2e 与合并后 Release/main CI。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P23 后继续 P24 进度通知、P25 条件自动合并与 P26 资源面板。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单和自动执行合并仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。
