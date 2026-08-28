---
"@mt/assistant-server": minor
"@mt/assistant-web": minor
"@mt/ui": patch
---

Assistant D-09 意图路由在线学习：纠错样本自动构造 few-shot 注入分类提示词（每意图 3 条/总数 12 封顶、60s TTL 缓存、纠错落库即清缓存即时生效）；新增评估闭环（混淆矩阵 + 回放评估命中率）与 OpenAI 兼容 JSONL 微调数据集导出；IntentLogPage 新增「路由评估」卡片。附带 D-13 收尾：修复 5 处 ESLint 错误、AdminShell 接入 ThemeProvider、补齐 @ant-design/icons 依赖。
