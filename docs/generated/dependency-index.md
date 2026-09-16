# MagicTools 依赖图索引

> 自动生成文件：请运行 `pnpm graph:json`，不要手工编辑。
> 来自 dependency-cruiser 对 apps 与 packages 的 TS/TSX import 扫描；完整 graph JSON 只写入 .qa/code-graph/。

## 总览

| 指标 | 数量 |
|---|---:|
| 源码模块 | 514 |
| Graph 节点 | 561 |
| 依赖边 | 1693 |
| Workspace 模块 | 23 |
| 模块级依赖边 | 38 |

守卫规则：no-circular、packages-no-apps、apps-isolated、no-production-to-test。

## Workspace 模块依赖

| 来源模块 | 依赖模块 |
|---|---|
| apps/applicant/server | packages/config |
| apps/applicant/server | packages/db |
| apps/applicant/server | packages/model-client |
| apps/applicant/web | packages/ui |
| apps/assessor/server | packages/config |
| apps/assessor/server | packages/db |
| apps/assessor/server | packages/model-client |
| apps/assessor/server | packages/utils |
| apps/assessor/web | packages/ui |
| apps/assistant/server | packages/config |
| apps/assistant/server | packages/db |
| apps/assistant/server | packages/model-client |
| apps/assistant/web | packages/ui |
| apps/designer/server | packages/config |
| apps/designer/server | packages/db |
| apps/designer/server | packages/model-client |
| apps/designer/web | packages/ui |
| apps/gateway | packages/config |
| apps/gatherer/server | packages/config |
| apps/gatherer/server | packages/db |
| apps/gatherer/server | packages/model-client |
| apps/gatherer/server | packages/utils |
| apps/gatherer/web | packages/ui |
| apps/investigator/server | packages/config |
| apps/investigator/server | packages/db |
| apps/investigator/server | packages/model-client |
| apps/investigator/server | packages/utils |
| apps/investigator/web | packages/ui |
| apps/manager/server | packages/config |
| apps/manager/server | packages/db |
| apps/manager/server | packages/types |
| apps/manager/server | packages/utils |
| apps/manager/web | packages/ui |
| apps/scholar/server | packages/config |
| apps/scholar/server | packages/db |
| apps/scholar/server | packages/model-client |
| apps/scholar/web | packages/ui |
| packages/db | packages/types |
