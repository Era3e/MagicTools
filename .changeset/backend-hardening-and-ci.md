---
"@mt/model-client": minor
"@mt/db": patch
"@mt/applicant-server": patch
"@mt/gatherer-server": patch
"@mt/investigator-server": patch
"@mt/assessor-server": patch
"@mt/assistant-server": patch
"@mt/designer-server": patch
"@mt/scholar-server": patch
---

后端健壮性与工程化收尾：

- `@mt/model-client` 新增健壮 `parseJson`（容错无引号键 / 代码围栏 / 夹杂文字），applicant/gatherer/investigator/assessor/scholar 服务替换裸 `JSON.parse`，规避 LLM 非法输出导致 500；assistant/designer 本地 `json.ts` 改为 re-export；
- `@mt/db` outbox 失败达 `maxAttempts` 进入 `dead` 终态；
- 前端合并 applicant 冗余 api 层、ChatPage 自动滚动、清理硬编码色值；
- CI 合并重复 build 步骤并缓存 turbo 构建；新增 `pnpm test:affected`（`turbo run test --affected`）作为回归层。
