---
"@mt/db": minor
---

Manager 执行成功现在推进待验收并保存 PR/部署分离状态，执行终态通知使用稳定 outbox ID 事务写入，webhook 按租约投递并去重；db outbox 支持按事件名过滤消费。
