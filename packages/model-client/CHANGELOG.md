# @mt/model-client

## 0.1.0

### Minor Changes

- 07db4a9: Phase 1 试点：Applicant 求职管理 MVP（岗位/JD 解析/截图识别/面试复盘/简历管理/ClawCV 集成与降级）；@mt/model-client 新增多模态视觉路由。
- 8c4c045: 后端健壮性与工程化收尾：

  - `@mt/model-client` 新增健壮 `parseJson`（容错无引号键 / 代码围栏 / 夹杂文字），applicant/gatherer/investigator/assessor/scholar 服务替换裸 `JSON.parse`，规避 LLM 非法输出导致 500；assistant/designer 本地 `json.ts` 改为 re-export；
  - `@mt/db` outbox 失败达 `maxAttempts` 进入 `dead` 终态；
  - 前端合并 applicant 冗余 api 层、ChatPage 自动滚动、清理硬编码色值；
  - CI 合并重复 build 步骤并缓存 turbo 构建；新增 `pnpm test:affected`（`turbo run test --affected`）作为回归层。

- ced8fef: Phase 2 知识主线收官：Scholar 知识库系统 MVP（gatherer 事件收件箱幂等入库、手动录入与 obsidian vault 同步、pg_trgm 全文 + pgvector 向量双通道检索、LLM 实体关系抽取生成知识图谱、条目级/分类级圈定供 Assistant 查询）；@mt/model-client 新增 embed 向量化方法（智谱 embedding-2，1024 维）。
