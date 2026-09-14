# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`db6a522`（P16 独立问答评测）；P16 合并后 Release 已通过，main CI run `34900600149` 正在收口。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P17 badcase 到需求再到回归闭环；P15/P16 均已合并。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P17 Badcase 闭环（2026-09-15，开发中）**：用户澄清只写 suggested intent，管理员确认才写 corrected intent；chat/feedback/intent 关联 trace；新增 assistant_badcases、regression case、修复前 baseline、Manager assistant_badcase 幂等需求与 BadcasePage。目标数据库/UI 回归已通过，待完整 qa、独立审查与 PR。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P18 起继续双知识空间、检索 API、自动执行队列、隔离执行器与资源面板。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单和自动执行合并仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。
