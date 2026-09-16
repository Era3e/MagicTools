# 资源、密钥引用与运行面板

P26 在 Manager 增加轻量资源台账，并在 Gateway 状态页提供运行入口。它解决三个问题：资源是谁的、每月花多少钱、备份和故障手册在哪里；密钥只登记引用位置，不保存明文；真实检查里“阻塞”和“等待”分别计数，不能用 failed/skipped 混在一起。

## 数据模型

迁移 `015_resources.sql` 增加三张表：

- `operations_resources`：资源名、类型、环境、归属、供应商、地域、月预算、备份定位、处理手册和备注；
- `operations_secret_refs`：资源关联的密钥名、来源和引用位置，例如 `file:/etc/magictools/backup/private.key`，没有 value 字段；
- `operations_resource_checks`：检查名、结果、原因、证据链接和检查时间；结果只能是 `passed/failed/blocked/waiting`。

查询时每个资源按检查名取最新一次结果。状态优先级为 `blocked > failed > waiting > operational`；没有检查时是 `unknown`。汇总分别统计资源状态和四类检查结果，blocked 与 waiting 不会合并。

## API 与权限

| 方法 | 路径 | 说明 | 凭证 |
|---|---|---|---|
| GET | `/api/manager/resources` | 返回资源、密钥引用、最新检查和汇总 | Gateway 访问控制 |
| POST | `/api/manager/resources` | 登记资源与密钥引用 | `x-manager-approval-token` |
| POST | `/api/manager/resources/:id/checks` | 写入一次真实检查结果 | `x-manager-approval-token` |

写入 schema 是 strict 的：出现 `value`、`secret` 之类额外字段会拒绝。密钥引用必须以 `env:`、`file:` 或 `external:` 开头，只允许引用路径/名称字符，且前缀必须与来源字段一致，例如 `source=env` 只能写 `env:NAME`。非通过结果必须填写可行动原因，避免只丢一个红色状态却没有下一步。每次写入检查会递增资源 `revision`，方便调用方发现旧面板数据。

## 页面

Manager 后台新增「资源面板」：

- 顶部展示资源数、月预算、阻塞检查、等待检查和密钥引用数；
- 资源表展示归属、环境、预算、备份定位、状态、四类检查计数、密钥引用和处理手册链接；
- 登记表单只接受密钥引用名、来源和引用位置，审批凭证仅用于本次请求，不落库。

Gateway `/status` 新增「资源与运行入口」，可直达资源面板和需求自动执行面板。资源状态和检查结果仍以 Manager 数据库为准，Gateway 不复制第二份状态。

## 使用边界

登记资源不等于资源已验证。`unknown` 表示还没有检查；`blocked` 表示真实检查因缺少凭证、主机或配置无法执行；`waiting` 表示外部资源或人工动作尚未就绪；两者都是明确状态，不计为跳过。处理手册必须使用 HTTPS 链接，告警处理人可以从资源行直接打开。

本批不读取 Kubernetes、云厂商账单或秘密管理系统，也不把生产密钥值带回应用。预算和备份定位先作为人工维护的事实源；后续可以在同一模型上增加只读同步器。
