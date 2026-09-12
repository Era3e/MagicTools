---
---

网关新增用户会话登录与服务身份细分：GATEWAY_USERS 登录（scrypt 口令 + 签名 cookie + 防暴破）、GATEWAY_USER_APPS 应用级授权、GATEWAY_SERVICE_TOKENS 服务通道；未配置用户时行为与旧版一致。仅涉及私有网关应用，不提升公共包版本。
