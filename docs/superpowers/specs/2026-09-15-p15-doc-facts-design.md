# P15 统一功能映射与文档事实源设计

> 设计状态：当前设计基线。实现过程中若范围变化，先修订本文件再继续。
## 1. 问题

当前 `docs/CODE_WIKI.md` 是 94KB 单文件，既承担总览、模块实现、接口、运行与历史决策，又被 PR 模板当作唯一核对入口。`docs/memory/state.md` 同时保存当前状态和大量已完成迭代复盘，读者难以区分“现在是什么”和“当时发生了什么”。coverage-matrix 已是人工维护的功能映射，但没有机器可读索引，也没有接口变更后的文档证据守卫。

## 2. 目标与边界

- 目标：
  1. CODE_WIKI 拆为模块文档，入口只保留索引和维护规则；
  2. state.md 只保留当前事实、待办和边界，历史复盘移入 history.md；
  3. coverage-matrix 保持唯一人工功能映射源，自动生成功能索引、覆盖统计和接口索引；
  4. 接口、路由或映射变化必须运行 `pnpm docs:facts` 刷新生成文档，`test:infra` 检测漂移；PR CI 另按变更文件检查接口/功能文档影响证据；
  5. specs 目录明确“历史设计基线”，防止旧设计被误读为当前状态。
- 边界：
  1. 不在本批实现自然语言问答或 Manager 数据库承载；
  2. 不把所有历史设计重写为当前事实，只加历史标识和索引；
  3. 不以文档生成替代代码测试；生成物是文档影响证据。

## 3. 事实源模型

- `docs/superpowers/coverage-matrix.md`：人工维护功能映射，每行包含功能、实现、状态与测试；
- `docs/code-wiki/*.md`：模块当前实现文档，入口为 `docs/CODE_WIKI.md`；
- `docs/generated/feature-map.md`：按模块生成的功能索引；
- `docs/generated/coverage-view.md`：状态、文档与测试覆盖视图；
- `docs/generated/interface-index.md`：从 Gateway 字面路由/动态代理/登录登出入口、App.tsx 路由和 Nest Controller 装饰器生成的接口索引；
- `infra/scripts/lib/docs-facts.mjs`：唯一解析与生成逻辑，输出必须可重复。

## 4. 守卫

`pnpm docs:facts` 重新生成三份文档；`infra/scripts/lib/docs-facts.test.mjs` 使用真实仓库执行：

1. coverage 表必须能解析出模块、功能 ID、状态、实现路径与测试描述；
2. 每个业务应用必须有模块文档和页面路由记录；
3. Nest Controller 与前端 Route 变化会改变接口索引；
4. 生成文件与当前源码重算结果必须完全一致；
5. specs 目录所有历史设计必须带“历史设计基线”标识。

PR 事件通过 GitHub Pull Request Files API 读取变更文件后执行 `docs-facts.mjs --impact-files`：Gateway 字面路由、动态代理、登录登出入口、Controller 或前端路由变更必须伴随接口索引/模块文档；Service、Repo、迁移或公共包 `src` 行为变更必须伴随 coverage-matrix、模块文档或功能文档。仅测试文件变更不强制文档证据。

## 5. 验收

1. `pnpm docs:facts` 成功且重复执行无 diff；
2. `node --test infra/scripts/lib/docs-facts.test.mjs` 通过；
3. `pnpm test:infra` 通过；
4. `pnpm docs:lint` 通过；
5. `pnpm qa:gate` 通过；
6. 人工核对模块拆分无内容丢失，state.md 无已完成长复盘，生成索引能从功能定位代码、测试和文档。
