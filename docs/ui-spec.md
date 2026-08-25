# MagicTools UI 规范

## 设计令牌（packages/ui/src/tokens.ts 为唯一来源）

| 类别 | 键 | 值 |
|---|---|---|
| 主色 | color.primary | #2f54eb |
| 成功 | color.success | #52c41a |
| 警告 | color.warning | #faad14 |
| 错误 | color.error | #ff4d4f |
| 文本 | color.text / color.textSecondary | #1f1f1f / #666666 |
| 布局底色 | color.bgLayout | #f5f6f8 |
| 容器 / 中性 / 高亮 / 气泡底 | color.bgContainer / bgNeutral / bgActive / bgUser | #ffffff / #f6f6f6 / #f0f5ff / #e6f4ff |
| 边框 | color.border | #f0f0f0 |
| 强调色 | color.purple / color.cyan | #722ed1 / #13c2c2 |
| 间距 | spacing.xs/sm/md/lg/xl | 4/8/16/24/32 |
| 字号 | fontSize.sm/md/lg/xl | 12/14/16/20 |
| 圆角 | radius | 6 |

## 强制规则

1. 所有 web 应用入口必须用 MtThemeProvider 包裹（模板已内置）；
2. 颜色一律引用 tokens.color，禁止在业务代码硬编码色值；
3. 空数据场景使用 MtEmptyState（title 必填，操作按钮用 actionText + onAction）；
4. 新通用组件先沉淀到 packages/ui，经评审后供全平台复用；
5. 应用同时面向终端用户与配置管理时，必须拆分前后台双外壳（见下节），禁止共用一套外壳一套导航。

## 前后台双外壳（2026-08-25 起，PR #28 打样 applicant）

原则：**前台各异，后台统一**。

| 外壳 | 组件 | 设计语言 | 适用 |
|---|---|---|---|
| 用户前台 | `UserShell`（packages/ui/src/UserShell.tsx） | 每应用独立审美主题，默认杂志风 `MAGAZINE_THEME`（衬线 Georgia/Noto Serif SC、暖纸底 #f8f5ef、砖红 #b4532a） | 面向终端用户的消费型页面（浏览、阅读、对话） |
| 配置后台 | `AdminShell`（packages/ui/src/AdminShell.tsx） | 全平台统一控制台风 `ADMIN_TOKENS`（深色侧栏 #1c1f26、蓝 accent #4c7dff、顶栏「后台」标识） | 面向管理员的增删改查、配置、监控页面 |
| 过渡外壳 | `AppShell` | 侧边导航 + 顶栏 + 跨应用切换 | 无前后台之分的单一形态应用 |

约定：

1. **路由划分**：后台路由统一挂 `/admin` 前缀（如 `/applicant/admin/positions`），App 入口按 `location.pathname.startsWith("/admin")` 切换外壳；
2. **互跳入口**：前台 UserShell 页脚带「后台管理」入口（`adminPath`），后台 AdminShell 侧栏底部带「返回前台」（`frontPath`）；
3. **前台主题定制**：传 `theme: UserShellTheme`（primary/background/ink/muted/displayFont/bodyFont），每个应用一个主题（applicant=杂志风、scholar=图书馆风、assistant=对话极简、gatherer=报刊风…），主题常量沉淀在各自 App 中；
4. **后台禁止个性化**：AdminShell 全平台一套，不接收主题参数，保证运维心智一致；
5. 外壳均为受控组件（`onNavigate` 回调），不依赖 react-router，保持 @mt/ui 零 router 依赖。
