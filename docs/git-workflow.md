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

## 仓库设置操作手册（GitHub 手工配置一次）

### 1. 分支保护（main）

1. 打开 https://github.com/Era3e/MagicTools/settings/branches
2. 点 **Add branch protection rule**（新版可能叫 Add classic branch protection rule / Rulesets，二者等效，经典规则最直观）
3. **Branch name pattern** 填 main
4. 勾选：
   - **Require a pull request before merging**；Required approvals 设为 **0**（单人仓库自己 PR 自己合，0 审批只强制 PR 通道）
   - **Require status checks to pass**：搜索并勾选 quality、smoke、e2e（列表只有在 CI 至少跑过一次后才会出现；缺项就先合并一次 PR 再回来补勾）
   - 可选：Require conversation resolution before merging、Do not allow bypassing the above settings
5. 点 **Create** 保存
6. Phase 1 重建 dev 分支后，对 dev 重复同样配置

> 注意：required checks 的名字与 ci.yml 的 job 名一致（quality / smoke / e2e），改名 job 会导致状态检查失效。

### 2. 自动删除已合并分支

1. 打开 https://github.com/Era3e/MagicTools/settings
2. 找到 **Pull Requests** 区，勾选 **Automatically delete head branches**

### 3. Actions Secrets

1. 打开 https://github.com/Era3e/MagicTools/settings/secrets/actions
2. 点 **New repository secret**，逐个添加（值 = 你的真实凭证）：

| Name | 值 | 用途 |
|---|---|---|
| REGISTRY_HOST | 如 registry.cn-hangzhou.aliyuncs.com（不含 https://，不含命名空间） | 镜像仓库域名，最终镜像路径 = <域名>/magictools/<服务名>:latest（magictools 为 ACR 命名空间） |
| REGISTRY_USERNAME | 阿里云 ACR 用户名 | images job 登录 |
| REGISTRY_PASSWORD | ACR 密码/访问凭证 | images job 登录 |
| DEPLOY_SSH_KEY | ECS 私钥 | 部署脚本（Phase 1 用） |
| FEISHU_APP_ID / FEISHU_APP_SECRET | 见 docs/integrations/feishu-setup.md | Investigator（Phase 1） |
| DEEPSEEK_API_KEY / ZHIPU_API_KEY | 大模型密钥 | 各子项目 LLM |

> 未配置 REGISTRY_HOST 时 images job 自动跳过（已内置守卫）；配置后 main 合并即自动构建推送镜像。
>
> 镜像仓库推荐用阿里云容器镜像服务 ACR（个人版免费）：控制台 → 容器镜像服务 → 个人版实例 → 命名空间 → 创建名为 **magictools** 的命名空间（类型选公开或私有均可，个人使用选私有即可），REGISTRY_HOST 填个人版固定域名 registry.cn-hangzhou.aliyuncs.com；ECS 上 docker login 该域名后即可拉取。
