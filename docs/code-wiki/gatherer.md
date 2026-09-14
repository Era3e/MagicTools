# Gatherer 模块

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 6.5 Gatherer（采集·知识主线第一环）

**端口**：Web 4001 / Server 5001
**主题**：PRESS_THEME（报刊风 — Impact 报头 / 藏青）
**前台形态**：仅报头展示，默认直跳后台

## 后端模块

| 层 | Controller | Service | 职责 |
|---|---|---|---|
| 健康 | HealthController | — | — |
| 信息源 | SourceController | SourceService + CollectService | 三类源配置（RSS/JSON/网页选择器）、试采、Cron 调度（node-cron）、管道：解析→去重→LLM富化→入库、自动/手动推送 Scholar、运行回执与死信查询 |

**采集管道**：`feed/parser.ts` — RSS（rss-parser）/ JSON / 网页（cheerio 选择器）解析 → contentFingerprint 去重 → LLM 富化（提取标题/摘要/正文/分类/关键词）

**推送事件**：`knowledge.item.collected`

**运行回执**：`GET /api/gatherer/meta/scheduler-status` 返回当前进程实际注册状态和最近 run 终态/计数；`GET /api/gatherer/meta/dead-letters` 返回 `gatherer.collect.dead_letter` 事件。自动推送使用 `gatherer-item-push-<itemId>` 稳定事件 ID，重复推送不追加事件。

## 前端路由

```
前台（直跳后台）
后台（AdminShell /gatherer/admin）：
  /admin/sources         SourceList  信息源列表（含「编辑」列 Modal、自动推送开关、调度实况与死信追踪）
  /admin/sources/:id     SourceDetail  条目查看 + 推送 Scholar（D1 提示收件箱）
  /admin/items           ItemList    采集条目列表
```

---
