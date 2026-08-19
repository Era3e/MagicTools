# Scholar（学者）子系统设计（MVP）

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-19
- 状态：✅ 已确认（2026-08-19 用户确认 S1~S4 四项默认值）
- 上游：docs/superpowers/specs/2026-08-18-magictools-platform-design.md（5.6 节）；Gatherer 事件契约 knowledge.item.collected

## 1. 定位

知识库系统（知识主线第二棒，Phase 2 收官）：三来源汇聚知识条目（Gatherer 推送 / 手动录入 / obsidian 同步），全文检索（PG FTS）+ 向量检索（pgvector + 智谱 embedding-2），LLM 实体关系抽取生成知识图谱可视化，支持圈定内容供 Assistant 查询。

## 2. 功能模块

### 2.1 知识收件箱（消费 Gatherer）
- 轮询 gatherer 库 outbox 的 knowledge.item.collected（跨库读，幂等）
- 事件 → 条目：source=gatherer，source_ref=itemId，含标题/正文/摘要/分类/关键词

### 2.2 条目管理
- 手动录入：标题/内容/分类/标签
- 三来源标签：gatherer / manual / obsidian
- 条目 CRUD + 列表筛选（来源/分类/标签）

### 2.3 检索（双通道）
- 全文检索：PG FTS（中文分词 pg_trgm? 用 simple/english 配置 + ILIKE 兜底；MVP 用 pg_trgm 相似 + 关键词匹配）
- 向量检索：pgvector，条目入库时生成 embedding（智谱 embedding-2，1024 维）；检索取 top-k 相似
- 搜索接口：?mode=fts|vector

### 2.4 知识图谱
- 「生成图谱」按钮（或入库后自动）：LLM 从条目集抽取实体（名称/类型）与关系（主语-关系-宾语）
- 图谱可视化：力导向图（节点=实体，边=关系），点击实体节点列出关联条目
- 图谱数据存储：entities / relations 表；重建图谱 = 全量重抽（MVP 简化）

### 2.5 obsidian 同步
- 配置本地 vault 目录路径（服务器本机可访问）→ 扫描 .md 文件（跳过附件/模板目录）→ 导入为条目（source=obsidian，路径去重幂等）
- 手动触发同步

### 2.6 圈定 Assistant 内容
- 条目级勾选「供 Assistant 查询」（assistant_scope 标记）+ 分类级圈定
- Assistant 建成后按此范围检索（MVP 仅标记）

## 3. 数据模型（PostgreSQL，scholar 库）

| 表 | 关键字段 |
|---|---|
| entries | id, source(gatherer/manual/obsidian), source_ref, title, content, summary, category, tags(jsonb), embedding vector(1024), assistant_scope(bool), timestamps, UNIQUE(source, source_ref) |
| entities | id, name, type, created_at |
| relations | id, from_id, to_id, label, created_at |
| entry_entities | entry_id, entity_id（条目↔实体关联，图谱点击反查） |
| settings | key, value（vault 路径等） |
| outbox（@mt/db 复用） | 本 MVP 仅消费 knowledge.item.collected（不产出） |

- 数据库自举；pgvector 扩展 CREATE EXTENSION IF NOT EXISTS vector（迁移 000 执行）

## 4. API 设计（NestJS，前缀 /api/scholar）

| 方法/路径 | 说明 |
|---|---|
| POST /inbox/poll | 消费 gatherer 事件（幂等） |
| GET/POST /entries | 列表（筛选）/ 手动录入 |
| GET/PATCH /entries/:id | 详情 / 更新（标签/圈定） |
| GET /entries/search?q=&mode=fts|vector&limit= | 双通道检索 |
| POST /graph/generate | LLM 抽取实体关系（重建图谱） |
| GET /graph | 图谱数据（nodes + edges + 关联条目计数） |
| POST /sync/obsidian | 扫描 vault 目录导入 |
| PATCH /settings | 更新 vault 路径等配置 |
| GET /meta/embedding-status | embedding 配置状态 |

## 5. 技术要点

1. **embedding**：@mt/model-client 扩展 `embed(texts): Promise<number[][]>`（POST /embeddings，model=embedding-2，OpenAI 兼容）；供应商配置增 embeddingModel；MT_LLM_STUB 桩模式返回确定性伪向量（文本 hash 展开 1024 维）
2. **pgvector**：迁移 000 执行 CREATE EXTENSION；条目入库时调 embed 生成向量；检索 ORDER BY embedding <=> $1 LIMIT k
3. **FTS**：中文用 pg_trgm 扩展（相似度）+ ILIKE 关键词组合（MVP 实用优先，不引入 zhparser）
4. **图谱抽取**：LLM 输出 JSON {entities:[{name,type}], relations:[{from,to,label}]}（桩模式返回固定图谱）；前端 G6 力导向图（@antv/g6）
5. **跨库消费**：gatherer 库只读连接池（GATHERER_DATABASE_URL）+ processOutbox 幂等
6. **端口**：scholar web 4006 / server 5006（已登记）；独立库 scholar；loadRootEnv 就位
7. **CI**：smoke/e2e 的 scholar 服务加 MT_LLM_STUB=1（embedding 走桩）+ GATHERER_DATABASE_URL；E2E 全流程（poll→搜索→图谱→圈定）

## 6. 已确认的决策（2026-08-19 用户确认）

- **S1**：obsidian 同步 = 本机 vault 目录扫描 .md 导入（路径去重幂等）
- **S2**：知识图谱 = LLM 全量抽取实体关系 + G6 力导向图
- **S3**：圈定 = 条目级勾选 + 分类级圈定（assistant_scope 标记）
- **S4**：向量检索 = 智谱 embedding-2（1024 维）+ @mt/model-client 扩展 embed（桩模式确定性伪向量）

## 7. 验收标准（DoD）

1. inbox 消费 gatherer 事件幂等入库（source=gatherer）
2. 手动录入 + obsidian 同步（路径去重）
3. 双通道检索：FTS（关键词）与向量（相似度 top-k）各至少一个 e2e 用例（桩模式）
4. 图谱：LLM 抽取 → entities/relations 入库 → G6 可视化（E2E 验证 graph 端点）
5. 圈定标记可设置（assistant_scope）
6. CI 全绿 + docs/迭代日志同步 + 合并 main（Phase 2 目标完成）
