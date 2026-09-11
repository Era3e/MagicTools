# 状态解释

本项目采用Manager业务状态，不假定GitHub已经配置通用的needs-triage、ready-for-agent等标签。当前生命周期的合法迁移以 `apps/manager/server/src/requirement-policy.ts` 为准，字段校验以schemas与repo事务为准。

待处理、可开发、内容已批准、自动执行资格与产品已验收是不同事实。不得仅因需求处于todo或内容被批准就启动后台执行。自动任务领取、预算及安全门禁由P08/P22等后续实现定义；诊断时记录实际发现及关联需求，不额外创造一套状态。
