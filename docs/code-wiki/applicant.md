# Applicant 模块

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 6.1 Applicant（求职·独立闭环试点）

**端口**：Web 4008 / Server 5008
**主题**：MAGAZINE_THEME（杂志风 — 衬线、暖纸 #f8f5ef、砖红 #b4532a）

## 后端模块（AppModule）

| 层 | Controller | Service | Repo | 核心职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | /health 探活 |
| 岗位 | PositionController | PositionService | PositionRepo | CRUD / JD 文本解析 / 截图视觉识别 / 投递话术生成 |
| 面试 | InterviewController | InterviewService | InterviewRepo | 记录 / LLM 分析（问题清单+改进建议+行动项）/ Markdown 导出 |
| 简历 | ResumeController | ResumeService | ResumeRepo | ClawCV analyze/rewrite/match + 无 Key 降级为 LLM |

**外部集成**：`clawcv/` 子目录 — client.ts（HTTP 调用 API）+ fallback.ts（API 失败或无 Key 时 LLM 替代）

**关键路由**：
- `POST /api/applicant/positions` — 创建岗位（含 JD parse）
- `POST /api/applicant/positions/upload-image` — 截图上传 → 视觉 LLM 提取 JD
- `POST /api/applicant/positions/:id/interviews` — 添加面试记录 + LLM 复盘（status=scheduled 计划面试免填 qaNotes）
- `GET /api/applicant/interviews` — 跨岗位面试列表（JOIN positions 取 company/title/status，D-15）
- `PATCH /api/applicant/interviews/:id` — 计划面试改期 / 标记完成（D-15）
- `POST /api/applicant/resumes/analyze` / `rewrite` / `match` — 简历三件套

## 前端路由

```
前台（UserShell /applicant）：
  /positions           PositionWall    岗位博览墙（杂志风检索+分页）
  /positions/:id       PositionDetail  机会档案（FEATURE 特稿版式）
  /positions/:id/interviews InterviewPage  面试复盘（DEBRIEF 对开双栏）
  /calendar             CalendarPage   投递日历（D-15：D-day 时间轴+月历+待跟进）
  /resumes             ResumeCenter    简历工坊（WORKSHOP 改写台）

后台（AdminShell /applicant/admin）：
  /admin/positions     PositionList    岗位管理表格（CRUD）
```

---
