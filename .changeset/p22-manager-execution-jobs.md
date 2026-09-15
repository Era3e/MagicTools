---
---

Manager 新增自动执行任务 job/run 租约：owner 显式排队绑定批准修订，执行器独立 token 领取并获得一次性 run token；心跳与回写受租约保护，过期恢复按契约上限 retry/failed，同修订不能并发执行。
