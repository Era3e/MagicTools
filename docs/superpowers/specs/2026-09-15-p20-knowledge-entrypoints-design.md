# P20：发布用户帮助与项目代码检索入口设计

> 设计状态：当前设计基线。实施前必须基于 P19 合并后的 main 重新校验路径、接口与视觉基线。

## 目标

把 P18/P19 已具备的知识空间、发布快照与混合检索能力接到真实内容和页面入口：普通用户能检索 20 个核心任务的当前发布帮助，维护者能在后台检索 20 个高频开发问题并追溯到代码入口、来源修订和需求证据。

## 内容事实源

- 新增 `docs/knowledge/initial-bundle.json`，固定 20 条 product 用户任务与 20 条 development 开发问题。
- 每条内容有稳定 `stableId`、项目、正文、验证口径、来源修订、来源 URL 和 P20 需求链接。
- 历史动机没有可靠证据时显式记录“历史原因：未知”，不得从当前代码反推。
- 新增 `pnpm knowledge:sync`：按 `sourceRef` 幂等导入/更新；product 发布必须显式绑定 `deploymentRef`，不得在服务启动时静默导入或发布。

## 服务契约

- `POST /api/scholar/entries` 支持受控 `sourceRef`；同一 `source + sourceRef` 重复导入不新增条目，内容变化生成新修订。
- 管理端列表/检索支持 `spaceKey=development`，并继续由 `AdminGuard` 保护；未授权访问代码检索返回 403。
- 用户帮助只走既有 public version/list/detail/search API；development 内容不得进入任何 public 返回。

## 页面入口

- Scholar 前台 `/entries` 改为用户帮助目录，只读取当前发布版本；`/search` 改为公共帮助检索并展示证据分块、版本与需求链接。
- 后台新增 `/admin/code-index`，检索 development 问题，展示代码入口、来源修订、验证口径和需求链接。
- 同步设计 HTML、导航文案、画布注册和 `design:check` 映射。

## 验收

1. Bundle 校验：product 20/20、development 20/20、stableId 唯一、来源路径存在、未知历史显式保留。
2. 同步幂等：重复执行不新增条目；正文变化生成新修订；product 重发布包含全部当前 product 条目。
3. 检索验收：40 个固定问题/任务逐条命中预期 stableId；public 检索不能返回 development 内容。
4. 权限验收：未授权访问代码检索 403；用户帮助入口不出现新增、编辑、圈定等管理动作。
5. 页面验收：帮助目录、帮助检索和代码检索有组件测试与真实浏览器 E2E。
6. 完整质量：`docs:facts` 无 diff、`design:check` 通过、完整 `qa:gate`、17 服务 smoke、PR quality/smoke/e2e 全绿。
