# MagicTools 迭代日志（平台级）

- 各子项目与公共包的版本化变更由 changesets 自动生成到各自包目录的 CHANGELOG.md；
- 本文件记录平台级迭代摘要（阶段、里程碑、关键决策），在每次 dev→main 合并时追加一条；
- 条目格式：日期、变更摘要、涉及子项目、关联 PR。

## 2026-08-18

- 平台总体设计评审通过，建立 spec 与实施计划体系；
- Phase 0 工程化基座开工；
- **Phase 0 完成并合并 main（PR #1）**：Monorepo + 6 公共包 + 网关 + 8 子项目骨架 + outbox + 四层测试 + CI/CD + Docker 部署链路 + 文档/记忆/分支机制全部落地，CI 全绿（0dfdd8d）。

## 2026-08-19

- **Applicant MVP 完成（待合并 PR）**：岗位管理（CRUD/看板/JD 文本解析/截图视觉识别/投递话术）、面试复盘（记录/LLM 分析/markdown 导出）、简历管理（ClawCV analyze/rewrite/match + 无 Key 全降级）；@mt/model-client 新增多模态视觉路由；CI 冒烟与 E2E 覆盖 applicant 全流程（MT_LLM_STUB 桩模式）。
