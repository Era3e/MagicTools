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

## P19 公共混合检索

- `entry_chunks` 以 `(revision_id, chunk_no)` 唯一，保存证据文本、`char_start/char_end` 和 1024 维向量；新修订创建时同步分块。
- 迁移前存量修订只回填文本与字符区间，分块向量为 NULL，避免复制文档级向量导致所有分块相似度相同；这些内容仍可通过 FTS 命中，后续编辑/重发布会生成真实分块向量。
- `POST /api/scholar/public/search` 服务端固定当前 public product 发布版本，不能由调用方指定空间或版本。
- FTS 与向量分块按 `(revision_id, chunk_no)` 合并，再按 entry 保留最高分证据；双通道命中加权，向量-only 低于 0.15 被拒绝。
- 返回候选编号、命中通道、entry/revision/version/deploymentRef、需求链接、chunk 字符区间与证据文本；发布后编辑不影响该快照。

## P20 用户帮助与代码检索

- `docs/knowledge/initial-bundle.json` 固定 20 条 product 用户任务和 20 条 development 开发问题；每条绑定 stableId、来源修订、GitHub 证据、P20 需求和验收口径，历史动机不可靠时显式记录“历史原因：未知”。
- `pnpm knowledge:sync` 通过 Scholar API 幂等导入或更新内容；重复执行不重建未变化条目。`--publish-product` 必须同时提供版本与部署标识，并先确认 20 条 product 内容齐全；生产访问令牌通过 `--token` 以 `x-access-token` 透传，脚本不能伪造 `x-gateway-role`。
- 管理列表与 FTS/向量检索支持 `spaceKey=development|product`，结果携带来源修订、来源 URL 和需求证据；未授权管理检索返回 403。
- 前台 `/entries` 是只读用户帮助目录，`/search` 调公共混合检索并展示证据分块、版本、来源和需求链接；后台 `/admin/code-index` 检索 development 问题，不进入任何 public API。

## 前端路由

```
前台（UserShell /scholar）：
  /search          SearchPage   帮助检索（当前发布版本的公共混合检索证据）
  /entries         HelpPage     用户帮助目录（当前发布任务）
  /graph           GraphPage    知识图谱（类目卡片墙 + 图书馆配色）

后台（AdminShell /scholar/admin）：
  /admin/entries   EntryList    后台条目管理（含「编辑」五项字段 Modal）
  /admin/settings  SettingsPage 知识库设置
  /admin/code-index CodeIndexPage 项目代码检索（development 空间）
```

---
