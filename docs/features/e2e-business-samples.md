# E2E 真实页面样板

P14 为视觉与键盘回归提供稳定业务数据，解决空库截图只能验证外壳、核心业务区被整块遮罩的问题。样板覆盖 Manager 需求看板与详情档案、Assistant 带引用的长答案会话、Scholar 用户帮助目录。

## 数据边界

样板只在 Playwright 视觉套件初始化时创建，通过各应用公开 API 幂等写入，不直接连业务库，也不改变开发、演示或生产默认数据。重复运行时先按固定标题查找，存在则复用；Manager 样板会沿合法状态迁移归位到 `developing`，已进入 `done` 的同名记录会显式失败，避免静默改写业务状态。

Assistant 样板问题会检索并引用 Scholar 固定帮助条目。`MT_LLM_STUB=1` 下的知识回答保留发布前、发布中、发布后三段固定要点和检索上下文，保证长答案截图可复现，同时不冒充真实模型效果。

## 视觉防线

`e2e/fixtures/pages.ts` 是页面清单唯一来源，基线从 18 张扩展到 20 张：

- Manager 详情：由初始化用例获取真实需求 ID 后填充路由；
- Assistant 长答案：通过 `?conversation=<id>` 自动装载历史消息；
- Manager 看板与 Scholar 目录：撤掉核心业务区整块遮罩，仅保留必要的动态等待。

每个样板页声明 `coreText`。截图前必须看到固定业务内容；看板泳道、详情正文、馆藏行或长答案缺失时，测试在像素比对前失败。视觉基线仍按平台分文件，Windows 基线随本 PR 更新；合入 main 后需手动触发 `visual-baseline` workflow 重新生成 Linux 基线。

## 键盘导航

Assistant 会话条目暴露 `role=button`、`tabIndex` 与 Enter/Space 激活；`/assistant/chat?conversation=<id>` 可直接打开指定历史会话，便于截图和分享复现路径。

`e2e/tests/business-keyboard.spec.ts` 覆盖三条真实链路：Manager 样板卡片聚焦后按 Enter 进入详情；Assistant 样板会话聚焦后按 Enter 装载长答案；Scholar 检索框输入关键词后固定帮助条目仍可见。

响应式巡检保留全站几何检查。两条依赖运行时真实 ID 的 Manager 详情样板项在响应式套件中显式 skip，避免重复造数；Assistant 样板页仍参与移动与平板检查。
