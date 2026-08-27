---
"@mt/gatherer-web": minor
"@mt/investigator-web": minor
"@mt/assessor-web": minor
"@mt/scholar-web": minor
---

修复操作闭环缺失项 D1/D3：
- D1 跨系统推送去向提示补齐：gatherer 条目推送提示至 Scholar 收件箱与拉取步骤；investigator 记录推送提示至 Assessor 收件箱与拉取步骤；assessor 推送 Manager 文案补收件箱与拉取步骤（标注事件名 researcher.response.push / requirement.created / knowledge.item.collected）。
- D3 编辑入口补齐：gatherer 信息源表格新增「编辑」列与 Modal（PATCH /sources/:id）；investigator 调研主题表格新增「编辑」列，SurveyForm 扩展编辑模式（initialValues/title 可配置）；scholar 馆藏目录条目右侧新增「编辑」按钮与 Modal，覆盖 title/summary/content/category/tags 五项（PATCH /entries/:id 补前端字段扩展）。
