# MagicTools 即时记忆（docs/memory）

> 机制说明：本目录是 AI 会话的持久记忆。会话启动协议：先读 AGENTS.md → 本目录 → 相关子项目设计文档。
> 即时更新：每完成一个功能 / 关键决策 / 迭代结束，即刻追加条目，禁止事后批量补记。
> 本文件定位「当前状态快照」，历史细节见 docs/CHANGELOG.md 与 docs/superpowers/specs/、plans/。

## 当前状态快照（2026-09-12 更新）

- **P06合并闭环与CI修复实录（2026-09-12，PR #75 → 6bdfcb5）**：PR #75 首轮 CI quality 43秒即死——根因是D5返工时 auth.test.ts 两处用例遗留未使用的 `const hash`（eslint no-unused-vars 首阶段挂掉；教训：**修复后必须重跑完整 qa:gate，不能依赖修复前的门禁结果**）。本地合并 origin/main（815ede3 版本bump+CHANGELOG，零冲突）后复现修复，途中处置 gatherer-web build `ENOTEMPTY`（29个残留 node 进程锁 dist——**会话收尾必须杀净服务进程**）。qa:gate 7阶段全绿（回执50d80a5b925fff9008a976eb）后推送 2e48974，CI run 34689112392 三段全绿，squash 合并 **6bdfcb5**，本地 main 已同步，分支已删。**合并后 Release #124 422 失败**：P06 changeset 误引用 `"@mt/gateway": patch`——apps/* 私有包（private:true 无 version）不参与发版，`changeset version` no-op → "No commits between main and changeset-release/main"；按 P04 `backup-recovery.md` 空引用先例改为 `---\n---`（仅迭代日志语义，等下个 packages 批次一并消费），737efcf 直推 main（owner bypass PR 规则），Release #125 绿。**main CI #344/#345 四段全绿（quality/smoke/e2e/images）**，P06 完全闭环。**P06 内容**：GATEWAY_USERS 会话登录（scrypt$salt$hex+HMAC Cookie+限流）/GATEWAY_SERVICE_TOKENS 服务身份/GATEWAY_TOKEN 共享三通道；两轮 0 bug loop 验收（首轮 D1 高危 DoS 等五缺陷全修复）。

- **P04合并闭环与本会话接续（2026-09-12）**：本会话按用户授权（无需再逐项确认）核验PR #74验收记录与CI三段绿（quality/smoke/e2e全过，images skipped为无registry预期）后转正并squash合并**761152b**。CI `pull_request` 无 types 限制（默认 opened/synchronize/reopened），ready 转换不触发重跑——head SHA 5986667 上的绿灯即最终核验。PR #73（release）按三件套处理：bot已消费P04 changeset更新head至c1bc361，补body两勾选+close/reopen触发CI（run 34678664848，quality✅/smoke✅/e2e进行中），三段绿后squash。本地main已同步761152b；far只读调研发现P06只读报告（work/P06-权限边界现状与实施建议.md）已随work/目录清理丢失，P系列清单不在仓库/GitHub Issues/本地manager库（旧schema无P数据），以文档证据链（restored-deployment.md:96、runtime-images.md:19、P04 plan:40三处一致）确认P06=生产用户登录与服务权限。
