# Investigator 模块

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 6.2 Investigator（调研·需求主线第一环）

**端口**：Web 4002 / Server 5002
**主题**：ARCHIVE_THEME（档案风 — Courier / 牛皮纸 / 铜金）
**前台形态**：仅报头展示，默认直跳后台

## 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 调研 | SurveyController | SurveyService | SurveyRepo + ResponseRepo | 飞书 Bitable 源配置/字段映射、定时/手动拉取、LLM 结构化、筛选推送 Assessor |

**外部集成**：`feishu/client.ts` — 令牌缓存 + 分页 + 归一化读取多维表格记录，支持 FEISHU_STUB=1 桩

**推送事件**：`researcher.response.push`（appendOutbox 单条记录一封）

## 前端路由

```
前台（直跳后台）
后台（AdminShell /investigator/admin）：
  /admin/surveys       SurveyList    调研主题列表（含「编辑」列）
  /admin/surveys/:id   SurveyDetail  结果查看 + 推送 Assessor（操作闭环 D1）
```

---
