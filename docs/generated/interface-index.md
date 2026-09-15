# MagicTools 接口索引

> 自动生成文件：请修改事实源后运行 `pnpm docs:facts`，不要手工编辑。
> 来自 React Route 与 Nest Controller 源码扫描；路由或接口变更后必须重新生成。

## gateway

模块文档：[docs/code-wiki/gateway.md](../code-wiki/gateway.md)

### 入口与服务 API

| 方法 | 路径 |
|---|---|
| GET | `/health` |
| GET | `/ready` |
| GET | `/api/health` |
| GET | `/status` |
| GET | `/` |
| GET | `/login` |
| POST | `/login` |
| POST | `/logout` |
| GET | `/gatherer` |
| ALL | `/gatherer/*` |
| ALL | `/api/gatherer/*` |
| GET | `/investigator` |
| ALL | `/investigator/*` |
| ALL | `/api/investigator/*` |
| GET | `/assessor` |
| ALL | `/assessor/*` |
| ALL | `/api/assessor/*` |
| GET | `/manager` |
| ALL | `/manager/*` |
| ALL | `/api/manager/*` |
| GET | `/designer` |
| ALL | `/designer/*` |
| ALL | `/api/designer/*` |
| GET | `/scholar` |
| ALL | `/scholar/*` |
| ALL | `/api/scholar/*` |
| GET | `/assistant` |
| ALL | `/assistant/*` |
| ALL | `/api/assistant/*` |
| GET | `/applicant` |
| ALL | `/applicant/*` |
| ALL | `/api/applicant/*` |

## applicant

模块文档：[docs/code-wiki/applicant.md](../code-wiki/applicant.md)

### 页面路由

| 路由 |
|---|
| `/` |
| `/positions` |
| `/positions/:id` |
| `/positions/:id/interviews` |
| `/calendar` |
| `/resumes` |
| `/admin/*` |
| `/admin` |
| `/admin/positions` |

### 服务 API

| 方法 | 路径 |
|---|---|
| GET | `/api/applicant/health` |
| GET | `/api/applicant/health/ready` |
| GET | `/api/applicant/positions/:positionId/interviews` |
| GET | `/api/applicant/interviews` |
| PATCH | `/api/applicant/interviews/:id` |
| POST | `/api/applicant/positions/:positionId/interviews` |
| POST | `/api/applicant/interviews/:id/analyze` |
| GET | `/api/applicant/interviews/:id/export.md` |
| POST | `/api/applicant/positions/parse-jd` |
| POST | `/api/applicant/positions/:id/greeting` |
| POST | `/api/applicant/positions/parse-image` |
| GET | `/api/applicant/positions` |
| GET | `/api/applicant/positions/:id` |
| POST | `/api/applicant/positions` |
| PATCH | `/api/applicant/positions/:id` |
| GET | `/api/applicant/resumes` |
| POST | `/api/applicant/resumes` |
| POST | `/api/applicant/resumes/:id/analyze` |
| POST | `/api/applicant/resumes/:id/rewrite` |
| POST | `/api/applicant/resumes/:id/match/:positionId` |
| GET | `/api/applicant/meta/quota` |

## assessor

模块文档：[docs/code-wiki/assessor.md](../code-wiki/assessor.md)

### 页面路由

| 路由 |
|---|
| `/admin` |
| `/admin/requests` |
| `/admin/requests/:id` |
| `/admin/repository-evidence` |
| `/` |
| `/requests` |
| `/requests/:id` |
| `/admin/*` |

### 服务 API

| 方法 | 路径 |
|---|---|
| GET | `/api/assessor/health` |
| GET | `/api/assessor/health/ready` |
| POST | `/api/assessor/repository-evidence/reverse-engineer` |
| GET | `/api/assessor/repository-evidence/tasks` |
| GET | `/api/assessor/repository-evidence/tasks/:id` |
| POST | `/api/assessor/inbox/poll` |
| GET | `/api/assessor/requests` |
| GET | `/api/assessor/requests/:id` |
| PATCH | `/api/assessor/requests/:id` |
| POST | `/api/assessor/requests/:id/generate` |
| POST | `/api/assessor/requests/:id/review` |
| POST | `/api/assessor/requests/:id/push` |
| GET | `/api/assessor/meta/github-status` |

## assistant

模块文档：[docs/code-wiki/assistant.md](../code-wiki/assistant.md)

### 页面路由

| 路由 |
|---|
| `/` |
| `/chat` |
| `/feedback` |
| `/intent-logs` |
| `/admin/*` |
| `/admin` |
| `/admin/feedback` |
| `/admin/badcases` |
| `/admin/intent-logs` |

