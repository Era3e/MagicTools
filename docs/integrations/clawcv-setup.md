# 超级简历 ClawCV 接入手册（Applicant 用）

> 调研日期：2026-08-18。来源：https://www.wondercv.com/clawcv/api-guide（官方接入指南）。
> ClawCV 是超级简历（WonderCV）面向 AI 工具的「龙虾简历」技能体系，后端通过 API Key 鉴权。

## 一、获取 API Key（免费）

1. 打开 https://www.wondercv.com/clawcv/api-guide，登录超级简历账号；
2. 点「注册获取免费 API Key」；
3. 免费额度（按月）：**10 次 PDF / 20 次改写 / 20 次分析**；月/年度会员各 50 次，终身会员各 100 次；
4. 把 Key 写入本机 .env（已加键位）与 GitHub Secrets（CLAWCV_API_KEY）。

## 二、后端信息

- 后端地址：https://api.wondercv.com
- 鉴权：API Key（官方示例环境变量 SKILL_BACKEND_API_KEY）
- 官方分发形态：OpenClaw/Claude 的 MCP skill（npm 包 clawcv，仓库 https://github.com/WonderClaw/clawcv）；我们不走该形态，由 @mt/model-client 之外的专用 adapter 直连后端 HTTP（端点以官方包实现为准，Phase 1 实现时抓包/读包确认）

## 三、可用能力（6 个 AI 技能）

| 能力 | 说明 | Applicant 中的应用 |
|---|---|---|
| analyze_resume | AI 打分 + 找问题 + 给建议 | 面试复盘后简历诊断 |
| rewrite_resume_section | 逐段改写，STAR 法则优化 | 复盘 → 简历优化闭环核心 |
| match_resume_to_job | 简历 vs JD 对比，查缺补漏 | 与 JD 解析模块联动 |
| generate_one_page_pdf | 专业排版导出 PDF | 后续版本（可选） |
| match_campus_recruits | 校招推荐 | 后续版本（可选） |
| get_ai_mentor_advice | 面试准备/薪资谈判/职业规划 | 后续版本（可选） |

## 四、降级策略（设计文档已预留）

ClawCV API Key 未到位或额度用尽时：
1. 简历解析降级为本地文件上传（PDF/文本）+ @mt/model-client 解析；
2. 简历优化降级为本地 LLM 生成修改建议，用户人工回填超级简历；
3. 接口全部走 adapter 模式，ClawCV 不可用时功能自动降级、不阻塞主流程。

## 五、验收清单

- [ ] 已注册获取免费 API Key，并完成一次 curl 调用验证（端点以官方包为准）
- [ ] Key 已入本机 .env 与 GitHub Secrets
