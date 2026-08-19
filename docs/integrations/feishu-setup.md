# 飞书开放平台接入手册（Investigator 用）

> 适用：Investigator 的「飞书问卷 → 多维表格 → 结构化分析」链路与表单分发。
> 官方文档：https://open.feishu.cn/document

## 一、MVP 采用的对接方式

1. **收集**：用飞书自带「问卷/表单」收集调研数据，问卷关联存储到「多维表格」（用户在飞书内自助操作，无需 API）；
2. **读取**：Investigator 通过**多维表格（Bitable）API** 拉取数据做 LLM 结构化；
3. **分发**：用**群自定义机器人 webhook** 把问卷链接分发到群（最简单路径，无需应用消息权限）；后续如需应用机器人主动私聊分发，再升级为应用机器人 + im:message 权限。

## 二、创建企业自建应用（一次性）

1. 用飞书账号登录开放平台：https://open.feishu.cn → 进入「开发者后台」
2. **创建应用 → 企业自建应用**（个人版后台同样支持自建应用）
3. 填写应用名称（建议 magictools-investigator）、描述、图标 → 创建
4. 应用详情页「**凭证与基础信息**」中拿到：
   - **App ID**（公开）
   - **App Secret**（点「查看」需验证身份，**严禁入库/外泄**）
5. 把两个值写入本机加密配置（.env，不入库；CI 用 GitHub Secrets）：

~~~ini
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_BOT_WEBHOOK=
~~~

## 三、添加权限（按需最小化）

应用详情页 →「**权限管理**」→ 搜索并按需开通：

| 权限 | 说明 | 是否 MVP 必需 |
|---|---|---|
| bitable:app:readonly | 读取多维表格（app 元信息 + 记录） | ✅ 必需 |
| bitable:app | 读写多维表格（后续回写结构化结果时再加） | 延后 |
| im:message / im:message:send_as_bot | 应用机器人发消息（走应用机器人路径才需要） | 延后 |
| docs:drive:readonly 等 | 云文档读取 | 暂不需要 |

> 权限添加后**必须发布新版本才生效**（见下节），否则调用 API 报 99991663 / 99991672 权限错误。

## 四、发布版本（最容易被漏掉的一步）

1. 应用详情页 →「**应用发布**」→「**创建版本**」
2. 填写版本号（如 1.0.0）与更新说明 → 保存
3. **申请发布** → 企业管理员在「管理后台」审核通过（个人自建企业通常自己即管理员，登录管理后台确认即可）

## 五、把多维表格授权给应用

自建应用访问多维表格前，必须显式授权：

1. 打开目标多维表格 → 右上角「...」→「更多」→「**添加文档应用**」
2. 搜索并添加刚创建的应用（magictools-investigator）
3. 确认后应用即可通过 API 读取该表格

## 六、拿到多维表格的 app_token 与 table_id

- 多维表格 URL 形如 https://xxx.feishu.cn/base/BascXXXX?table=tblXXXX
- base/ 后的字符串 = **app_token**；table= 后的字符串 = **table_id**
- 这两个值在 Investigator 的「调研主题配置」里维护（存数据库，非敏感）

## 七、调用链路（开发参考）

**第 1 步：获取 tenant_access_token**（有效期约 2 小时，必须缓存并提前刷新）：

~~~text
POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
{ "app_id": "...", "app_secret": "..." }
→ { "code": 0, "tenant_access_token": "t-xxx", "expire": 7200 }
~~~

**第 2 步：读表格记录**（先列 tables 再拉 records，官方 API 文档）：

- 列表格：GET /open-apis/bitable/v1/apps/{app_token}/tables
- 拉记录：GET /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records?page_size=100（注意分页 page_token）

## 八、群自定义机器人 webhook（表单分发）

1. 打开目标飞书群 → 群设置 →「**群机器人**」→「**添加机器人**」→「**自定义机器人**」
2. 命名（如 magictools-investigator）→ 完成 → 复制 **webhook 地址**（https://open.feishu.cn/open-apis/bot/v2/hook/xxx）
3. 「安全设置」**建议勾选签名校验**：记下密钥（存 .env 的 FEISHU_BOT_SECRET），发消息时用 timestamp 加换行加 secret 拼接后做 HMAC-SHA256 生成 sign
4. 发送文本消息：

~~~text
POST <webhook>
{ "timestamp": "...", "sign": "...", "msg_type": "text", "content": { "text": "问卷链接: ..." } }
~~~

> 若只发到自己的群做提醒，可暂时不配签名（webhook 地址本身即机密，勿泄露/入库）。

## 九、常见报错速查

| 报错 | 含义 | 处理 |
|---|---|---|
| 99991663 / 99991672 | 权限未生效 | 权限已添加但**未发布版本**（见第四节） |
| 1254043 等无权访问 | 应用未被授权访问该文档 | 见第五节「添加文档应用」 |
| 99991668 / token 过期 | tenant_access_token 过期 | 按 7200s 缓存并提前刷新 |
| 频率限制 99991400 | 触发 API 限流 | 拉取加缓存与退避重试（设计文档已要求） |

## 十、验收清单

- [ ] 应用创建完成，App ID/Secret 已入本机加密配置与 GitHub Secrets
- [ ] bitable:app:readonly 权限已添加**且新版本已发布**
- [ ] 目标多维表格已「添加文档应用」
- [ ] 群自定义机器人 webhook 可发消息（curl 测试收到群消息）
- [ ] curl 调 tenant_access_token 接口返回 code:0