### 服务 API

| 方法 | 路径 |
|---|---|
| GET | `/api/assistant/badcases` |
| GET | `/api/assistant/badcases/:id` |
| POST | `/api/assistant/badcases/from-feedback/:feedbackId` |
| POST | `/api/assistant/badcases/from-evaluation/:runId/:caseKey` |
| POST | `/api/assistant/badcases/:id/confirm` |
| POST | `/api/assistant/badcases/:id/regression` |
| POST | `/api/assistant/badcases/:id/requirement` |
| POST | `/api/assistant/badcases/:id/close` |
| POST | `/api/assistant/chat` |
| GET | `/api/assistant/chat/verify/:taskId` |
| GET | `/api/assistant/conversations` |
| GET | `/api/assistant/conversations/:id/messages` |
| DELETE | `/api/assistant/conversations/:id` |
| GET | `/api/assistant/evaluation-suite/cases` |
| POST | `/api/assistant/evaluation-suite/runs` |
| GET | `/api/assistant/evaluation-suite/runs` |
| GET | `/api/assistant/evaluation-suite/runs/:id` |
| POST | `/api/assistant/evaluation-suite/runs/:baselineId/compare/:currentId` |
| GET | `/api/assistant/feedback` |
| DELETE | `/api/assistant/feedback/:id` |
| GET | `/api/assistant/health` |
| GET | `/api/assistant/health/ready` |
| GET | `/api/assistant/intent-logs` |
| POST | `/api/assistant/intent-logs/:id/correct` |
| GET | `/api/assistant/intent-logs/evaluation` |
| GET | `/api/assistant/intent-logs/evaluation/replay` |
| GET | `/api/assistant/intent-logs/export` |
| POST | `/api/assistant/intent-logs/export/preview` |
| GET | `/api/assistant/intent-logs/finetune/status` |
| POST | `/api/assistant/intent-logs/finetune` |
| GET | `/api/assistant/meta/data-source-status` |
| GET | `/api/assistant/meta/cybercloud-calls` |

## designer

模块文档：[docs/code-wiki/designer.md](../code-wiki/designer.md)

### 页面路由

| 路由 |
|---|
| `/admin` |
| `/admin/components` |
| `/admin/history` |
| `/` |
| `/generate` |
| `/studio` |
| `/components` |
| `/history` |
| `/admin/*` |

### 服务 API

| 方法 | 路径 |
|---|---|
| POST | `/api/designer/components` |
| GET | `/api/designer/components` |
| GET | `/api/designer/components/:id/code` |
| DELETE | `/api/designer/components/:id` |
| POST | `/api/designer/generate` |
| GET | `/api/designer/generations` |
| GET | `/api/designer/health` |
| GET | `/api/designer/health/ready` |
| POST | `/api/designer/parse` |
| POST | `/api/designer/preview` |
| GET | `/api/designer/preview/:id` |
| POST | `/api/designer/components/:id/publish` |

## gatherer

模块文档：[docs/code-wiki/gatherer.md](../code-wiki/gatherer.md)

### 页面路由

| 路由 |
|---|
| `/admin` |
| `/admin/sources` |
| `/admin/sources/:id` |
| `/` |
| `/sources` |
| `/sources/:id` |
| `/sources/:sourceId/items` |
| `/admin/*` |

### 服务 API

| 方法 | 路径 |
|---|---|
| GET | `/api/gatherer/health` |
| GET | `/api/gatherer/health/ready` |
| GET | `/api/gatherer/sources` |
| GET | `/api/gatherer/sources/:id` |
| POST | `/api/gatherer/sources` |
| PATCH | `/api/gatherer/sources/:id` |
| POST | `/api/gatherer/sources/:id/test` |
| POST | `/api/gatherer/sources/:id/collect` |
| GET | `/api/gatherer/items` |
| POST | `/api/gatherer/items/push` |
| GET | `/api/gatherer/meta/scheduler-status` |
| GET | `/api/gatherer/meta/dead-letters` |

## investigator

模块文档：[docs/code-wiki/investigator.md](../code-wiki/investigator.md)

### 页面路由

| 路由 |
|---|
| `/admin` |
| `/admin/surveys` |
| `/admin/surveys/:id` |
| `/` |
| `/surveys` |
| `/surveys/:id` |
| `/admin/*` |

### 服务 API

