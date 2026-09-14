# 项目上下文入口

这是八个业务应用、Gateway和公共包组成的monorepo。领域与技术上下文入口为 `docs/CODE_WIKI.md`，模块实现位于 `docs/code-wiki/`，功能与接口事实索引位于 `docs/generated/`；历史设计位于 `docs/superpowers/specs/`，实施计划位于 `docs/superpowers/plans/`，不假定另有CONTEXT.md或ADR目录。

每次任务先读AGENTS和docs/memory，再读涉及应用的模块文档、生成索引与功能说明。历史spec只提供当时动机，不把其中规划当作当前能力。设计意图与当前实现分开核验：代码、迁移、当前配置和真实运行结果建立实现事实；需求/PR/CI各自在对应系统核实。文档覆盖关系见 `docs/superpowers/coverage-matrix.md`，阶段验证见 `docs/validation/`。
