# MagicTools 代码 Wiki 入口

> 本文件只保留模块索引和维护规则，避免单文件继续膨胀。模块文档位于 `docs/code-wiki/`；功能与接口事实索引由脚本生成。

## 事实源规则

1. 模块结构与实现说明：修改 `docs/code-wiki/<module>.md`；
2. 功能映射与覆盖状态：修改 `docs/superpowers/coverage-matrix.md`；
3. 页面路由或服务接口变更：运行 `pnpm docs:facts`，提交 `docs/generated/` 的三份生成文档；
4. 历史设计动机：修改 `docs/superpowers/specs/` 对应历史基线；
5. 当前状态与待办：修改 `docs/memory/state.md`；已完成复盘写入 `docs/memory/history.md`。

生成守卫会对比源码、coverage-matrix 和生成文档。只改代码不刷新生成物时，`pnpm test:infra` 会失败。

## 平台与公共能力

- [项目与架构总览](code-wiki/overview.md)
- [公共包参考](code-wiki/packages.md)
- [Gateway](code-wiki/gateway.md)
- [服务间通信与事件契约](code-wiki/communication.md)
- [前端体系](code-wiki/frontend.md)
- [后端与数据库体系](code-wiki/backend.md)
- [LLM 智能层](code-wiki/llm.md)
- [工程化与运行](code-wiki/engineering.md)
- [依赖关系全景](code-wiki/dependencies.md)
- [决策记录与交接](code-wiki/decisions.md)

## 业务模块

- [Applicant](code-wiki/applicant.md)
- [Investigator](code-wiki/investigator.md)
- [Assessor](code-wiki/assessor.md)
- [Manager](code-wiki/manager.md)
- [Gatherer](code-wiki/gatherer.md)
- [Scholar](code-wiki/scholar.md)
- [Assistant](code-wiki/assistant.md)
- [Designer](code-wiki/designer.md)

## 自动生成索引

- [功能索引](generated/feature-map.md)
- [覆盖视图](generated/coverage-view.md)
- [接口索引](generated/interface-index.md)
- [依赖图索引](generated/dependency-index.md)
