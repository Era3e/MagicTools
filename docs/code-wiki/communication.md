# 服务间通信与事件契约

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 7. 服务间通信与事件契约

### 7.1 通信模型

```
同步 REST：适合同一子项目内 web → server（经 gateway 反代）
          如 assistant → scholar（SCHOLAR_DATABASE_URL 直连也可）

outbox 事件表：适合跨子项目异步解耦（失败重试 + dead 终态）
  生产者：appendOutbox(pool, { id:event-uuid, event:"xxx", source, payload, occurredAt })
  消费者：setInterval(() => processOutbox(pool, handler, { batchSize:10, maxAttempts:5 }), 5000)
          （每 5 秒轮询一次，SKIP LOCKED 避免并发重复）

幂等键：@mt/utils.idempotencyKey(prefix)，outbox ON CONFLICT DO NOTHING
        消费者可根据事件 id 建立本地去重表
```

### 7.2 三大核心事件契约（跨库直连 processOutbox）

#### ① researcher.response.push（Investigator → Assessor）

```
方向：investigator.outbox → assessor 跨库连接 INVESTIGATOR_DATABASE_URL
触发：Investigator 管理员在 SurveyDetail 点「推送 Assessor」
payload：{
  surveyId, responseId,
  records: [{ question, answer, priority, sentiment, painPoint, expectation }]  // LLM 结构化提取
}
Assessor 消费：批次聚合同 surveyId 的多 response → 生成 Request + 状态 pending_analysis
```

#### ② requirement.created（Assessor → Manager）

```
方向：assessor.outbox → manager 跨库连接 ASSESSOR_DATABASE_URL
触发：Assessor RequestDetail 审核通过 → Push Manager
payload：{
  requestId,
  title, requirement,
  analysisMd,   // LLM 需求分析
  designMd,     // LLM 设计方案
  repoUrl,      // 关联 GitHub 仓库
  reviewComment // 人工审核备注
}
Manager 消费：创建 Requirement（来源=assessor），初始状态待分析
```

#### ③ knowledge.item.collected（Gatherer → Scholar）

```
方向：gatherer.outbox → scholar 跨库连接 GATHERER_DATABASE_URL
触发：Gatherer Item 列表「推送 Scholar」或 Cron 自动审核通过
payload：{
  itemId, url, title, content, summary,
  category, keywords: string[],
  publishedAt
}
Scholar 消费：进入收件箱（InboxService），等待人工审核或自动入库为 Entry
```

### 7.3 需求主线时序图（Mermaid）

```mermaid
sequenceDiagram
    actor 管理员 as Admin
    participant 飞书 as Feishu Bitable
    participant I as Investigator Server
    participant IOutbox as Investigator.outbox
    participant A as Assessor Server
    participant GH as GitHub
    participant LLM as LLM(@mt/model-client)
    participant AOutbox as Assessor.outbox
    participant M as Manager Server

    Note over Admin,Feishu: 外部调研触发
    Admin->>飞书: 配置问卷 → 数据落多维表格
    Admin->>I: SurveyDetail 点「拉取最新」
    I->>飞书: feishu/client 分页拉取(令牌缓存)
    飞书-->>I: 返回原始记录列表
    I->>LLM: chat() 结构化提取\n需求点/痛点/优先级/情绪
    LLM-->>I: records[]
    Admin->>I: 点「推送 Assessor」
    I->>IOutbox: appendOutbox(event="researcher.response.push")\nON CONFLICT DO NOTHING
    Note over IOutbox: ☝️ 异步解耦，无需 Assessor 在线

    loop 每 5s processOutbox 轮询
        A->>IOutbox: SELECT ... FROM outbox\nWHERE status IN (pending,retry)\nAND attempts<5 FOR UPDATE SKIP LOCKED
        IOutbox-->>A: 返回批量事件
    end
    A->>A: 聚合同 surveyId 多 response → Request(pending_analysis)
    A->>GH: client.getRepoContext(repoUrl)\nREADME + 目录树 + 语言分布
    GH-->>A: 返回仓库上下文
    A->>LLM: chat() 生成 analysisMd + designMd + 验收标准
    LLM-->>A: markdown 分析 + 方案文本
    Admin->>A: RequestDetail 人工审核通过
    A->>AOutbox: appendOutbox(event="requirement.created")\npayload含分析/方案/仓库地址
    Note over AOutbox: ☝️ 第二环事件输出

    loop 每 5s Manager 侧 processOutbox
        M->>AOutbox: 跨库连接 ASSESSOR_DATABASE_URL 轮询
        AOutbox-->>M: 返回 requirement.created 事件
    end
    M->>M: 创建 Requirement(初始状态 待分析，来源=assessor)\n状态机开始流转
    Admin->>M: 后续生命周期：设计中→待开发→开发中→测试中→待验收→已完成
```

