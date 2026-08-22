---
"@mt/ui": minor
"@mt/applicant-web": minor
"@mt/assessor-web": minor
"@mt/assistant-web": minor
"@mt/designer-web": minor
"@mt/gatherer-web": minor
"@mt/investigator-web": minor
"@mt/manager-web": minor
"@mt/scholar-web": minor
"@mt/scholar-server": patch
---

统一前端外壳：@mt/ui 新增 AppShell（侧边导航 + 顶栏 + 跨应用切换）并扩展设计令牌，8 子项目接入替换裸 Card 与重复外壳；修复 applicant 简历改写误作用首份简历；接入 ESLint（typescript-eslint + react-hooks）与覆盖率门槛；scholar-server e2e 补齐 DB 不可用时的 skip 守卫。
