# P16 实施计划

| 阶段 | 内容 | 验证 |
|---|---|---|
| T0 | 写设计文档与失败测试 | 单测/数据库测试先红 |
| T1 | 迁移、指纹隔离与种子数据 | 指纹、case 计数、few-shot/导出隔离 |
| T2 | 评分器、run 持久化与动作解析 | dev run 24/24 明细，异常/超时/missing 均落库 |
| T3 | 版本比较 API 与 IntentLogPage 评测卡 | 同数据集可比较，指纹漂移拒绝 |
| T4 | 文档事实源、changeset、目标测试 | docs:facts、docs lint、Assistant/Web 目标测试 |
| T5 | 完整 qa、smoke、独立 0 bug 审查、PR CI | quality/smoke/e2e 全绿后合并 |

执行纪律：

1. 先失败测试，后实现。
2. 数据库测试必须真实执行，新测试进入强制清单。
3. 配置快照逐字段白名单，测试断言秘密值不存在。
4. 所有接口新增后运行 `pnpm docs:facts` 并提交生成物。
