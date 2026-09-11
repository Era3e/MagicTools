# P01/P02 独立验收与本地验证

分支：feat-infra-P02-quality。基于 main `aeaff9a96087e4c808f7847f673b92d21230c318`，该提交已包含 PR #69 与 #70。

## 独立测试

测试智能体 manager_foundation_review 与实现者分开验证。

| 范围 | 结果 |
|---|---|
| 数据库入口与清单策略 | 14/14：业务库/非法项目拒绝、清单遗漏与重复、非法阈值、skip/todo/零用例、失败 summary |
| CLI 非法参数 | 5/5：缺值、空值、多余和未知参数均拒绝 |
| 独立真实数据库 | outbox 3/3、Investigator 9/9；跨项目/文件/上游隔离、碰撞不覆盖、越界清理拒绝、成功清理通过 |
| 提交与运行证据 | 12/12：真实 Git merge 的 head/base/checkout、指纹、旧运行、模式、数据库原始明细、完整成功路径和失败回执 |
| 超时处理 | Windows 下只终止本次父/孙进程，调用方继续存活 |
| Turbo 与 CI | 桩开关变化导致普通单测 hash 变化；DB 集成不缓存；artifact 失败也保存、包含候选和 run/attempt |

独立测试文件为 `infra/scripts/lib/database-validation.review.test.mjs` 和 `quality-evidence.review.test.mjs`。证据启动器正例使用独立临时 Git 仓库与受控阶段依赖，用于验证取证和回执机制；不把这些 fixture 当作真实全仓业务测试。

发现并修复的关键问题包括：空清单可能通过、漏掉一个文件不报错、非法最低执行数、汇总 skip 与明细不一致、错误基线借正确 head 通过、数据库明细缺失却阶段成功，以及显式空项目被解释为全项目。以上均先由独立失败回归复现，再修复并复验。

## 实际全仓验证

- `pnpm qa:gate` 完整退出 0：构建/普通测试 46/46 任务，公共包覆盖率通过，基础设施 46/46，文档零错误，设计映射 126 PASS。
- 实际关键数据库：9 项目、30 文件、135 条用例全部通过，skip=0。每个文件使用独立的主库与上游库，成功后清理自身随机数据库。
- 普通单测的数据库 I/O 阻断经过 RED→GREEN；遗漏分类的 cybercloud-calls.repo.test.ts 已补入集成清单。
- Designer 原生成交互移除定位失败后的 skip，对照真实 placeholder，等待生成响应和 preview iframe；真实 Chromium 用例通过。
- Manager 与 Designer 组合浏览器回归17/17，全量 HTTP 冒烟17/17；当前候选构建的服务在本地验证。
- 本地质量回执带 `clean=false` 和工作树指纹，准确表达提交前验证；最终已提交候选以 CI 的 clean checkout 报告为准。验收记录等文档收尾另跑文档检查。

## 环境与边界

本地使用 Node 20.20.2、独立 Docker PostgreSQL 16 + pgvector（55433）；测试并不使用业务库。迁移旧用例时，遗留硬编码触发了认证拒绝，没有读写原 5432 数据；现已改用隔离配置，并在连接前拦截关键文件硬编码连接串，普通单测也禁止实际 pg I/O。

数据库是真实验证，外部模型/接口是桩、mock 或受控缺配置场景，liveModel=not-run。本批不宣称真实问答效果或生产部署完成。

源代码和文档可在本批 PR 审阅；运行时 JSON/log 不进入 Git。CI quality 会在成功或失败后上传与候选及运行编号绑定的 artifact，后续合并决策必须核对该运行和 required checks。
