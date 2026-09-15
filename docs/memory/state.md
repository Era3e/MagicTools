# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`6f1b9d2`（P18 知识空间与版本证据）；P18 合并后 Release `34923384858` 与 main CI `34923384808` 均已通过。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P19 统一 Scholar 检索 API 与证据筛选；P15–P18 均已合并。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P19 检索与证据链（2026-09-15，开发中）**：Scholar 修订级分块、公共混合检索、相关性门槛与发布快照隔离已实现；Assistant 经 Gateway 调公共 API 并做候选编号引用对齐，已移除 Scholar DB 直连。待完整 qa、独立审查与 PR。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P20 起继续帮助内容入口、自动执行队列、隔离执行器与资源面板。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单和自动执行合并仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。
