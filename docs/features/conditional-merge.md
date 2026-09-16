# 低风险需求条件自动合并

P25 在 P23/P24 的“候选执行到 PR、进度与通知闭环”之上增加独立合并服务。它不提升执行器的权限：编码与验收进程仍拿不到 Manager 合并授权或 GitHub 合并令牌；Manager 只提供候选授权事实，独立 CLI 负责核对 GitHub 当前事实并调用普通 merge API。

## 启用边界

```powershell
# 只检查配置，不访问 Manager/GitHub，不合并
pnpm merge:conditional -- --check-config

# 预览所有 Manager 授权候选，输出 blocker/check，不合并
pnpm merge:conditional -- --dry-run

# 处理一个明确 job
pnpm merge:conditional -- --job <execution-job-id>
```

| 变量 | 必填 | 说明 |
|---|---:|---|
| `MT_MERGE_MANAGER_URL` | 是 | Manager API base，例如 `http://127.0.0.1:5004/api/manager` |
| `MT_MERGE_MANAGER_TOKEN` | 是 | 与 Manager `MANAGER_MERGE_TOKEN` 一致，至少 32 字符 |
| `MT_MERGE_GITHUB_TOKEN` | 是 | 独立 GitHub 合并令牌；不得给编码/验收进程 |
| `MT_MERGE_BASE_BRANCH` | 否 | 默认 `main` |
| `MT_MERGE_MAX_CHECK_AGE_MINUTES` | 否 | 默认 1440，范围 5—10080 |

`MANAGER_MERGE_TOKEN`、审批 token 与执行器 token 必须是三个不同秘密。合并服务凭证需要读取 PR、check runs 和分支保护，并用普通 `PUT /pulls/{number}/merge` 合并；它不能关闭分支保护，也不能绕过 required checks。

## 两道授权门

第一道在 Manager 内完成，只读取数据库事实，不触发外部副作用：

1. execution job 必须是 `succeeded`，且存在成功 run 的结构化结果；
2. job 的内容修订仍等于需求当前内容修订，并等于当前批准修订；
3. 需求风险必须是 `low`，状态必须是 `accepting`；
4. Manager 记录的 PR 状态必须是 `open`，且需求 PR URL 与执行结果一致；
5. 结果必须包含 base SHA、candidate SHA、实际改动、PR 编号/链接和分支。

接口：

| 方法 | 路径 | 凭证 |
|---|---|---|
| GET | `/execution-jobs/merge-candidates` | `x-manager-merge-token` |
| GET | `/execution-jobs/:id/merge-authorization` | `x-manager-merge-token` |

第二道在独立 CLI 内完成，所有事实都从 GitHub 当前 API 重新读取：

- PR 必须是同仓库非 fork、非 draft、open、`mergeable=true` 且 `mergeable_state=clean`；
- PR head 分支和 SHA、base 分支和 SHA 必须与 Manager 保存的执行结果完全一致；
- base 分支当前 SHA 必须仍等于执行基线，防止旧候选覆盖新 main；
- PR 文件列表必须与执行器回写的改动集合一致，包含 rename 的旧路径；所有路径必须在执行契约 `allowedPaths` 内；
- `.github/workflows`、迁移、infra、Gateway、数据库包、Assistant 核心问答和身份/权限/密钥类文件一律转人工；
- base 分支必须开启保护，required checks 必须包含 `quality/smoke/e2e`，管理员也不能绕过保护，且禁止 force push；
- head SHA 上必须存在 GitHub Actions 的 `quality/smoke/e2e` 成功 check run，详情链接指向 Actions run，并在配置时限内；
- 合并请求携带精确 candidate SHA；GitHub 响应确认 merged 后再回读 PR，必须看到 `merged=true` 和 merge commit。

任一条件不满足时输出 `action: manual` 与具体 blockers，不把异常当作通过。生产未配置独立 token、未开启上述分支保护或未真实调用 GitHub 时，结论保持 `not-run`。

## 验证与边界

- `infra/scripts/lib/conditional-merge.test.mjs`：配置校验、成功判定、head/base/文件漂移、高风险路径、过期或伪造 check、分支保护缺口、dry-run 不合并与合并后回读；
- `apps/manager/server/src/execution-progress.e2e.test.ts`：真实数据库验证独立 merge token、成功候选授权、候选列表和内容修订变化后的 stale 拒绝；
- 本批没有用生产 GitHub 凭证合并真实 PR；分支保护配置和 token 最小权限需在启用前按仓库实际设置复核。

自动合并只减少低风险候选的等待时间，不替代人工产品验收。合并后 Release、部署、PR merged 事实和需求 `done` 仍按 P24 的分离状态推进。
