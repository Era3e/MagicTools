# MagicTools 迭代日志（平台级）

- 各子项目与公共包的版本化变更由 changesets 自动生成到各自包目录的 CHANGELOG.md；
- 本文件记录平台级迭代摘要（阶段、里程碑、关键决策），在每次 dev→main 合并时追加一条；
- 条目格式：日期、变更摘要、涉及子项目、关联 PR。

## 2026-08-18

- 平台总体设计评审通过，建立 spec 与实施计划体系；
- Phase 0 工程化基座开工；
- **Phase 0 完成并合并 main（PR #1）**：Monorepo + 6 公共包 + 网关 + 8 子项目骨架 + outbox + 四层测试 + CI/CD + Docker 部署链路 + 文档/记忆/分支机制全部落地，CI 全绿（0dfdd8d）。

## 2026-08-19

- **Applicant MVP 完成并合并 main（PR #3，941fc95）**：岗位管理（CRUD/看板/JD 文本解析/截图视觉识别/投递话术）、面试复盘（记录/LLM 分析/markdown 导出）、简历管理（ClawCV analyze/rewrite/match + 无 Key 全降级）；@mt/model-client 新增多模态视觉路由；CI 冒烟与 E2E 覆盖 applicant 全流程（MT_LLM_STUB 桩模式）。
- **Investigator MVP 完成并合并（PR #5）**：调研主题管理（飞书 Bitable 源 + 字段映射）、同步链路（FeishuClient 令牌缓存/分页/归一化 + LLM 结构化 + 幂等入库）、结果筛选与主题总结、按记录推送 outbox 事件（researcher.response.push）、群机器人分发、数据库自举（免手工建库）。
- **Assessor MVP 完成并合并（PR #7）**：跨库消费 investigator 事件并批次聚合幂等入库、GitHub 仓库上下文（README/目录树/语言）、LLM 需求分析+设计方案、五状态审核流、推送 requirement.created 事件（主线第二环打通）。
- **Manager MVP 完成（待合并 PR）**：跨库消费 requirement.created、需求 7 态生命周期与三来源标签、PR 状态联动刷新、Phantom GitHub Issues 同步、迭代管理；三环全链路 E2E 打通。
