# MagicTools 平台总体设计（MVP）

- 文档类型：顶层设计文档（spec）
- 创建日期：2026-08-18
- 状态：✅ 已通过设计评审（待转入实施计划）
- 关联：README.md、AGENTS.md（待建）、docs/memory/（待建）

## 1. 项目概述

MagicTools 是一套面向个人使用的工作工具平台，由 **8 个业务子项目 + 1 个统一工程化基座**组成。核心特点：

1. **AI 智能体协作开发**：开发与测试分拆给不同智能体，对抗性测试形成 0 bug loop；
2. **多子项目并行**：8 个子项目各自独立前后端，通过统一网关、端口注册表、worktree 机制并行开发；
3. **全链路自动化**：文档同步、测试、CI/CD、镜像、迭代日志、记忆更新全部机制化，杜绝人工遗漏。

## 2. 决策记录（调研结论汇总）

| # | 调研问题 | 结论 |
|---|---|---|
| Q1 | 使用者规模 | 仅个人使用 → 无账号体系，网关层简单鉴权 |
| Q2 | Phantom 含义 | Manager「外部需求接入」能力的代号 |
| Q3 | 技术栈 | 全栈 TypeScript（用户授权选型，原则：随复杂度增长仍易迭代易运维） |
| Q4 | Designer MVP 边界 | 降级版：生成 demo + 预览 + 组件沉淀，无可视化编辑器 |
| Q5 | Assistant MVP 意图 | 3 类：product_inquiry / data_query / chitchat_reject |
| Q6 | Applicant 排期 | 提前为 Phase 1 并行试点，验证工程化全链路 |
| Q7 | LLM 供应商 | DeepSeek + 智谱（GLM），OpenAI 兼容协议，支持配置扩展 |
| Q8 | 数据交互机制 | 网关 + 同步 REST + outbox 事件表 + 幂等键（用户授权选型，要求高可用，预留 MQ 演进路径） |
| Q9 | 部署形态 | 单台阿里云 ECS + Docker Compose，CI 打镜像自动部署 |
| Q10 | Manager 第三方需求源 | GitHub Issues(Projects) + cybercloud 需求管理应用 |
| Q11 | Investigator 分发渠道 | 飞书机器人 + 飞书表单/多维表格对接为主，自建表单为辅 |
| 补充1 | 并行对话分支清理 | 分支绑任务不绑对话；四层清理机制（见 4.6） |
| 补充2 | Applicant 简历管理 | 对接超级简历 ClawCV API（adapter 模式），面试复盘驱动简历优化；自动投递 MVP 不做 |

## 3. 总体架构

### 3.1 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | React 18 + TypeScript + Vite + Ant Design 5 | 单一语言、AI 生成代码质量高；AntD 表格/表单能力契合工具类应用 |
| 后端 | Node.js 20 + NestJS + TypeScript | 与前端共享类型包，模块化强，适合 Monorepo |
| 数据库 | PostgreSQL 16 + pgvector + 全文检索 FTS | 单实例多库隔离；pgvector 支撑 Scholar 向量检索 |
| 仓库 | pnpm workspace Monorepo + Turborepo | 公共包共享、增量构建、统一脚本 |
| 测试 | Vitest（单元）+ Playwright（E2E） | 生态成熟、AI 可生成测试 |
| CI/CD | GitHub Actions | 与仓库同生态 |
| 镜像 | Docker + 阿里云 ACR（或 GHCR） | dev→main 合并触发构建 |
| 部署 | 单台阿里云 ECS + Docker Compose | 个人场景最经济 |
| LLM | @mt/model-client 统一抽象（OpenAI 兼容协议），供应商：DeepSeek、智谱，可扩展 | 供应商路由、流式、重试、用量日志 |

### 3.2 Monorepo 结构

~~~
MagicTools/
├─ apps/
│  ├─ gateway/                      # 统一网关（唯一对外入口）
│  ├─ gatherer/{web,server}         # 收集者
│  ├─ investigator/{web,server}     # 调研者
│  ├─ assessor/{web,server}         # 评审者
│  ├─ manager/{web,server}          # 管理者（核心）
│  ├─ designer/{web,server}         # 设计师
│  ├─ scholar/{web,server}          # 学者
│  ├─ assistant/{web,server}        # 助手
│  └─ applicant/{web,server}        # 求职者（试点）
├─ packages/
│  ├─ utils/                        # 通用工具
│  ├─ types/                        # 共享类型
│  ├─ ui/                           # 设计令牌 + 公共组件库
│  ├─ model-client/                 # LLM 统一抽象层
│  └─ config/                       # 分层配置加载器
├─ docs/                            # 顶层文档（含 superpowers/specs、memory、CHANGELOG）
├─ infra/                           # docker-compose、ports.yaml、部署脚本
└─ .github/workflows/               # CI/CD 流水线
~~~

