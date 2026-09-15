# Scholar 用户帮助与项目代码检索入口

## 目标

把 P18 的知识空间/发布快照和 P19 的公共混合检索接到真实内容与页面入口：普通用户能查询当前发布的 20 个核心任务，维护者能检索 20 个开发问题并追溯到代码入口、来源修订、需求证据和验收口径。

## 内容与同步

- 内容事实源是 `docs/knowledge/initial-bundle.json`，固定 `20 + 20` 条，stableId 唯一。
- 每条内容包含目标/问题、正文、项目、标签、来源修订、GitHub 来源 URL、P20 需求、验证方式和异常口径；无法确认历史动机时显式写“历史原因：未知”。
- `pnpm knowledge:sync --dry-run` 只做本地 schema 与来源路径校验。
- 正式同步通过 Scholar API，不直连数据库；重复执行按 `source + sourceRef` 幂等，未变化条目跳过，变化条目生成新修订。
- `--publish-product` 必须显式提供 `--version` 和 `--deployment-ref`；发布前确认 20 条 product 内容齐全。发布包含当前 product 空间条目，避免覆盖已有公共样板。
- 生产经 Gateway 访问时使用 `--token` 透传 `x-access-token`；脚本不伪造 `x-gateway-role`。

## 使用入口

- `/scholar/entries`：用户帮助目录，只读当前 public product 版本，展示版本、部署标识、任务内容、来源证据和需求链接。
- `/scholar/search`：公共混合检索，展示证据分块、命中通道、相关度、字符区间、版本和来源修订。
- `/scholar/admin/code-index`：管理员代码检索，只查询 development 空间，展示问题、代码入口、验收口径、来源修订和需求证据。

## 安全与隔离

- 管理列表/检索沿用 Scholar `AdminGuard`；未携带 Gateway 管理员身份返回 403。
- public list/detail/search 只读取当前发布的 product/public/published 快照，不接受调用方指定空间或版本。
- development 条目不能进入 public 返回；后台代码检索与用户帮助使用不同 API。

## 验证

- `infra/scripts/lib/knowledge-bundle.test.mjs`：20+20、stableId、来源路径、幂等跳过、发布缺部署标识拒绝、令牌透传/防身份伪造。
- `apps/scholar/server/src/knowledge-bundle.e2e.test.ts`：真实数据库导入 40 条、重复导入不新增、40 个固定标题逐条检索命中、public 不泄漏 development、未授权管理入口 403。
- `HelpPage.test.tsx`、`SearchPage.test.tsx`、`CodeIndexPage.test.tsx` 覆盖页面行为。
- `e2e/tests/knowledge-entrypoints.spec.ts` 在真实 17 服务环境中同步并发布内容，验证三个入口和检索结果。
