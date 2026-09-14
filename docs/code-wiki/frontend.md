# 前端体系

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 8. 前端体系设计

> 📎 **本节主文档为 [docs/ui-spec.md](../../docs/ui-spec.md)。本节为速查摘要版：覆盖规范、路由划分、主题对照表 + 新增 Mermaid 组件结构图。若涉及设计令牌新增、外壳 Props 变更、新应用主题，请优先修改 ui-spec.md 后同步回本节。**

### 8.1 强制规范（ui-spec.md）

1. 入口必须包裹 `<MtThemeProvider>`（Vite 模板已内置）
2. 颜色一律 `tokens.color.xxx`，**禁止业务硬编码色值**
3. 空数据必须 `<MtEmptyState>`（title 必填；自定义操作按钮传 `actionText` + `onAction` 两参数协作）
4. 新通用组件先提 PR 沉淀到 packages/ui，评审后供全平台复用
5. 有终端用户 + 配置管理场景的应用，**必须拆分前后台双外壳**（禁止共用一套导航）

### 8.2 前后台路由划分规则

- **前台路由**：`/<name>/<page>` — UserShell 包裹，按应用定制主题
- **后台路由**：`/<name>/admin/<page>` — AdminShell 包裹，全平台统一控制台风
- App.tsx 判断：`isAdmin = location.pathname.startsWith("/admin")` 二选一渲染
- 互跳：UserShell 页脚 `adminPath="/admin/xxx"` + AdminShell 侧栏底部 `frontPath="/xxx"`

> ⚠️ **硬约束**：`AdminShell` 全平台统一控制台风，**不接受 theme 参数**，禁止在后台页面做个性化外壳定制。
> ⚠️ **架构约定**：三外壳均为**受控组件**（通过 props `onNavigate` 回调通知上层路由切换），`@mt/ui` 包本身**不依赖 react-router**，保持零路由耦合。

### 8.2.1 前端双外壳组件结构图（Mermaid）

```mermaid
graph TD
    classDef root fill:#f0f5ff,stroke:#2f54eb,stroke-width:2px
    classDef shell fill:#fff4e6,stroke:#faad14,stroke-width:2px
    classDef route fill:#f6ffed,stroke:#52c41a,stroke-width:1px
    classDef page fill:#ffffff,stroke:#8c8c8c,stroke-width:1px

    Entry[main.tsx 入口]:::root -->|包裹| T[MtThemeProvider<br/>(AntD ConfigProvider + tokens)]:::root
    T -->|挂载 basename=/<name>/| R[BrowserRouter<br/>react-router-dom]:::root
    R -->|根组件| App[App.tsx Shell 选择器]

    App -->|location.startsWith /admin ?| Judge{🔀 前后台判定}
    Judge -->|Yes · 配置管理| A[AdminShell<br/>✅ 全平台统一控制台风]:::shell
    Judge -->|No · 用户前台| U[UserShell<br/>🎨 每应用独立审美主题]:::shell
    Judge -->|单一形态应用（过渡）| O[AppShell<br/>通用侧栏+顶栏外壳]:::shell

    %% AdminShell 子结构
    A --> Sider[🟣 深色侧栏 #1c1f26<br/>ADMIN_TOKENS]
    A --> Header[🔵 顶栏「后台」Tag + 切换应用下拉]
    A --> AdminContent[📋 内容区 统一 #f4f5f7]
    A -->|frontPath 可选| Back[← 返回前台入口<br/>侧栏底部，无前台 omit]
    AdminContent --> ARoutes[<Routes> /admin/*]:::route
    ARoutes --> A1[<Page /> · CRUD 表格]:::page
    ARoutes --> A2[<Page /> · 配置表单]:::page

    %% UserShell 子结构
    U --> MastHead[📰 报头区：MagicTools 小字 + h1 衬线大字<br/>+ 副标题 + 双线/双线分隔]
    U --> Nav[🧭 水平导航条：UserNavItem 左右居中]
    U --> UserContent[📖 内容区：max-width 1080 居中]
    U -->|adminPath 可选| FooterAdmin[管理后台 → 入口 · 页脚右侧]
    U --> Footer[ⓘ footerNote 个性化页脚 · 页脚左侧]
    UserContent --> URoutes[<Routes> /* 前台路由]:::route
    URoutes --> U1[PositionWall / ChatPage / FlightDeck<br/>主题化深度设计页]:::page
    URoutes --> U2[SearchPage / EntryList / GraphPage<br/>个性化内容页]:::page

    %% 三外壳共享：跨应用切换下拉（顶栏 or 页脚）
    AppSwitch[🔁 切换应用：APPS 注册表 8 项]
    A --> AppSwitch
    U --> AppSwitch
    O --> AppSwitch
```

### 8.3 8 应用前台主题对照表

| 应用 | 主题常量 | 报头标题 | 设计语言关键词 |
|---|---|---|---|
| applicant | MAGAZINE_THEME | 求职 · 每一次投递，都值得被认真对待 | 杂志风：Georgia/Noto Serif SC 衬线、暖纸 #f8f5ef、砖红 #b4532a |
| scholar | LIBRARY_THEME | 知识书院 · 典藏知识，检索于心 | 图书馆风：Palatino、羊皮纸绿系、书签编号 |
| assistant | QUIET_THEME | 智能助手 · 有问必答 | 对话极简：无衬线、瓷白、砖橙、异形气泡 |
| gatherer | PRESS_THEME | 知识采集部 · 日日新 | 报刊风：Impact 报头、藏青、排版密 |
| investigator | ARCHIVE_THEME | 调研档案馆 · 事实在先 | 档案风：Courier 等宽、牛皮纸 #f5e9cf、铜金 #b8860b |
| assessor | BRIEF_THEME | 评审文书房 · 审慎落笔 | 文书风：Georgia、暖白、深赭、段落缩进 |
| manager | COCKPIT_THEME | 交付驾驶舱 · 掌控节奏 | 驾驶舱风：Consolas 等宽、冷灰蓝 #1e2a38、天蓝 #3b82f6 |
| designer | GALLERY_THEME | 组件画廊 · 灵感即展品 | 画廊风：Helvetica、纯白底、墨黑线条 |

> gatherer / investigator / assessor 三应用前台无实际内容，根路径仅展示报头后重定向至后台。

### 8.4 前端通用模式（所有 web 项目同构）

```tsx
// api.ts 模式
const BASE = "/api/<name>";
export const api = {
  list: () => fetch(BASE + "/entries").then(r => r.json()),
  // ...
};

// vitest 配置：jsdom + @testing-library/react
// test-setup.ts：jsdom 全局注入 + AntD 兼容桩
```

---
