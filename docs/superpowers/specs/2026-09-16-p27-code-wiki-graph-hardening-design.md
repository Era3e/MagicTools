# P27 Code Wiki 与依赖图加固设计（当前设计基线）

## 目标

把 P26 后的代码知识体系从“人工模块文档 + 接口事实索引”加固为三层：

1. 人工解释层：`docs/code-wiki/` 继续解释模块边界、实现方式和维护入口；
2. 事实守卫层：生成索引、coverage 路径、Markdown 相对链接和关键快照一起进入基础设施测试；
3. 依赖图层：用 dependency-cruiser 建立 TS/TSX import 图，守卫循环依赖、公共包反向依赖应用和应用间直接源码依赖。

## 范围

- 修复当前 code wiki 的坏链接和已确认陈旧事实；
- `docs-guard` 增加仓库内 Markdown 相对链接存在性检查；
- 引入 dependency-cruiser 配置与 `graph:check`、`graph:json` 命令；
- 拆除审计发现的 4 个源码循环依赖；
- 生成 `docs/generated/dependency-index.md`，只沉淀模块级摘要，不提交完整大图；
- 将 graph 检查并入 `test:infra`，从而进入 `qa:gate` 与 CI。

## 非目标

- 不引入数据库式 code intelligence 或在线图谱服务；
- 不生成全量符号级调用图；
- 不用 import 图替代 Gateway、outbox、跨库连接和外部系统集成文档；
- 不把完整 graph JSON 提交到 Git，避免每次源码移动造成大量无解释漂移。

## 设计

### 链接守卫

`docs-guard.mjs` 扫描 `docs/**/*.md` 的 Markdown 链接，忽略外部 URL、纯锚点和 mailto；仓库内链接按源文件目录解析并做 URI 解码，目标文件或目录不存在即失败。该检查与 coverage 路径检查一起由 `test:infra` 调用。

### 依赖图规则

使用 dependency-cruiser 解析 `apps` 与 `packages`：

- `no-circular`：禁止源码循环依赖；
- `packages-no-apps`：公共包不得引用应用源码；
- `apps-isolated`：应用之间不得直接引用源码，跨应用协作必须经 Gateway REST、outbox 或明确的公共包；
- `no-production-to-test`：生产源码不得引用测试文件。

规则输出使用 error 级别；完整 JSON 仅写入 `.qa/code-graph/dependency-graph.json`，该目录不入 Git。

### 循环拆除

- Designer：把 `PropValue` 抽到共享类型模块，registry 不再引用 schema；
- Investigator：把 cron 校验抽到独立模块，service 不再依赖 scheduler；
- Manager：把需求状态类型抽到共享类型模块，policy 不再引用 repo；
- UI：把前台主题类型与默认主题抽到独立模块，theme 与 UserShell 单向依赖它。

### 生成索引

`docs/generated/dependency-index.md` 记录扫描范围、源码文件数、模块级 workspace 依赖和当前规则结果。生成脚本复用 dependency-cruiser JSON，不手写统计，避免第二事实源。

## 验证

- `node --test infra/scripts/lib/docs-guard.test.mjs` 覆盖链接提取、跳过规则和坏链接报告；
- `node --test infra/scripts/lib/code-graph.test.mjs` 覆盖模块摘要与规则配置事实；
- `pnpm graph:check` 在当前源码上通过；
- `pnpm test:infra` 通过；
- 完整 `pnpm qa:gate` 通过；
- PR quality/smoke/e2e 通过后合并，并核对合并后 main CI。
