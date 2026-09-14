# 功能映射与接口事实索引

## 定位

coverage-matrix 继续作为人工维护的功能映射源；`docs/code-wiki/` 提供模块实现说明；`docs/generated/` 提供机器生成的事实索引。三者互相校验，避免旧设计、当前状态和发布待办混在一个长文档里。

## 使用方式

修改以下内容后运行 `pnpm docs:facts`：

- `docs/superpowers/coverage-matrix.md` 的功能行；
- 任一 `apps/*/web/src/App.tsx` 页面路由；
- 任一 `apps/*/server/src/*.controller.ts` 服务接口；
- `apps/gateway/src/app.ts` 字面路由、`routes.ts`/`infra/ports.yaml` 动态代理，以及 `auth.ts` 登录/登出入口。

命令会重算并写入：

- `docs/generated/feature-map.md`：按模块列出功能、状态、代码定位与测试证据；
- `docs/generated/coverage-view.md`：状态统计、模块统计和接口规模；
- `docs/generated/interface-index.md`：Gateway 路由、页面路由与服务 API 清单；业务服务 API 按网关外部前缀写作 `/api/<app>/...`。

`pnpm test:infra` 会重新计算但不写入。生成文件缺失、内容过期、模块文档缺失或历史设计缺少基线标识时，检查失败。

PR CI 会通过 GitHub Pull Request Files API 读取变更文件并执行文档影响证据检查：Gateway 字面路由、动态代理、登录/登出入口、前端路由或 Controller 变更必须伴随接口索引/模块文档；Service、Repo、迁移或公共包 `src` 行为变更必须伴随 coverage-matrix、模块文档或功能文档。仅测试文件变更不强制文档证据。

## 查询路径

1. 先查功能索引，确认功能 ID 与状态；
2. 再查接口索引，确认用户入口或服务 API 是否存在；
3. 打开模块文档理解实现边界；
4. 最后进入源码和测试核对最新行为。

历史设计文档保留迭代动机，不作为当前能力证明；生产启用状态仍以部署回执、运行证据和外部配置为准。
