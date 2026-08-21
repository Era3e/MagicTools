---
"@mt/assistant-server": minor
"@mt/assistant-web": minor
---

Assistant 多系统意图路由迭代：intent_logs 意图日志可观测层（domain/intent/confidence/纠错回填 + 列表与纠错 API + Web 日志页）；分层路由（系统归属 → 域内意图，规则/模型双轨输出 {domain,intent,confidence}）；低置信度澄清反问闭环（候选选项确认执行 + 纠错样本沉淀）。
