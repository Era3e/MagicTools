# 网关用户登录与服务权限（P06）

P06 在网关提供浏览器可用的用户登录，并把服务间调用身份与用户身份分离。此前网关只支持单一共享 `GATEWAY_TOKEN` 头认证，浏览器地址栏访问无法携带该头；[恢复部署说明](restored-deployment.md)中的浏览器验收依赖外部反向代理附加头。P06 之后，配置用户清单即可让浏览器正常登录使用平台。

## 配置

所有变量均放私有 env（生产部署由部署器引用注入，不入公开配置）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `GATEWAY_USERS` | 启用登录时必填 | `用户名:scrypt$盐$hex[:admin]`，逗号分隔多用户。生成哈希：`node -e "const c=require('crypto');c.scrypt('口令','盐',32,(e,d)=>console.log('scrypt$盐$'+d.toString('hex')))"` |
| `GATEWAY_SESSION_SECRET` | `GATEWAY_USERS` 非空时必填 | 会话签名密钥；缺失时网关拒绝启动 |
| `GATEWAY_USER_APPS` | 可选 | `用户名:app1,app2;用户2:app3`（分号分隔用户条目）；未列出的用户默认可访问全部应用 |
| `GATEWAY_SERVICE_TOKENS` | 可选 | `服务名:token` 逗号分隔；服务身份放行全部应用 |
| `GATEWAY_TOKEN` | 可选 | 保留的共享服务/脚本通道；未配置 GATEWAY_USERS 时行为与旧版一致 |
| `GATEWAY_ASSISTANT_SERVICE_TOKEN` | 可选 | assistant 调用网关专用令牌，缺省回落 GATEWAY_TOKEN |

## 行为

1. **认证通道（按序判定）**：`X-Access-Token` 匹配 GATEWAY_TOKEN 或 SERVICE_TOKENS → 服务身份放行；否则校验会话 cookie。两者皆无：浏览器 HTML 请求 302 到 `/login`，API（`/api/*` 或非 HTML Accept）返回 401 JSON。
2. **登录**：`GET/POST /login` 表单（用户名+口令）。失败统一文案「用户名或口令不正确」（防用户枚举）+ 500ms 固定延迟；每用户 5 次失败锁定 5 分钟（内存计数，进程重启清零）。
3. **会话**：HMAC-SHA256 签名 cookie（HttpOnly、SameSite=Lax、Path=/），12 小时有效，剩余不足 1/3 时滑动续期。篡改 cookie（改用户名/过期时间/签名）验证失败。
4. **应用授权**：会话用户访问 `/<app>/*` 或 `/api/<app>/*` 时，按 `GATEWAY_USER_APPS` 校验；未授权应用返回 403。`admin` 角色与服务身份不受限。
5. **身份透传**：认证通过后网关向下游设置 `x-gateway-user` 头（用户名 / `service` / `service:<name>`），下游服务可选使用。
6. **兼容**：未配置 `GATEWAY_USERS` 时与旧版行为完全一致（仅 GATEWAY_TOKEN 检查或全放行）——本地开发、CI、P04/P05 部署验证工具链零影响。

## 边界

- 单用户凭证清单不是多租户体系；无密码找回、MFA、组织层级。
- 锁定计数与会话均存内存，网关重启即清空（重启可作为解锁手段）。
- 生产启用登录由运维配置 env 完成，本仓库不自动启用；`/login` 页面在未配置 GATEWAY_USERS 时不生效（POST 直接跳回首页）。
- 服务身份细分当前仅 assistant 接入（action/trouble 网关调用）；其余服务仍可经 GATEWAY_TOKEN 共享通道，后续批次按需迁移。

## 验证

- 单元：`apps/gateway/src/users.test.ts`（11）、`session.test.ts`（7）、`auth.test.ts`（11）——解析/签名/验签/篡改/锁定/通道并行/应用授权。
- E2E：`e2e/tests/gateway-auth.spec.ts`（4）——独立 3999 认证实例真实浏览器登录/登出/错误文案/401。
- assistant 回归：action/trouble 测试含服务 token 优先级断言。
