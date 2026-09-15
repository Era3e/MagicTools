# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`98ac360`（P17 badcase 闭环）；P17 合并后 Release `34910722374` 与 main CI `34910722341` 均已通过。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P18 开发/产品知识空间与版本证据；P15–P17 均已合并。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P18 知识空间（2026-09-15，开发中）**：新增 development/product 空间、成员、不可变内容修订、产品版本发布、部署标识、需求链接与公共 API；公共查询在 SQL 层固定 product/public/published/current version，发布后编辑不改变线上快照。Scholar 真实数据库 21/21 已通过，待完整 qa、独立审查与 PR。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P19 起继续统一 Scholar 检索 API、帮助内容入口、自动执行队列、隔离执行器与资源面板。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单和自动执行合并仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。
