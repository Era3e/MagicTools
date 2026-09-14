# 依赖关系全景

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 15. 依赖关系全景图

### 15.1 Workspace 包依赖 DAG

```
@mt/types ○─── 无内部依赖（原子）
    ↑
@mt/utils (depends on: types? No，无内部依赖)
    ↑
@mt/db  (depends on: @mt/types)
    ↑
@mt/config  (无内部依赖，dotenv + yaml + zod)
    ↑
@mt/model-client  (无内部依赖，纯 fetch)
    ↑
@mt/ui  (peer react + antd，无 workspace 依赖)
    ↑
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8 子项目 server 统一依赖：
  @mt/config + @mt/types + @mt/db + @mt/model-client
  (+ 可选 @mt/utils，gatherer/investigator/assessor/manager 用)

8 子项目 web 统一依赖：
  @mt/ui (peer: antd + react)
  (+ react-router-dom 路由)

Designer server 额外依赖 @mt/ui（后端用 esbuild 预览组件）
```

### 15.2 子项目跨库依赖（DATABASE_URL 直连）

```
investigator.outbox
    ↓ (INVESTIGATOR_DATABASE_URL)
assessor → assessor.outbox
    ↓ (ASSESSOR_DATABASE_URL)
manager

gatherer.outbox
    ↓ (GATHERER_DATABASE_URL)
scholar.entry + scholar.search
    ↓ (SCHOLAR_DATABASE_URL)
assistant.knowledge
```

### 15.3 外部系统集成矩阵

| 外部系统 | 对接子项目 | 集成文件 | 凭证来源 | 桩模式 |
|---|---|---|---|---|
| 飞书开放平台（Bitable + Bot） | investigator | feishu/client.ts | FEISHU_APP_ID/SECRET/BOT | FEISHU_STUB=1 |
| ClawCV 超级简历 API | applicant | clawcv/client.ts + fallback.ts | CLAWCV_API_KEY/BACKEND_URL | 无 Key 自动 fallback LLM → 桩 |
| cybercloud 智能体平台 | assistant | cybercloud.service.ts | CYBERCLOUD_BASE/API_KEY/AGENT_ID/CREDENTIALS | CYBERCLOUD_STUB=1 |
| GitHub REST API（README / 目录 / Issues） | assessor + manager | github/client.ts（两处） | 无 Key（匿名限流） | GITHUB_STUB=1 |
| Docker Hub（pgvector 镜像） | 全平台 | infra/docker-compose.dev.yml | 无 | — |
| 阿里云 ACR（镜像仓库） | 部署 | CI images job + deploy.ps1 | REGISTRY_HOST/USERNAME/PASSWORD（Secrets） | 未配置自动跳过 |
| Obsidian Vault 本地目录 | scholar | obsidian.service.ts | 本地文件系统权限（Vault 路径配置） | — |
| DeepSeek + 智谱 LLM | 8 子项目 llm.ts | model-client client.ts | DEEPSEEK_API_KEY + ZHIPU_API_KEY | MT_LLM_STUB=1 |

---
