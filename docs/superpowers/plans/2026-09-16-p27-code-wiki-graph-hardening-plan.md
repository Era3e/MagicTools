# P27 Code Wiki 与依赖图加固实施计划

## 任务清单

1. **文档事实修复**
   - 修复 `docs/code-wiki` 中指向 `features/`、`validation/` 的相对链接；
   - 同步 Assistant 迁移数量、UI v2 token、Gateway 三通道认证、Scholar/Assistant Gateway 通信、E2E spec 数量和设计文档数量；
   - Applicant/Gatherer 模块文档的路由明细改为以接口索引为准。

2. **Markdown 链接守卫（TDD）**
   - 先为 `checkMarkdownLinks` 增加失败测试；
   - 实现链接提取、外部链接跳过、URI 解码和存在性校验；
   - 把真实 docs 扫描并入 `docs-guard` CLI。

3. **依赖图门禁（TDD）**
   - 添加 dependency-cruiser 开发依赖与规则配置；
   - 添加 `graph:check`、`graph:json` 和生成索引脚本；
   - 先用规则复现既有循环，再拆循环至全绿；
   - 将 graph 检查挂入 `test:infra`。

4. **循环依赖拆除**
   - 新增 Designer `canvas/types.ts`；
   - 新增 Investigator `cron.ts`；
   - 新增 Manager `requirement-types.ts`；
   - 新增 UI `theme-types.ts`；
   - 保持外部导出兼容，更新相关测试。

5. **沉淀与验收**
   - 更新 `docs/CODE_WIKI.md`、`docs/code-wiki/dependencies.md`、coverage-matrix、state、changeset 和 CHANGELOG；
   - 运行目标测试、`pnpm docs:lint`、`pnpm docs:facts`、`pnpm graph:check`、`pnpm test:infra`、完整 `pnpm qa:gate`；
   - 独立测试智能体复审后推送 PR，等待 quality/smoke/e2e 全绿并合并；
   - 合并后核对 main CI 与 Release，再清理 worktree。
