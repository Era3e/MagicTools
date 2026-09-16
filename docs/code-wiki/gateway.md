# Gateway

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 5. 网关 Gateway

- **路径**：[apps/gateway](../../apps/gateway)
- **端口**：3000（唯一对外入口）
- **技术**：Express 4 + http-proxy-middleware

### 5.1 核心函数

#### `createGateway(ports: PortsConfig, env?)` → Express App

文件：[app.ts](../../apps/gateway/src/app.ts)

**执行流程：**

1. **鉴权中间件**（[auth.ts](../../apps/gateway/src/auth.ts)，P06）：三通道并行——①`GATEWAY_TOKEN` 头 `X-Access-Token`（服务/脚本通道，兼容模式与 P04/P05 验证工具链）；②`GATEWAY_SERVICE_TOKENS`（服务身份细分，`服务名:token` 映射，放行全部应用并标记 `x-gateway-user: service:<name>`）；③用户会话 cookie（`GATEWAY_USERS` 配置时启用，HMAC-SHA256 签名、12h 滑动续期、HttpOnly+SameSite=Lax）。未登录浏览器请求 302 → `/login`；API 请求返回 401 JSON；`GATEWAY_USER_APPS` 限定普通用户可访问应用（越界 403，admin 与服务身份不受限）。`GATEWAY_USERS` 非空但缺 `GATEWAY_SESSION_SECRET` 时拒绝启动。登录防暴破：统一错误文案 + 500ms 延迟 + 5 次失败锁 5 分钟（内存计数）。未配置 GATEWAY_USERS 时行为与旧版完全一致
2. **路由生成**：调用 `buildRoutes(ports, host)` 从 ports.yaml 生成所有代理路由
3. **Web 尾斜杠补全**：精确匹配 `/<name>` 时 302 重定向到 `/<name>/`
4. **反向代理**：`createProxyMiddleware` 带 pathFilter，Web 走 `"/"+name` → web 容器 Vite/Nginx；API 走 `"/api/"+name` → NestJS server
5. **`GET /health`**：返回 `{ status:"up", service:"gateway" }`
6. **`GET /login` / `POST /login` / `POST /logout`**（auth.ts）：登录表单页（纯 HTML 无外部依赖）与登出；表单 body 由中间件内部解析（16KB 上限）
7. **`GET /` 首页**：生成卡片式应用导航页（APP_META 提供 8 应用标题+简介），替代纯反代的 Cannot GET /
8. **`GET /status` 状态页**：前端轮询 `/api/health` 展示服务健康与延迟；P26 起提供 Manager 资源面板与自动执行面板入口，资源事实仍以 Manager 数据库为准

#### `buildRoutes(ports, host)` → ProxyRoute[]

文件：[routes.ts](../../apps/gateway/src/routes.ts)

对 ports 中除 gateway 外的每个服务：
- 有 web 端口 → 生成 `{ name, path:"/<name>", target:"http://<host>:<webPort>" }`
- 有 server 端口 → 生成 `{ name, path:"/api/<name>", target:"http://<host>:<serverPort>" }`

`host(name)` 函数：env.MT_PROD === "1" 时返回 name（Docker Compose 服务名解析），否则返回 127.0.0.1（本地直连）。

### 5.2 路由表（示例）

| 网关路径 | 代理目标（本地） | 说明 |
|---|---|---|
| `/applicant/*` | http://127.0.0.1:4008/applicant/* | 求职 Web（Vite build + Nginx） |
| `/api/applicant/*` | http://127.0.0.1:5008/api/applicant/* | 求职 Server API |
| `/scholar/*` | http://127.0.0.1:4006/scholar/* | 知识 Web |
| ...（8 服务 × 2 共 16 条） | | |

---
