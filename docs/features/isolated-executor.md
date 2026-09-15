# 隔离编码执行器

P23 在 P22 的 execution job 租约之上接入真实执行编排。执行器是独立 CLI，不入驻 Manager 进程；它领取任务后创建独立编码工作区，把需求上下文写给编码 CLI，再从候选 SHA 克隆独立验收工作区执行契约命令，最后推送分支并创建 PR。

## 入口与配置

```powershell
# 只检查配置，不领取任务、不访问外部 GitHub、不运行编码 CLI
pnpm executor --check-config

# 处理一个任务后退出，适合计划任务或容器 Job
$env:MT_EXECUTOR_ONCE = "1"
pnpm executor
```

| 变量 | 必填 | 说明 |
|---|---:|---|
| `MT_EXECUTOR_MANAGER_URL` | 是 | Manager API base，例如 `http://127.0.0.1:5004/api/manager` |
| `MT_EXECUTOR_MANAGER_TOKEN` | 是 | 与 Manager `MANAGER_EXECUTOR_TOKEN` 一致，至少 32 字符 |
| `MT_EXECUTOR_GITHUB_TOKEN` | 是 | 仅执行器进程持有的 GitHub 写令牌，至少 32 字符 |
| `MT_EXECUTOR_CODER_COMMAND` | 是 | JSON 字符串数组，例如 `["codex","exec","--sandbox","workspace-write"]` |
| `MT_EXECUTOR_WORKSPACE_ROOT` | 否 | 运行输出根目录，默认 `.executor-runs` |
| `MT_EXECUTOR_BASE_BRANCH` | 否 | 默认 `main` |
| `MT_EXECUTOR_ID` | 否 | 默认 `magictools-executor` |
| `MT_EXECUTOR_LEASE_MILLISECONDS` | 否 | 默认 60000 |
| `MT_EXECUTOR_HEARTBEAT_MILLISECONDS` | 否 | 默认 20000 |

`MT_EXECUTOR_CODER_COMMAND` 没有 shell 包装，数组中的每个元素都是一个 argv。执行器把工作区路径写入 `MT_EXECUTOR_WORKSPACE`，任务 JSON 路径写入 `MT_EXECUTOR_TASK`，并以编码工作区为 cwd。

## 任务文件

领取响应包含 job/run 身份、一次性 run token、需求标题、描述、范围、验收标准和执行契约。执行器写入 `workspace/task.json`：

```json
{
  "schema": "magictools-executor-task/1",
  "jobId": "uuid",
  "runId": "uuid",
  "requirement": {
    "title": "需求标题",
    "description": "需求描述",
    "scope": "范围",
    "acceptanceCriteria": ["验收条件"]
  },
  "contract": {
    "repository": "https://github.com/owner/repo",
    "allowedPaths": ["apps/example/server/src"],
    "acceptanceCommands": [["pnpm", "test"]],
    "maxDurationMinutes": 30,
    "maxAttempts": 2
  }
}
```

## 进程与秘密边界

编码和验收子进程使用新的环境表，只保留运行必需的 `PATH/PATHEXT/SystemRoot/LANG/TZ` 等键；`HOME/USERPROFILE/APPDATA/LOCALAPPDATA/TMP` 全部指向本次运行目录。执行器不透传 `GITHUB_TOKEN`、Manager token、模型 key、部署 secret、CI identity 或 SSH agent。

编码工作区还固定：

- `GIT_CONFIG_GLOBAL` 与 `GIT_CONFIG_SYSTEM` 指向本次运行的空文件；
- `GIT_TERMINAL_PROMPT=0`；
- 本仓库提交身份 `MagicTools Executor <executor@magictools.local>`；
- 空 hooks 目录，避免执行宿主 Git 钩子。

因此本批能保证秘密不进入编码进程和工作区。它不是对抗恶意进程的操作系统级强沙箱；如果编码 CLI 不可信，应把执行器放入独立容器或 VM，再由该边界切断宿主文件系统和网络凭据。

## 候选与独立验收

1. 执行器先读取 GitHub base 分支 SHA，并克隆该 SHA。
2. 编码 CLI 退出后，执行器收集 tracked 与 untracked 改动。
3. 空提交、超过 500 个文件、单个超过 10MB 的文件、符号链接、以及不在 `allowedPaths` 内的路径都会失败。
4. 通过边界检查后创建候选提交，记录 candidate SHA。
5. 执行器从本地候选 SHA 克隆 `workspace/acceptance`，确认 `HEAD` 等于 candidate SHA 后才执行验收命令。
6. 所有命令退出码为 0 才进入发布阶段。

验收命令同样使用白名单环境，并且不在编码工作区执行；命令产物无法通过污染原工作区伪造通过结果。

## 证据与 PR

每次运行输出：

- `evidence/evidence.json`：schema、job/run/revision/attempt、base/candidate SHA、实际改动、分支、PR、环境键名、每个阶段状态与输出哈希；
- `evidence/coder.log`、`evidence/acceptance.log`：截断后的 stdout/stderr 诊断；
- 失败时另写 `evidence/failure.json`，包含失败阶段和脱敏错误。

Manager 成功结果保存 evidence JSON 的路径与 SHA256，并受 20KB 响应限制约束。执行器推送 `auto/req-<short-id>/r<content-revision>`，复用已打开 PR 或创建新 PR。PR body 记录 base/candidate SHA、允许路径、实际改动和验收命令；合并仍由现有分支保护和 quality/smoke/e2e 检查决定。

## 验证与边界

基础设施测试覆盖环境白名单、超时终止子孙进程、候选提交、路径边界、独立验收 SHA、成功回写和越界不发布。Manager 真实数据库用例验证 claim 响应携带需求上下文。本批的本地测试没有调用真实 Codex CLI，也没有向 GitHub 创建生产 PR；相关结论为 `not-run`。通知、进度展示和条件自动合并分别留给 P24/P25。