### 3.3 架构原则

1. **边界清晰**：每个子项目 = 独立 app（web + server）+ 独立数据库（PG 单实例多库）；
2. **唯一入口**：所有外部访问经 gateway（路径路由 / 简单鉴权 / 健康检查）；
3. **服务间通信**：同步 REST + outbox 事件表（失败重试）+ 幂等键；量大后升级消息队列；
4. **公共能力下沉**：工具/类型/组件/LLM 抽象进 packages，避免子项目重复实现；
5. **可测试可观测**：全服务健康检查、结构化日志、四层测试全覆盖。

### 3.4 端口注册表（infra/ports.yaml）

| 服务 | web | server | 服务 | web | server |
|---|---|---|---|---|---|
| gateway | 3000 | — | designer | 4005 | 5005 |
| gatherer | 4001 | 5001 | scholar | 4006 | 5006 |
| investigator | 4002 | 5002 | assistant | 4007 | 5007 |
| assessor | 4003 | 5003 | applicant | 4008 | 5008 |
| manager | 4004 | 5004 | | | |

### 3.5 数据流

- **需求主线**：飞书问卷(落多维表格) → Investigator（拉取 + LLM 结构化）→ Assessor（分析设计 + 人工审核）→ Manager（需求全生命周期 + git 分支/PR/CI 联动）
- **知识主线**：信息源 → Gatherer（采集 + 清洗 + 结构化）→ Scholar（知识库 + 知识图谱）→ Assistant（圈定内容检索）
- **试点**：Applicant 独立闭环（岗位/简历/进度/复盘）
- **外部对接**：Manager ↔ GitHub Issues(Projects)、cybercloud；Applicant ↔ 超级简历 ClawCV；Assistant ↔ cybercloud；Investigator ↔ 飞书

## 4. 工程化基座设计（Phase 0）

### 4.1 文档体系与更新机制

- **顶层**：README（项目说明）、docs/superpowers/specs（设计文档）、docs/superpowers/plans（实施计划）、UI 规范、skills 说明、CHANGELOG（迭代日志）；
- **子项目**（每子项目五类）：architecture / prd / dev / test / changelog；
- **强制一致性**：PR 模板要求勾选「已更新相关文档与迭代日志」；CI 校验 PR 关联文档变更；changesets 依据提交自动生成迭代日志；
- **流程**：需求 → spec → plan → 开发 → 测试 → review → 合并 → 文档/日志更新，缺一环不可合并。

### 4.2 即时记忆机制

- **载体**：docs/memory/ 持久化「当前状态快照、关键决策、进行中任务、已知问题」；AGENTS.md 作为 AI 入口指令；
- **会话启动协议**：AI 会话开始必读 AGENTS.md → docs/memory/ → 相关子项目文档；
- **即时更新**：每完成一个功能 / 每做一次关键决策 / 每次迭代结束，即刻追加记忆条目，禁止事后批量补记；
- **CI 校验**：PR 合并时检查迭代日志与记忆是否同步更新。

### 4.3 配置管理

- .env.template 入库；真实敏感值（GitHub SSH、ECS 凭证、API key、测试账号）git 忽略 + git-crypt 加密存储；
- CI 使用 GitHub Actions secrets；
- @mt/config 统一加载：默认值 → 环境变量 → 本地覆盖，带 schema 校验，启动失败即报错。

### 4.4 公共依赖包

| 包 | 职责 |
|---|---|
| @mt/utils | 日期/字符串/校验等通用工具 |
| @mt/types | 跨前后端共享类型（含子项目间数据契约） |
| @mt/ui | 设计令牌（颜色/间距/字体）+ 基于 AntD 封装的公共组件 |
| @mt/model-client | LLM 抽象：供应商注册表、模型路由、流式输出、重试、用量日志 |
| @mt/config | 分层配置加载 + schema 校验 |

### 4.5 网关与端口

