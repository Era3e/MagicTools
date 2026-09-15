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
| 条目 | EntryController | EntryService | EntryRepo | 三来源 CRUD（gatherer/manual/obsidian）/ 分类 / 标签 / **圈定**（Assistant 可见）；创建与内容编辑写入不可变修订 |
| 知识空间 | KnowledgeSpaceController | KnowledgeSpaceService | KnowledgeSpaceRepo | development/product 空间、成员、产品版本、发布记录、需求链接与公共帮助入口 |
| 检索 | — | SearchService | SearchRepo | 双通道：pg_trgm 全文 + pgvector 向量（embedding-2 1024 维，桩模式 bigram 哈希伪向量）；公共检索固定当前发布产品版本 |
| 图谱 | GraphController | GraphService | GraphRepo | LLM 实体关系抽取 → 图谱节点/边存储 + 查询 + 重建 |
| Obsidian | ObsidianController | ObsidianService | — | Vault 目录扫描 → 条目同步（路径去重） |
| 设置 | — | — | SettingsRepo | 向量模型配置等 |

**消费事件**：`knowledge.item.collected`（GATHERER_DATABASE_URL processOutbox）

## 知识空间与发布

- 存量 `entries` 迁移后进入私有 `development` 空间；产品内容写入 `product` 空间。
- 每次创建/编辑生成 `entry_revisions`，修订保存内容、标签、来源修订、来源 URL、需求链接和 1024 维向量。
- `product_versions` 必须 binding 来源修订；发布事务将条目当前修订、产品版本和部署标识写入 `entry_publications`。
- 未变化条目可在后续产品版本复用同一内容修订。
- 公共 API 只读取 product/public/published/current version 的发布修订；后续编辑生成新修订但不改变已发布快照与召回向量。
- 成员撤权按 Gateway 透传身份即时生效；下架/删除会移除发布记录、图谱关联并清空当前向量。
- 旧条目、图谱、Obsidian、收件箱与空间管理接口默认要求 Gateway 管理员；空间成员可读取被授权空间的条目，产品版本详情仅管理员可见。

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
