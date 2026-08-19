# Applicant（求职者）子系统设计（MVP）

- 文档类型：子项目设计文档（spec）
- 创建日期：2026-08-18
- 状态：✅ 已确认（2026-08-19 用户确认 A1~A4 四项默认值）
- 上游：docs/superpowers/specs/2026-08-18-magictools-platform-design.md（5.8 节 MVP 边界）

## 1. 定位

个人求职全生命周期管理：岗位收集 → JD 解析 → 投递进度 → 面试复盘 → 简历诊断与优化，形成「复盘驱动简历迭代」的闭环。作为 Phase 1 试点，同时验证业务子项目从 spec 到 CI 合并的完整开发样板。

## 2. 功能模块

### 2.1 岗位管理
- 岗位列表 + 状态看板（Tag 着色：待投递 → 已投递 → 笔试 → 面试 → offer → 拒绝）
- 手动录入：公司/职位/薪资/城市/JD 文本
- **JD 文本解析**：粘贴 JD → LLM 结构化（公司/职位/职责/要求/薪资/技能关键词）→ 预填表单，人工确认保存
- **图片识别**：上传截图（招聘平台 JD 截图、聊天/内推截图）→ 视觉模型提取结构化岗位信息 → 预填表单确认
- 半自动投递：岗位详情「去投递」跳转链接（applied_url）+ 打招呼话术生成（LLM 基于 JD）

### 2.2 面试复盘
- 岗位下挂多条面试记录（第几面/时间）
- 复盘表单：面试问题与我的回答（自由文本）+ 自我反思
- **LLM 复盘分析**：输出问题清单分类（技术/行为/项目）、回答质量点评、改进建议、行动项（下次面试前的 TODO）
- 支持导出 markdown（个人存档/分享用）

### 2.3 简历管理（ClawCV 集成）
- 简历版本管理（名称/版本号）
- 主路径走 ClawCV API（端点契约见 docs/integrations/clawcv-setup.md）：
  - analyze：简历打分 + 问题清单（保存为诊断报告）
  - rewrite：按 section_type 改写（STAR 法则），**入口挂在面试复盘结论上**（"这条经历的简历描述需要改写"→ 一键改写）
  - match：简历 vs 岗位 JD 匹配（岗位详情页按钮，输出匹配分/gaps/缺失关键词）
- **降级路径**（ClawCV Key 未配置/额度耗尽时）：本地 LLM 生成建议 + 人工回填；简历内容支持手动粘贴文本
- 额度查询：展示本月剩余次数

## 3. 数据模型（PostgreSQL，applicant 库）

| 表 | 关键字段 |
|---|---|
| positions | id, company, title, city, salary, source(manual/jd_text/screenshot/chat), jd_raw, jd_structured(jsonb), status, applied_url, notes, timestamps |
| interviews | id, position_id, round, happened_at, qa_notes, reflection, analysis(jsonb: 问题清单/回答质量/改进建议/行动项), timestamps |
| resumes | id, name, version, source(clawcv/manual), content_text, clawcv_session_id, last_analysis(jsonb), timestamps |
| resume_rewrites | id, resume_id, position_id?, section_type, original_text, rewritten_text, created_at |
| job_matches | id, resume_id, position_id, match_score, gaps(jsonb), missing_keywords(jsonb), created_at |

- 事件（outbox，为后续与 Scholar/Manager 联动预留）：position.created、interview.analyzed、resume.updated
- 迁移与 outbox 复用 @mt/db

## 4. API 设计（NestJS，前缀 /api/applicant）

| 方法/路径 | 说明 |
|---|---|
| GET/POST /positions | 列表（状态筛选）/ 新建 |
| GET/PATCH /positions/:id | 详情 / 更新（含状态流转） |
| POST /positions/parse-jd | JD 文本解析（LLM 结构化） |
| POST /positions/parse-image | 截图识别（multipart，视觉模型） |
| GET/POST /positions/:id/interviews | 面试记录列表 / 新建 |
| POST /interviews/:id/analyze | 生成复盘分析 |
| GET /interviews/:id/export.md | 导出复盘 markdown |
| GET/POST /resumes | 简历列表 / 新建（内容文本） |
| POST /resumes/:id/analyze | ClawCV analyze（降级：本地 LLM） |
| POST /resumes/:id/rewrite | 改写某段（section_type + original_text） |
| POST /resumes/:id/match/:positionId | 简历 vs 岗位匹配 |
| GET /meta/quota | ClawCV 剩余额度 |

## 5. 技术要点

1. **公共包扩展（本子项目驱动）**：@mt/model-client 增加多模态支持（vision 模型，消息支持图片 URL/base64）；供应商配置增加 visionModel 字段（智谱 glm-4v 系列；DeepSeek 无视觉则路由到智谱）。这是 Phase 1 首个公共包改动，走 TDD + 独立提交。
2. **ClawCV adapter**：apps/applicant/server/src/clawcv/（仅本应用使用，不上公共包）：Bearer 鉴权、30s 超时 + 2 次退避重试、额度查询、不可用时返回降级标志。
3. **图片上传**：MVP 存本地磁盘（data/uploads，gitignore），NestJS multer；网关不改造（web/server 同源 /api/applicant）。
4. **前端**：React + AntD + @mt/ui；页面 = 岗位列表(看板) / 岗位详情 / 面试复盘 / 简历中心；表单校验 zod。

## 6. 已确认的决策（2026-08-19 用户确认）

- **A1**：图片识别支持「招聘平台 JD 截图 + 聊天/内推截图」，线下物料拍照后置
- **A2**：先做 Applicant，需求主线随后
- **A3**：JD 解析只做「粘贴文本」；URL 抓取因反爬风险放入 Backlog
- **A4**：简历主路径 = ClawCV API；手动粘贴文本作为降级与补充；PDF 本地上传解析放入 Backlog

## 7. 验收标准（DoD）

1. 六个状态流的岗位 CRUD + 看板可用
2. JD 文本解析与截图识别均返回结构化预填（本地 E2E 覆盖）
3. 面试复盘分析生成并展示，可导出 markdown
4. ClawCV adapter：无 Key 时功能自动降级不报错；有 Key 时 analyze/rewrite/match/quota 全通（真接口联调 1 次）
5. CI 全绿（单元/冒烟/E2E），docs 与迭代日志同步，合并 main