- gateway 唯一对外入口：路径路由 /<project>/*、简单 token 鉴权、健康检查聚合、静态资源托管；
- 端口唯一来源 infra/ports.yaml，web 与 server 启动时读取，避免冲突；CI 校验端口无重复。

### 4.6 分支与 workspace 机制

- **分支模型**：main（生产）/ dev（集成）/ feat-<项目>-<任务ID>-<描述>（开发）；
- **并行开发**：git worktree，一个任务一个 worktree，主仓库保持干净；
- **分支绑任务不绑对话**：多个对话续做同一任务复用同一分支；
- **四层清理机制**：① PR 合并自动删远程分支（仓库设置开启）；② CI 定时 GC 清扫（比对分支与 open PR / Manager 任务状态，孤儿分支自动删除）；③ 会话收尾协议（commit → push → PR → 清理 worktree → 更新记忆，未完成视为会话未结束）；④ 分支名携带任务 ID，Manager 任务关闭联动清理检查。

### 4.7 测试与 0 bug loop

- **四层测试**：单元（Vitest，公共包与核心逻辑）→ 冒烟（服务启动 + 核心接口探活）→ 回归（变更影响面自动筛选执行）→ E2E（Playwright，前端页面真实操作）；
- **对抗性测试流程**：开发 agent 完成 → 测试 agent 独立验收（依据 spec 与验收标准）→ 发现 bug 回环给开发 agent → 循环直至 0 bug → 人工终审；
- **0 bug 定义**：CI 全绿 + 测试 agent 报告无未解决缺陷 + 人工确认。

### 4.8 CI/CD 与镜像管理

- **流水线**：lint → build → unit → smoke → e2e（全服务并行）；
- **镜像与发布**：dev 合并至 main 触发 → 构建受影响服务镜像 → 推送阿里云 ACR → ECS 拉取重启 → changesets 自动生成迭代日志；
- **远程保护**：main/dev 分支保护，必须 PR + review + CI 全绿才能合并。

### 4.9 部署与备份

- 单 ECS：docker compose 编排全部服务 + PostgreSQL + gateway；
- 容器 restart policy + 健康检查自动拉起；
- PostgreSQL 定时 pg_dump 备份至本地 + OSS。

## 5. 子项目 MVP 定义

### 5.1 Gatherer（收集者）· Phase 2
- **做**：信息源配置（RSS / 网页 / HTTP API JSON）；定时 + 手动采集；清洗去重（内容指纹）；LLM 结构化提取（标题/摘要/正文/来源/时间/分类）；推送 Scholar（自动或人工审核后）。
- **不做**：登录态/复杂 JS 网页采集、分布式采集。

### 5.2 Investigator（调研者）· Phase 1
- **做**：飞书对接为主——飞书问卷数据落多维表格，配置「多维表格 → 调研主题」映射后定时/手动拉取，飞书机器人分发表单链接；自建简易表单为辅（单选/多选/文本/评分 + 链接分发）；LLM 结构化（需求点/痛点/期望/情绪/优先级，支持自定义提取 schema）；调研主题管理；数据选择性推送 Assessor。
- **不做**：复杂问卷逻辑（跳题/配额）、深度统计图表、飞书以外的 OA。

### 5.3 Assessor（评审者）· Phase 1
- **做**：接收 Investigator 数据；手动补充上下文（文本 + 维护 GitHub 仓库地址，拉取仓库结构/README/关键文件）；LLM 生成需求分析（背景/目标/约束/风险）+ 可落地设计方案（功能拆解/技术方案/验收标准/工作量估算）；方案记录 + 人工审核 → 推送 Manager 创建需求。
- **不做**：代码级方案生成、多轮分析协作。

### 5.4 Manager（管理者）· Phase 1（核心）
- **做**：需求 CRUD + 状态流（待分析→设计中→待开发→开发中→测试中→待验收→已完成）；三来源 + 自动标签（Assessor 推送 / 手动录入 / 第三方同步：GitHub Issues(Projects) + cybercloud requirements，adapter 模式接入）；需求 ↔ 分支 ↔ PR 关联，状态随 CI/webhook 联动；简单迭代管理。
- **不做**：甘特图、工时统计、复杂权限。
- **Phantom**：外部需求接入框架代号（adapter 模式，可扩展任意外部需求系统）。

### 5.5 Designer（设计师）· Phase 4（降级版）
- **做**：自然语言/图片 → LLM 生成 React 组件代码（基于 @mt/ui 设计令牌）→ iframe 沙箱预览 → 下载；人工选择「沉淀为组件库」→ 审核入库 @mt/ui。
- **不做**：可视化编辑器、拖拽、实时编辑、多页面项目管理。

### 5.6 Scholar（学者）· Phase 2
- **做**：三来源（Gatherer 推送 / 手动录入 / obsidian vault 同步）；分类标签 + 全文检索（PG FTS）+ 向量检索（pgvector）；LLM 实体关系抽取 → 知识图谱可视化（点击节点看条目）；圈定内容供 Assistant 查询。
- **不做**：图谱在线编辑、多人协作。

### 5.7 Assistant（助手）· Phase 3
- **做**：LLM 意图路由（3 类）；product_inquiry = 检索 Scholar 圈定内容生成带引用回答；data_query = 对接 cybercloud 查询接口（可配置 API + LLM 生成查询参数）；chitchat_reject = 礼貌兜底；多轮对话；网页聊天 + HTTP API 双入口。
- **不做**：process_execution / trouble_shooting / complaint_feedback / multi_intent（后续版本）。

### 5.8 Applicant（求职者）· Phase 1 并行试点
- **做**：岗位收集（手动录入 + 图片识别 LLM 提取）；JD 解析（LLM 结构化：公司/职位/要求/薪资）；进度看板（待投递→已投递→笔试→面试→offer→拒绝）；面试复盘（记录 → LLM 分析：问题清单/回答质量/改进建议/行动项）；简历管理（对接超级简历 ClawCV API 读取/解析，adapter 模式，能力边界以 API 文档为准；版本管理；面试复盘 → 简历优化建议闭环：LLM 生成修改点，API 支持写入则自动更新，否则导出优化文本人工回填）。
- **不做**：自动投递（各平台反爬 + 合规风险；MVP 做半自动：看板跳转链接 + 投递话术模板）；招聘平台爬虫。

## 6. Roadmap

| 阶段 | 内容 | 预估 |
|---|---|---|
| **Phase 0 地基** | 文档体系+记忆机制 / 配置管理 / 公共包 / 网关+端口表 / UI 规范 / 分支与 CI 骨架 / 镜像部署链路 | 1~2 周 |
| **Phase 1 需求主线 + 试点** | Applicant（试点，验证全链路）∥ Investigator → Assessor → Manager（主线串行） | 4~6 周 |
| **Phase 2 知识主线** | Gatherer → Scholar | 2~3 周 |
| **Phase 3 智能助手** | Assistant（3 意图） | 1~2 周 |
| **Phase 4 增强** | Designer 降级版 / Assistant 意图扩展 / 三方对接增强 | 2~4 周 |

**统一验收标准（DoD）**：全服务过 CI（lint→build→unit→smoke→E2E）→ 0 bug loop 完成 → 文档与迭代日志已更新 → 镜像已部署 ECS 可访问。

> 预估基于「单人 + 多 AI 智能体并行」；Phase 1 内 Applicant 与主线并行推进，后续阶段可与前序收尾重叠。

## 7. 风险与外部依赖

| 依赖/风险 | 说明 | 应对 |
|---|---|---|
| 飞书开放平台 | 应用审核、多维表格 API 限流、问卷数据落表配置 | Phase 1 前完成应用创建与凭证申请；限流加缓存与退避 |
| ClawCV API | 读写能力边界需实测 | Applicant 预留 adapter，能力不足时降级为「导出优化文本人工回填」 |
| cybercloud API | data_query 与需求同步依赖其接口文档与凭证 | Phase 3 前确认 API 清单；Manager 侧 adapter 隔离 |
| GitHub Projects API | GraphQL 能力需验证 | 不满足时退化为 Issues + 项目看板组合 |
| LLM 供应商 | OpenAI 兼容性差异、上下文长度、成本 | @mt/model-client 统一适配 + 用量日志监控成本 |

## 8. 后续版本候选（Backlog）

Assistant 剩余 4 类意图；Designer 可视化编辑器；自动投递（合规评估后）；消息队列演进；多 OA 对接；知识图谱在线编辑；Gatherer 复杂页面采集。

## 9. 下一步

按 superpowers 流程转入 **writing-plans**：先产出 Phase 0（工程化基座）的详细实施计划，再按阶段滚动规划。
