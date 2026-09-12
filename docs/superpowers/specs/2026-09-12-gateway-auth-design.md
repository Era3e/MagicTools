# P06：生产用户登录与服务权限

本方案承接用户已批准的 P01–P26 持续落地范围，前序批次（#69/#70/#71/#72/#74）均已合并 main（当前 761152b）。P06 需求源于 [恢复部署说明](../../features/restored-deployment.md) 第 5 节与 [运行镜像说明](../../features/runtime-images.md)：当前网关要求每个请求携带 `x-access-token`，普通浏览器地址栏访问不会自动附加该头，页面和静态资源返回 401；生产用户登录及服务权限由 P06 补齐。

## 现状与问题

1. `apps/gateway/src/app.ts` 使用单一共享 `GATEWAY_TOKEN` 静态令牌：未配置则全放行；配置后所有请求须携带 `x-access-token` 头，浏览器原生访问无法满足。
2. `apps/assistant/server/src/action.service.ts`、`trouble.service.ts` 以同一 GATEWAY_TOKEN 通过网关调用 manager/gatherer 等服务，服务身份与用户身份混用。
3. 生产 Compose（infra/compose.prod.yml）与 P04/P05 验证工具链（container-health.cjs、validate-deployment.mjs、validate-recovery-deployment.mjs）依赖 GATEWAY_TOKEN 注入探针请求，改造不得破坏该链路。

## 选择与边界

1. **登录方案**：网关内置轻量用户会话层，不引入第三方 IdP。用户清单与口令哈希来自私有 env 文件（`GATEWAY_USERS` 格式 `user1:hash,user2:hash:admin`，hash 为 `scrypt$盐$hex` 格式的 scrypt 加盐哈希），会话使用签名 cookie（HMAC-SHA256，含用户名、角色、过期时间），默认 12 小时过期。网关登录页 `/login`（纯 HTML 表单，无外部依赖），未登录浏览器请求重定向至登录页，API 请求返回 401 JSON。
2. **兼容模式**：`GATEWAY_TOKEN` 保留为服务/脚本通道（与用户会话通道并行）：配置时持有正确 token 的请求视为服务身份直接放行；未配置 GATEWAY_USERS 时行为与现状完全一致（全放行），保证本地开发、CI 与 P04/P05 工具链零破坏。
3. **角色与应用授权**：`GATEWAY_USERS` 支持可选角色字段（`user:hash:admin`），admin 可访问全部应用；普通用户经 `GATEWAY_USER_APPS`（格式 `user1:applicant,scholar;user2:manager`，分号分隔用户条目）限定可访问应用列表，未列出的应用路径返回 403。默认（未配置 USER_APPS）所有用户可访问全部应用，保持简单部署可用。
4. **服务身份细分**：新增 `GATEWAY_SERVICE_TOKENS`（格式 `assistant:token-a,manager:token-b`）供服务间调用；assistant 的 action/trouble 服务优先使用 `GATEWAY_ASSISTANT_SERVICE_TOKEN`，其次回落 GATEWAY_TOKEN。网关侧校验服务 token 时视为对应服务身份，放行全部应用（服务身份不受 USER_APPS 限制）。
5. **会话安全**：cookie HttpOnly + SameSite=Lax；登录失败统一错误文案防用户枚举；固定 500ms 人工延迟抗暴破（每用户 5 次失败锁 5 分钟，计数存内存）；会话签名密钥 `GATEWAY_SESSION_SECRET` 未配置且 GATEWAY_USERS 已配置时拒绝启动。
6. **边界**：不做密码找回、多因素、组织/团队层级；不改各业务应用内部 API（网关层授权已覆盖入口）；不自动启用生产用户——模板与文档提供配置项，生产启用由运维操作；部署工具（deploy-release/deploy-ssh）无需变更（env 引用机制已支持新变量注入）。

## 命令与模块

- `GET /login`：登录表单页（HTML，复用网关既有版式风格）。
- `POST /login`：校验用户名+口令，成功 Set-Cookie 会话并重定向 `/`；失败重渲染表单+统一错误。
- `POST /logout`：清除会话 cookie，重定向 `/login`。
- `users.ts`（新模块）：解析 GATEWAY_USERS/GATEWAY_USER_APPS，scrypt 校验口令，登录失败锁定。
- `session.ts`（新模块）：会话 cookie 签名/验签/过期/续期（滑动窗口，剩余<1/3 时长时刷新）。
- `auth.ts`（中间件）：请求分类（HTML→登录重定向 / API→401 JSON），token 通道与会话通道并行校验，应用级 403。
- `app.ts` 改造：auth 中间件替换现有 token 检查；`/login`、`/logout` 路由；代理请求携带用户身份头（`x-gateway-user`）透传至下游服务（下游可选择性使用）。
- `apps/assistant/server` 微调：action.service/trouble.service 读取 `GATEWAY_ASSISTANT_SERVICE_TOKEN` 回落 GATEWAY_TOKEN。
- `.env.production.template` 与 `docs/features/runtime-images.md`、`deployment-receipts.md` 补充新变量说明。

## 验收（RED→GREEN）

1. 未配置 GATEWAY_USERS 时行为与现状一致（token 检查逻辑保留，既有测试全绿）。
2. 配置 GATEWAY_USERS 后：浏览器 GET / → 重定向 /login；正确登录 → 会话 cookie → 放行；错误口令 → 统一错误+计数；5 次失败锁 5 分钟。
3. 会话过期/篡改 cookie → 401/重定向登录；登出后 cookie 失效。
4. GATEWAY_USER_APPS 限定用户访问未授权应用 → 403；admin 与服务 token 不受限。
5. GATEWAY_TOKEN 并行通道：CI smoke / P04/P05 验证工具既有用例不回归。
6. assistant 服务调用使用服务 token；服务 token 缺失时回落行为与现状一致。
7. e2e：网关登录流程真实浏览器用例（登录→访问应用→登出→401 重定向）。
8. 独立测试智能体验收：会话伪造（改用户名/过期时间/签名）、锁定绕过、HTML/API 分类正确性、USER_APPS 越权。

## 实施顺序

1. users/session 纯函数模块 TDD（解析/签名/验签/锁定）。
2. auth 中间件与 app.ts 接线（既有 gateway 测试更新+新增分类用例）。
3. 登录页/登出路由 + HTML 版式。
4. assistant 服务 token 回落微调。
5. e2e 用例 + 文档（features 说明 + env 模板 + CODE_WIKI + coverage + CHANGELOG + memory + changeset）。
6. 独立测试智能体验收 → PR（勾选门禁）→ CI 三段 → 合并。
