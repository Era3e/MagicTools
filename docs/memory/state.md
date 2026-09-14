# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`02fe8a7`（P14 Linux 视觉基线）；P14 合并后 Release 已通过，main CI 以 run `34882825502` 为最终验收。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P15 统一功能映射与文档事实源；CODE_WIKI 已拆分，功能/接口索引由 `pnpm docs:facts` 生成。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P16 独立问答评测（2026-09-15，开发中）**：新增 migration 006 的 48 条版本化种子（routing 36、knowledge 6、action 6；split dev 24、regression 16、holdout 8）、意图日志消息指纹隔离、持久 evaluation run/item、无秘密配置快照与同数据集版本比较；action 只解析不执行。评测指纹同时排除 few-shot、回放、JSONL 导出与微调就绪计数；run heartbeat 可把崩溃残留的 running 记录恢复为 failed。Assistant 真实数据库强制验证 43/43 零 skip（修复后待重跑），Web 目标测试 11/11 与构建通过；待完整 qa、独立 0 bug 审查和 PR CI。
- P15 完成前，接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P16 起继续问答评测、双知识空间、自动执行队列、隔离执行器与资源面板。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单和自动执行合并仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。
