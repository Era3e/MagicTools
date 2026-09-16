# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`e997e20`（P24 已通过 PR #97 合并）。PR CI quality/smoke/e2e 成功，PR quality artifact 绑定 candidate `f93bab0`、tree `3e75397` 且数据库 42 文件 204/204 零跳过；Release `35038620842` 成功；合并后 main CI `35038620831` 以最终回执为准。P25 以该 main 为开发基线。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P25 低风险条件自动合并已完成实现与本地完整验证；P01-P24 已合并。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P25 条件自动合并（2026-09-16，待 PR/CI）**：Manager 独立 merge token 授权接口与独立条件合并 CLI 已实现；本地完整 qa `70c4ef9bd4748f9483babb60` 通过，7/7 阶段、基础设施 385/385、数据库 42 文件 205/205 零跳过。待 PR quality/smoke/e2e、quality artifact 独立核验、合并后 Release/main CI。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P25 后继续 P26 资源面板。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单和生产条件合并凭证仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。P25 live GitHub 合并保持 not-run。