| 方法 | 路径 |
|---|---|
| GET | `/api/investigator/health` |
| GET | `/api/investigator/health/ready` |
| GET | `/api/investigator/surveys` |
| GET | `/api/investigator/surveys/:id` |
| POST | `/api/investigator/surveys` |
| PATCH | `/api/investigator/surveys/:id` |
| GET | `/api/investigator/meta/feishu-status` |
| POST | `/api/investigator/surveys/:id/sync` |
| GET | `/api/investigator/surveys/:id/responses` |
| POST | `/api/investigator/surveys/:id/summarize` |
| POST | `/api/investigator/surveys/:id/push` |
| POST | `/api/investigator/surveys/:id/send-link` |
| GET | `/api/investigator/meta/scheduler-status` |

## manager

模块文档：[docs/code-wiki/manager.md](../code-wiki/manager.md)

### 页面路由

| 路由 |
|---|
| `/` |
| `/requirements` |
| `/requirements/:id` |
| `/iterations` |
| `/admin/*` |
| `/admin` |
| `/admin/requirements` |
| `/admin/requirements/:id` |
| `/admin/iterations` |

### 服务 API

| 方法 | 路径 |
|---|---|
| GET | `/api/manager/health` |
| GET | `/api/manager/health/ready` |
| POST | `/api/manager/import-batches/preview` |
| GET | `/api/manager/import-batches/:id` |
| POST | `/api/manager/import-batches/:id/confirm` |
| POST | `/api/manager/import-batches/:id/remaining-preview` |
| GET | `/api/manager/capabilities` |
| GET | `/api/manager/iterations` |
| POST | `/api/manager/iterations` |
| GET | `/api/manager/meta/approval-policy` |
| POST | `/api/manager/requirements/:id/approve-revision` |
| POST | `/api/manager/requirements/:id/revoke-approval` |
| GET | `/api/manager/requirements/:id/approvals` |
| POST | `/api/manager/inbox/poll` |
| GET | `/api/manager/requirements` |
| GET | `/api/manager/requirements/:id` |
| GET | `/api/manager/requirements/:id/execution-eligibility` |
| GET | `/api/manager/requirements/:id/revisions` |
| POST | `/api/manager/requirements` |
| POST | `/api/manager/requirements/assistant-badcases` |
| PATCH | `/api/manager/requirements/:id` |
| POST | `/api/manager/requirements/:id/refresh-pr` |
| POST | `/api/manager/sync/github` |
| POST | `/api/manager/webhook/github` |

## scholar

模块文档：[docs/code-wiki/scholar.md](../code-wiki/scholar.md)

### 页面路由

| 路由 |
|---|
| `/` |
| `/entries` |
| `/search` |
| `/graph` |
| `/settings` |
| `/admin/*` |
| `/admin` |
| `/admin/settings` |
| `/admin/code-index` |
| `/admin/entries` |

### 服务 API

| 方法 | 路径 |
|---|---|
| GET | `/api/scholar/entries/search` |
| GET | `/api/scholar/entries` |
| GET | `/api/scholar/entries/:id` |
| POST | `/api/scholar/entries` |
| PATCH | `/api/scholar/entries/:id` |
| POST | `/api/scholar/entries/scope-category` |
| GET | `/api/scholar/graph` |
| POST | `/api/scholar/graph/generate` |
| GET | `/api/scholar/health` |
| GET | `/api/scholar/health/ready` |
| POST | `/api/scholar/inbox/poll` |
| GET | `/api/scholar/spaces` |
| POST | `/api/scholar/spaces` |
| PUT | `/api/scholar/spaces/:key/members` |
| DELETE | `/api/scholar/spaces/:key/members/:userId` |
| GET | `/api/scholar/spaces/:key/entries` |
| POST | `/api/scholar/spaces/:key/versions` |
| GET | `/api/scholar/versions/:id` |
| POST | `/api/scholar/versions/:id/publish` |
| GET | `/api/scholar/public/version/current` |
| GET | `/api/scholar/public/entries/search` |
| POST | `/api/scholar/public/search` |
| GET | `/api/scholar/public/entries` |
| GET | `/api/scholar/public/entries/:id` |
| POST | `/api/scholar/entries/:id/requirement-links` |
| POST | `/api/scholar/entries/:id/unpublish` |
| DELETE | `/api/scholar/entries/:id` |
| GET | `/api/scholar/settings` |
| PATCH | `/api/scholar/settings` |
| POST | `/api/scholar/sync/obsidian` |
| GET | `/api/scholar/sync/conflicts` |
| POST | `/api/scholar/sync/conflicts/:entryId/resolve` |
| POST | `/api/scholar/sync/conflicts/batch-resolve` |
| GET | `/api/scholar/meta/embedding-status` |
