# P14 真实页面样板设计

> 设计状态：历史设计基线。当前实现以源码、docs/code-wiki/ 与 docs/generated/ 为准，本文件保留当时的设计动机和验收边界。

## 目标

让 E2E 视觉与键盘回归基于固定业务内容运行，避免“空库 + 核心区遮罩”只验证页面外壳。首批覆盖 Manager 详情、Assistant 长对话和 Scholar 帮助目录。

## 方案

样板数据通过公开 API 创建并按固定标题幂等复用，不直接写库。视觉套件先初始化数据并取得真实 Manager 需求 ID、Assistant 会话 ID，再填充动态路由。页面映射为样板声明核心业务文案，截图前必须可见；Manager 看板与 Scholar 目录不再把业务区整体 mask。

Assistant 增加 `conversation` 查询参数装载历史会话；会话条目补键盘语义。桩模式知识回答输出固定三段发布校验要点并回显检索上下文，保证长答案稳定且明确不是真实模型效果。

## 验收

- 视觉基线 20 张，其中 Manager 详情与 Assistant 长答案为新增；
- 核心业务文案缺失时视觉用例失败；
- Manager 卡片、Assistant 会话、Scholar 检索可用键盘操作；
- 全量功能 E2E、响应式巡检、目标单测和 `qa:gate` 通过；
- Linux 基线合入 main 后由既有 workflow 重新生成。
