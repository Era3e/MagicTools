# Assistant 模块

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 6.7 Assistant（助手·知识主线闭环·6 意图）

**端口**：Web 4007 / Server 5007
**主题**：QUIET_THEME（对话极简 — 无衬线 / 瓷白 / 砖橙）

## 后端模块

| 层 | Controller/Service | 职责 |
|---|---|---|
| 健康 | HealthController | — |
| 对话 | ChatController + ChatService | HTTP + 网页双入口、多轮持久化、调用 IntentService 路由；**双路编排（CYBERCLOUD_MODE=dual 默认）：直连先行秒回 + 智能体后台核验，双路全故障降级文案** |
| 意图 | IntentService | **双层路由（系统归属→域内意图）** / 规则+模型双轨 / 置信度输出、低置信度澄清反问闭环；**few-shot 在线学习（纠错样本注入 system prompt，60s TTL 缓存）** |
| 知识问答 | KnowledgeService | 连接 Scholar SCHOLAR_DATABASE_URL → 查圈定条目 → 生成带引用回答 |
| 数据查询·智能体 | CybercloudService | **真实 cybercloud 对接**（SPKI DER 公钥加密登录/JWT 提取/双头认证/401 自动重登/智能体 block 对话），桩模式 CYBERCLOUD_STUB=1；元数据/ERROR 不降维/postApi/探活（data-source-status） |
| 数据查询·直连 | DirectQueryService | **五步流水线（双路架构 2026-09-08）**：indicators 缓存 → LLM 指标匹配+时间解析 → getReportStructure 防御解析 → 列匹配 → 去分组 queryByStructure 聚合 |
| 数据核验 | VerifyTaskRegistry + CompareService | 五终态状态机（60s 超时/10min TTL/迟到终态守卫）+ 数值归一对比（万/亿/k/% + 1% 容差），divergent 时 VerifyBadge 标注 |
| 数据查询监控 | CybercloudCallsRepo | cybercloud_calls 表（migrations/004）双路调用记录 + IntentLogPage 监控卡（双路成功率/延迟） |
| 动作执行 | ActionService | process_execution：网关调 Manager 创建需求 / 调 Gatherer 触发采集 |
| 故障排查 | TroubleService | 全服务 /health 探测聚合 + LLM 排查建议 |
| 反馈 | FeedbackController + FeedbackService | complaint_feedback：落库 + 前端反馈页可查 |
| 意图日志 | IntentLogController + EvaluationService | 可观测层：{domain,intent,confidence} 日志列表 + 纠错回填 API + 混淆矩阵/回放评估 + JSONL 数据集导出 |
| 微调编排 | FinetuneService + FinetuneRepo | **LoRA 编排层（D-09，2026-09-10）**：finetune_jobs 表（migrations/005）+ 500 样本就绪门禁 + FT_LAUNCH_ENABLED 真跑开关（缺省关）+ status 远端刷新降级快照；数据链 = exportDataset JSONL → @mt/model-client finetune 四端点（FT_STUB 桩）；IntentLogPage 微调卡（进度/发起/5s 轮询）。真跑需智谱 Pro 权益，模型切换走 ZHIPU_MODEL |
| 元信息 | MetaController | 支持的意图清单 / 系统状态 / data-source-status 探活 |

## 6 类意图路由（IntentService）

| 意图 | 说明 | 下游服务 |
|---|---|---|
| `product_inquiry` | 产品咨询 | KnowledgeService → Scholar 圈定条目 + 引用回答 |
| `data_query` | 数据查询 | CybercloudService → cybercloud 智能体（可配置 + 桩） |
| `process_execution` | 流程执行 | ActionService → 网关转发 Manager/Gatherer 创建需求/触发采集 |
| `trouble_shooting` | 故障排查 | TroubleService → 全服务健康探测 + LLM 建议 |
| `complaint_feedback` | 反馈投诉 | FeedbackService → 落库 + 可查 |
| `chitchat_reject` | 闲聊兜底 | 礼貌拒绝 + 引导使用正式能力 |

## 前端路由

```
前台（UserShell /assistant）：
  /                    ChatPage      双栏文档流对话（v2.3：260 会话栏 accent 竖条激活 + 消息流舞台 + 气泡角指向；
                                     双路数据查询 VerifyBadge 轮询标签（七态语义映射，divergent 可展开智能体原文）；
                                     重试恢复流（ERR_SPECS 错误码矩阵/ATTEMPT n/3 演进/429 倒计时））
  /feedback           （redirect）→ /admin/feedback
  /intent-logs        （redirect）→ /admin/intent-logs

后台（AdminShell /assistant/admin）：
  /admin/feedback      FeedbackPage   反馈提交 + 历史查看
  /admin/intent-logs   IntentLogPage  意图日志可观测 + 纠错回填 + 路由评估卡（混淆矩阵/回放）+
                                       数据查询监控卡（v2.3：MtKpiRow 双路成功率/延迟 + cybercloud_calls 明细表）
```

---
