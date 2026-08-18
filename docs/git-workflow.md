# Git 工作流与分支管理规范

## 分支模型

- main：生产（合并触发打镜像 + 迭代日志）
- dev：集成（PR 合并目标，CI 全绿后方可再合 main）
- feat-<项目>-<任务ID>-<描述>：开发分支（绑任务不绑对话）

## 并行开发（worktree）

一个任务一个 worktree，主仓库保持干净：

pnpm ws:create <项目> <任务ID>
pnpm ws:cleanup <项目> <任务ID>

## 分支清理四层机制

1. GitHub 仓库设置开启 "Automatically delete head branches"（PR 合并即删远程分支）；
2. CI 定时 GC（.github/workflows/branch-gc.yml，每周清理已合并/孤儿 feat 分支）；
3. 会话收尾协议（见下）；
4. 分支名携带任务 ID，Manager 任务关闭联动清理。

## 会话收尾协议（每个开发会话结束时强制执行，未完成视为会话未结束）

- [ ] 代码已提交且测试通过（pnpm qa:gate 全绿）
- [ ] 已推送并创建 PR（或合并）
- [ ] PR 合并后 worktree 已清理（pnpm ws:cleanup）
- [ ] docs/memory/ 已更新
- [ ] changeset 迭代日志已添加

## 仓库设置清单（GitHub 手工开启一次）

- main/dev 分支保护：require PR + review + status checks（CI 3 jobs）
- Automatically delete head branches
- Secrets：REGISTRY_HOST / REGISTRY_USERNAME / REGISTRY_PASSWORD / DEPLOY_SSH_KEY 等
