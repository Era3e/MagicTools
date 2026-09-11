# 质量门禁与数据库验证证据

`pnpm qa:gate` 是本地与 CI 共用的入口，按顺序执行 lint、构建与普通单测、覆盖率、基础设施、文档、设计映射和强制数据库验证。报告来自实际执行结果，PR 复选框只用于说明文档与独立验收是否同步。

## 首次准备

1. 安装依赖：`pnpm install --frozen-lockfile`。Windows 使用 `pnpm.cmd`。
2. 准备独立 PostgreSQL 16 或更新版本，安装 pgvector。建议本地将专用容器端口映射到 `127.0.0.1:55433`，与业务数据库分开。
3. 在现有 `.env` 中增加 `MT_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55433/postgres`。这里是专用实例的管理连接；用户名和密码按实际测试实例填写。首次配置可从 `.env.template` 创建文件。
4. 运行 `pnpm qa:gate`。测试入口会派生新的 `mt_<运行随机标识>_<项目>_<库角色>_test` 数据库并执行迁移，不会把连接中的业务库当作清场目标。

本地测试容器示例：

```powershell
docker run -d --name magictools-test-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres -p 127.0.0.1:55433:5432 pgvector/pgvector:pg16
pnpm.cmd qa:gate
```

已有该端口的独立测试实例时直接复用其连接。示例口令用于本地测试，不是生产配置。

## 选择验证入口

| 命令 | 用途 |
|---|---|
| `pnpm test` / `pnpm test:affected` | 普通单元测试与受影响范围；数据库连接/查询在普通单测中被阻断，依赖应使用 mock |
| `pnpm test:db` | 强制运行全部 9 个项目的 30 个关键文件；先构建公共依赖，再使用真实测试数据库 |
| `pnpm test:db --project assistant` | 只运行指定项目的关键数据库文件，仍要求无失败、无跳过 |
| `pnpm test:manager:integration` | 保留 Manager 单项目入口，覆盖当前清单中的全部 Manager 数据库文件 |
| `pnpm qa:gate` | 完整合入门禁，包含上述数据库验证；自动合并必须查看对应候选的 CI 结果和证据 |

Manager 旧 `MANAGER_TEST_DATABASE_URL` 仍可用于单项目命令，但必须指向 `mt_*test` 专用库。新入口只复用其中的服务器和认证信息，另行派生隔离库；不会直接删除旧指定库。完整 qa:gate 使用 `MT_TEST_DATABASE_URL`。

## 隔离与失败行为

每个关键文件都有独立主库及上游库。Assessor 清理的 Investigator 上游库、Manager 清理的 Assessor 上游库，均不与其他项目或其他文件共享。自举测试使用一个尚未创建的专用临时库，验证实际建库行为。

成功后删除本文件创建的随机测试库。失败时保留对应测试库用于诊断，库名记录在失败报告；不会因重试删除同名已存在的库。初始化发生碰撞会失败，已有数据保持不变。

连接、扩展、迁移和应用装配失败均导致非零退出并保留错误，不会转换为 skip 后返回成功。普通单测中的意外 `pg` 连接或查询会在 I/O 前直接失败，提示将真实数据库用例登记到 test:db。

## 新增或维护数据库用例

三个位置必须一致：

1. 用例顶部标记 `@database-integration`。
2. `infra/testing/database-suites.json` 声明项目、文件和最低执行数。
3. 对应包的普通 `vitest.config.ts` 排除该文件。

门禁同时校验文件是否存在、标记/清单/排除项是否一致、项目是否齐全、阈值是否为正整数。关键文件不能硬编码 PostgreSQL 连接串，应使用启动器提供的 `DATABASE_URL`、`TEST_DATABASE_URL` 和上游环境变量。

Vitest 的每文件 JSON 还会检查 suite 和 assertion 的实际状态：缺文件、零用例、执行数不足、失败、skip/todo、重复套件或汇总与明细不一致都会失败。数据库任务直接运行且不缓存；Turbo 的集成任务也显式 `cache:false`。普通单测的桩开关纳入环境和缓存键。

## 查看报告

完整门禁写入 `.qa/quality/<validationId>/quality.json`，其中包含数据库汇总及每文件 Vitest JSON。单独 test:db 写入 `.qa/database/<runId>/summary.json`。

报告记录候选 SHA、实际 checkout SHA、基准 SHA、工作树指纹、验证编号、CI run/attempt、开始结束时间和每个阶段的结果。PR 的候选提交与 GitHub 默认检出的合并提交分别记录；工作树在验证期间变化会使回执失效。失败也保存报告，未执行阶段不会被记为通过。

GitHub Actions 将质量证据保存为包含候选 SHA、run ID 和 attempt 的 artifact，默认保留 14 天。检查 PR 时应同时核对 required checks、对应运行和 `quality.json` 的身份，不能复用上一条需求或上一次运行的报告。

报告不保存数据库口令、模型 Key、审批凭证或完整环境变量；`.qa` 是运行产物，不提交 Git。

## 结果不能证明什么

数据库模式明确为 real，外部服务使用桩、mock 和受控的缺配置场景；`liveModel=not-run`。向量测试的伪向量可以验证实际 PostgreSQL 查询，却不证明真实 embedding 或问答准确率。真实模型比较由 P16 的独立评测记录承担。

CI 通过证明相应代码与测试在该环境下通过，不代表生产部署、数据恢复演练或用户验收已经完成。开发、合并、发布和生产回执分别管理。
