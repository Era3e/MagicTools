# P20 实施计划

基线：P19 合并后的远端 main。工作区：`work/mt-p20`，分支 `feat-scholar-P20-knowledge-entrypoints`。

| 任务 | 内容 | 验证 |
|---|---|---|
| T1 内容包 | 引入 40 条 initial bundle 与 schema 校验 | infra 测试：20+20、ID 唯一、路径存在 |
| T2 服务契约 | `sourceRef` 导入、development 过滤、代码检索证据字段 | Scholar DB 测试 + 未授权 403 |
| T3 同步脚本 | dry-run、幂等导入/更新、product 显式发布 | 脚本单测 + 真实 API smoke |
| T4 用户入口 | `/entries` 帮助目录、`/search` 公共混合检索 | Web 组件测试 + E2E |
| T5 开发入口 | `/admin/code-index` 代码检索与证据链接 | Web 组件测试 + E2E |
| T6 文档视觉 | spec/plan、code-wiki、coverage、generated、CHANGELOG、state、changeset、设计映射 | docs/design/qa 门禁 |
| T7 独立闭环 | 独立 0 bug review、完整 qa、17 服务 smoke、PR CI | 全绿后合并并跟踪 Release/main CI |

## 边界

- 不在本需求内实现来源自动定时更新；只提供可重复执行、可审计的同步入口。
- 不修改 P19 混合检索排序算法，只消费既有 public search 契约。
- 不用静态前端假数据替代 Scholar 当前发布版本。
