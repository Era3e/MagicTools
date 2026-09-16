# MagicTools 当前状态

> 本文件只保留仍然影响当前判断的事实、待办和边界。已完成迭代复盘见 [history.md](history.md)。

## 当前基线

- 远端 main 快照：`38ce001`（P25 已通过 PR #98 合并）。PR CI quality/smoke/e2e 成功，PR quality artifact 绑定 candidate `cc5dcc4`、tree `adf7673` 且数据库 42 文件 205/205 零跳过；Release `35042984789` 成功；合并后 main CI `35042984731` 以最终回执为准。P26 以该 main 内容为开发基线。
- 质量口径：目标测试、完整 `qa:gate`、17 服务 smoke、独立 0 bug loop、PR quality/smoke/e2e、合并后 Release 与 main CI 四段。
- 当前执行：P26 资源、密钥引用与运行面板开发中；P01-P25 已合并。

## 当前事实源

- 功能映射与覆盖状态：`docs/superpowers/coverage-matrix.md`；
- 功能与接口生成索引：`docs/generated/`；
- 模块实现文档：`docs/code-wiki/`；
- 设计基线：`docs/superpowers/specs/`（已交付为历史基线，执行中可短暂标记当前基线）；
- 历史复盘：`docs/memory/history.md`。

## 待办与边界

- **P26 资源面板（2026-09-16，开发中）**：Manager 资源/密钥引用/检查模型、后台资源页和 Gateway 运行入口已实现；密钥引用前缀与来源强一致，写入检查递增资源修订。待目标测试复跑、真实数据库验证、完整 qa、PR quality/smoke/e2e、quality artifact 独立核验、合并后 Release/main CI。
- 接口/路由变更必须重复运行 `pnpm docs:facts` 并确认无 diff。
- P25 合并后 main CI 四段与 main quality artifact 仍需最终核验。
- 生产独立备份机、真实外部模型效果、生产 HTTPS/用户清单、生产条件合并凭证和云/秘密管理系统只读同步仍需真实外部配置；不得以桩模式或开发验收冒充生产已启用。P25 live GitHub 合并与 P26 生产资源同步保持 not-run；P26 资源面板不保存任何秘密明文。
