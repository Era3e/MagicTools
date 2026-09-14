# Assessor 模块

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 6.3 Assessor（评审·需求主线第二环）

**端口**：Web 4003 / Server 5003
**主题**：BRIEF_THEME（文书风 — Georgia / 暖白 / 深赭）
**前台形态**：仅报头展示，默认直跳后台

## 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 评审 | RequestController | RequestService | RequestRepo | 跨库消费 investigator → 批次聚合幂等入库 → GitHub 仓库上下文（README/目录树）→ LLM 分析+设计 → 五状态审核 → 推送 Manager |

**外部集成**：`github/client.ts` — README/目录/语言与按提交文件读取；目录或提交清单截断、变更超过200文件时显式失败，GITHUB_STUB=1 桩

**仓库证据反向整理**：`repository-evidence.service.ts` 按提交筛选 routes/controller/service/schema/tests，读取提交下源码内容并生成行级证据候选；`motivation=unknown` 明确标识不可靠推断，任务按 repo+SHA 幂等。

**消费事件**：`researcher.response.push`（跨库连接 INVESTIGATOR_DATABASE_URL，processOutbox 轮询）
**推送事件**：`requirement.created`（payload: analysisMd/designMd/repoUrl/reviewComment）

## 前端路由

```
前台（直跳后台）
后台（AdminShell /assessor/admin）：
  /admin/requests      RequestList   评审请求列表
  /admin/requests/:id  RequestDetail 分析+设计+审核+推送 Manager（D1 收件箱说明）
```

---