### 7.4 知识主线时序图（Mermaid）

```mermaid
sequenceDiagram
    actor 用户 as User
    participant Src as 信息源<br/>(RSS/JSON/网页)
    participant G as Gatherer Server
    participant LLM as LLM(@mt/model-client)
    participant GOutbox as Gatherer.outbox
    participant S as Scholar Server
    participant C as Assistant Server
    participant CC as cybercloud

    Note over Src,GOutbox: 第一环：采集 → 推送
    loop Cron 调度 or 手动试采
        G->>Src: rss-parser / cheerio 选择器 / fetch JSON
        Src-->>G: 原始内容 feed[]
    end
    G->>G: contentFingerprint(SHA-256)\n去重过滤
    G->>LLM: chat() 富化：标题/摘要/分类/关键词
    LLM-->>G: 结构化 item
    G->>GOutbox: appendOutbox(event="knowledge.item.collected")\npayload含 itemId/url/title/summary/category/keywords
    Note over GOutbox: ☝️ 异步，Scholar 离线也不丢

    loop 每 5s Scholar 侧 processOutbox
        S->>GOutbox: 跨库 GATHERER_DATABASE_URL 轮询(含 skip locked)
        GOutbox-->>S: 批量事件
    end
    S->>S: InboxService 收件箱入库，等待人工审核通过
    用户->>S: 点「纳入馆藏」/ 设置自动入库
    S->>S: EntryService 生成条目 → SearchService 双通道
    S->>LLM: embed() 生成 1024 维向量写入 embedding 列
    LLM-->>S: vector
    用户->>S: GraphService 抽取图谱 / 勾选 圈定

    Note over C,CC: 第三环：Assistant 问答闭环
    用户->>C: ChatPage 提问
    C->>C: IntentService 双层路由\n(系统归属 → 域内意图)\n→ 判定 product_inquiry
    C->>S: KnowledgeService 跨库 SCHOLAR_DATABASE_URL\n查询 圈定=true 的 entry 集合
    S-->>C: 返回命中条目(title, content 片段)
    C->>LLM: chat(system+引用条目+用户问题) 生成答案\n要求在末尾附引用来源
    LLM-->>C: 回答 + 引用链接
    C-->>用户: ChatPage 气泡 + 虚线引用区展示

    alt 其他意图分流
        用户->>C: 提问「本月销售额多少」→ data_query
        C->>CC: CybercloudService JWT 认证+智能体对话
        CC-->>C: 返回业务数据回答
        C-->>用户: 数据查询结果
    else process_execution
        用户->>C: 「帮我创建一个 xxx 需求」
        C->>G: ActionService 经 gateway 转发 REST\nPOST /api/manager/requirements
    else trouble_shooting
        C->>C: TroubleService 聚合 8 服务 /health
        C->>LLM: chat() 生成排查建议
    else complaint_feedback
        用户->>C: FeedbackPage 提交反馈
        C->>C: FeedbackService 落库 feedback 表
    end
```

---
