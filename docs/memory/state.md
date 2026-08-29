# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目设计文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。
> 本文件定位「当前状态快照」，历史细节见 docs/CHANGELOG.md 与 docs/superpowers/specs/、plans/。

## 当前状态快照（2026-08-29）

- **交付状态**：8 子项目全部交付。需求主线三环（Investigator → Assessor → Manager）、知识主线（Gatherer → Scholar → Assistant）、Designer（降级版）均完成；Assistant 意图路由扩至 6 类并完成 cybercloud 真实对接（testcybercloud-dev 实测打通）。
- **工程化基座**：Monorepo（pnpm + turbo）+ 网关 + outbox + 幂等 + CI/CD + Docker 部署链路；main 分支保护（required checks: quality/smoke/e2e）。
- **D-18 跨平台视觉基线全链路收官（2026-08-29，PR #45 已合并 main 3e674d4）**：
  - **平台感知守卫**：`_visual.spec.ts` 按「运行平台 `-<platform>.png` 后缀计数 ≥16」判定基线齐备，win32/linux 独立互不干扰；`PLAYWRIGHT_UPDATE=1` 为生成模式旁路；
  - **基线生成 workflow**（`visual-baseline.yml`，手动 dispatch）：ubuntu-24.04（与 ci.yml e2e 同口径钉版本，防 latest 滚动漂移）+ fonts-noto-cjk + 全桩服务 → `--update-snapshots` 生成 16 张 → REST 回传分支并复用/开 PR；
  - **回传脚本三轮踩坑链**（infra/scripts/push-visual-baseline.mjs，均已修复并上 main）：①Trees API entry 级 `encoding:"base64"` 是**不存在的字段，被静默忽略**——content 里的 base64 被当 UTF-8 文本原样入库（PNG 变 39KB ASCII，CI 解析必挂，两轮 blob sha 相同即为铁证）；②正确姿势 = **Blobs API 逐张建 blob（官方 base64 语义）→ tree 以 sha 引用**，并加自校验「API sha ≠ 本地 git hash-object 即中止」防再静默坏档；③PR 复用查询 `head` 参数格式必须是**`用户:分支`**（如 `Era3e:feat/x`）而非 `owner/repo:分支`——后者不报错但永远查空 → 误判无 PR → 新建撞 422；
  - **验收**：PR #45（16 张真二进制 linux 基线）CI 三段全绿——**视觉用例首次在 linux 真跑通过**，win32/linux 双平台像素比对闭环打通；基线分支由「自动删除 head」回收，下轮重生成时脚本自动重建；
  - **e2e 两阶段执行**（ci.yml）：视觉快照先在「空库态」单独跑（与基线生成同口径），功能用例 `--grep-invert "视觉快照"` 后跑——消除并发 spec 写库导致的像素漂移假阳性。
- **Release/changesets 链路修复（2026-08-29，Version PR #46 开出）**：
  - **根因一（mixed changeset）**：`all-apps-dual-shell` 等 8 个 changeset 同时含发布包（packages/*）与被忽略的 private 包（apps/* 全部 private:true）→ `changeset version` 报 "Mixed changesets not allowed" exit 1 → Release workflow 全天红（10/10）；修法：8 个剔除私有包行、11 个纯私有包 changeset 直接删除（发布流程里本就不参与）；
  - **根因二（仓库设置）**：changesets/action 需 `Settings → Actions → General → Workflow permissions` 勾选 "Allow GitHub Actions to create and approve pull requests"（用户已配置）；修后 Release attempt=2 转绿，Version PR #46（@mt/ui、@mt/model-client minor + @mt/db patch）自动开出，合并即自动打 tag；
  - **本地教训**：`pnpm release`（=changeset version）是**CI 消费型命令**——本地误跑会把全部 changeset 消费掉（生成 CHANGELOG + 版本号），需 git checkout 整体回滚；验证 changeset 合法性用只读的 `changeset status`。
- **网络与推送经验（本机代理 127.0.0.1:7890 间歇抖动）**：git push/POST 认证请求常挂死（设 GIT_HTTP_LOW_SPEED_LIMIT/TIME 让其快速失败重试），匿名 GET 大多可用；MCP GitHub 通道（push_files/merge 等）全程稳定，为推送降级首选；workflow 触发须**新建 dispatch**（Re-run 会 checkout 旧 commit 跑旧脚本）。
- **本轮改造（2026-08-28，分支 feat-investigator-cron-d11-d16-d17）**：
  - **D-07 P0 兑现**：Investigator 增加 node-cron 定时调度——migrations 003 给 surveys 加 cron 列、package.json 加 node-cron + @types/node-cron、scheduler.ts（参考 gatherer 模式，cron 校验 + 注册 active 调研自动 sync + 状态查询）、main.ts listen 后 startScheduler(app.get(SurveyService))、SurveyService.create/update 校验 cron 合法性、controller 新增 GET meta/scheduler-status API、scheduler.test.ts 3 用例；本地 lint 0 err + test 10/19 pass/skip；
  - **D-11 P0 兑现**：CI quality job 开头新增条件 step（仅 PR 事件触发）检查 0 bug loop 验收记录复选框是否勾选——未勾选则阻断 CI 并提示；PR 模板原已含复选框，此次补自动检测形成闭环；
  - **D-16 P2 兑现**：Designer 前台 USER_NAV 加「组件馆藏」入口 + Route 从 Navigate 改为直接渲染 ComponentList；tsc --noEmit 通过；
  - **D-17 P2 确认已修复**：Assistant ADMIN_NAV 已有「意图日志」菜单（/admin/intent-logs + IntentLogPage 路由存在），2026-08-27 显式 skip 后代码已补齐，无需额外改动；
  - 本地验证：pnpm lint 0 err（2 any warning 遗留）、pnpm test:affected 10/10 成功。
