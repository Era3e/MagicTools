# 后端与数据库体系

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 9. 后端与数据库体系

### 9.1 NestJS 统一骨架模式

每个子项目 server 完全同构，仅领域不同：

```
main.ts
├─ loadRootEnv()           // @mt/config 读仓库根 .env
├─ const PORT = process.env.PORT            // 来自 ports.yaml
├─ const DATABASE_URL = process.env.DATABASE_URL
├─ const pool = createPool(DATABASE_URL)    // @mt/db createPool
├─ runMigrations(pool, join(__dirname, "../migrations"))  // 自动执行 SQL
├─ const app = await NestFactory.create(AppModule)
├─ app.setGlobalPrefix("/api/<name>")       // 全局前缀（与 gateway /api/<name>/ 对齐）
├─ setInterval(() => processOutbox(pool, handler, opts), 5000)  // 消费上游事件
└─ app.listen(PORT)
```

### 9.2 三层代码分层

```
schemas.ts (Zod 校验 DTO)
  ↓
*.controller.ts (路由 + 参数校验 + 调用 Service)
  ↓
*.service.ts (业务逻辑：编排 LLM/外部集成/Repo 调用)
  ↓
*.repo.ts (纯数据库 CRUD：pool.query SQL 原生)
```

> 选型原则：不引入 TypeORM/Prisma，原生 PG SQL + Zod 校验最轻量、最可控。

### 9.3 数据库模式（单实例多库）

PostgreSQL 单实例（pgvector/pgvector:pg16），使用 `infra/postgres-init.sql` 初始化时为每个子项目 + 测试创建独立数据库：

| 数据库 | 用途 | 迁移来源 |
|---|---|---|
| applicant | 求职 | apps/applicant/server/migrations + @mt/db outbox |
| investigator | 调研 | apps/investigator/server/migrations（含 002_outbox.sql） |
| assessor | 评审 | 同上（含 outbox） |
| manager | 管理 | 同上 |
| gatherer | 采集 | 同上 |
| scholar | 知识 | apps/scholar/server/migrations |
| assistant | 助手 | apps/assistant/server/migrations（6 个：core/feedback/intent_logs/cybercloud_calls/finetune_jobs/evaluation_suite） |
| designer | 设计 | apps/designer/server/migrations |
| mt_test | E2E 测试共享 | — |

### 9.4 迁移执行器机制（runMigrations）

- 自动建 `schema_migrations(name PK, applied_at)` 表
- 读取 migrations 目录下所有 `*.sql` 按文件名升序执行
- 每个文件单事务包裹：BEGIN → 执行 → INSERT schema_migrations → COMMIT；失败 ROLLBACK 抛错
- 幂等：已在 schema_migrations 中的文件跳过
- 子项目迁移目录必须包含自己的业务表 + 需要 outbox 时追加 `002_outbox.sql`（@mt/db/migrations 是模板）

---
