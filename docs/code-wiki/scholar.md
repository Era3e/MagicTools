# Scholar 模块

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 6.6 Scholar（知识·知识主线第二环）

**端口**：Web 4006 / Server 5006
**主题**：LIBRARY_THEME（图书馆风 — Palatino / 羊皮纸绿）

## 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 收件箱 | InboxController | InboxService | SearchRepo | 跨库消费 gatherer → 收件箱 → 审核入库 |
| 条目 | EntryController | EntryService | SearchRepo | 三来源 CRUD（gatherer/manual/obsidian）/ 分类 / 标签 / **圈定**（Assistant 可见）|
| 检索 | — | SearchService | SearchRepo | 双通道：pg_trgm 全文 + pgvector 向量（embedding-2 1024 维，桩模式 bigram 哈希伪向量）|
| 图谱 | GraphController | GraphService | GraphRepo | LLM 实体关系抽取 → 图谱节点/边存储 + 查询 + 重建 |
| Obsidian | ObsidianController | ObsidianService | — | Vault 目录扫描 → 条目同步（路径去重） |
| 设置 | — | — | SettingsRepo | 向量模型配置等 |

**消费事件**：`knowledge.item.collected`（GATHERER_DATABASE_URL processOutbox）

## 前端路由

```
前台（UserShell /scholar）：
  /search          SearchPage   书目检索（图书馆目录卡片 + 双通道切换）
  /entries         EntryList    馆藏目录（书卷列表 + 书签式圈定）
  /graph           GraphPage    知识图谱（类目卡片墙 + 图书馆配色）
  /settings        SettingsPage Obsidian Vault 路径 / 分类标签管理

后台（AdminShell /scholar/admin）：
  /admin/entries   EntryList    后台条目管理（含「编辑」五项字段 Modal）
```

---
