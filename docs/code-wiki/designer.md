# Designer 模块

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 6.8 Designer（设计·降级版组件生成器）

**端口**：Web 4005 / Server 5005
**主题**：GALLERY_THEME（画廊风 — Helvetica / 纯白 / 墨黑）

## 后端模块

| 层 | Controller | Service | Repo | 职责 |
|---|---|---|---|---|
| 健康 | HealthController | — | — | — |
| 生成 | GenerateController | GenerateService | GenerationRepo | 自然语言/设计稿图片 → LLM 生成 @mt/ui 组件源码 → 生成记录 |
| 预览 | PreviewController | PreviewService | — | **esbuild 沙箱**编译 React+TSX → 返回可渲染 HTML 字符串供 iframe 预览 |
| 组件库 | ComponentController | ComponentService | ComponentRepo | 审核入库 @mt/ui 候选池 + 组件 CRUD（schema jsonb 列随沉淀落库） |
| 逆向解析 | ParseController | ParseService | — | **@babel/parser 白名单逆向**：POST /parse 把白名单组件源码还原为画布 CanvasDoc（D-02；错误带 reason/line） |
| 发布 | PublishController | PublishService | — | 一键 PR 到 @mt/ui（GitHubClient 三步流，PAT + GITHUB_STUB 桩） |

**画布工坊（2026-09-10 D-01/D-02 兑现）**：canvas/schema.ts 纯函数层（不可变 doc 操作）+ registry.ts 8 组件注册表（div/Card/Typography×3/Button/MtStatusTag/MtEmptyState，容器样式枚举映射 tokens.spacing）+ codegen.ts schema→code 确定性生成器；parse 与 codegen 构成双向编辑闭环。

## 前端路由

```
前台（UserShell /designer）：
  /generate       GeneratePage  画廊委托单（自然语言/图片上传 → 展品卡+预览展位 + 送入画布）
  /studio         StudioPage    画布工坊三栏（palette 拖拽/双击 → 画布真渲染 + 属性面板 + CodePanel 双向编辑）
  /components     ComponentList 组件库列表
  /history        HistoryList   生成历史

后台（AdminShell /designer/admin）：
  /admin/components  ComponentList 组件审核管理
```

---
