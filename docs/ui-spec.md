# MagicTools UI 规范（v2 · 2026-09-02）

品牌基调：**墨蓝石墨·工房感**——墨蓝主色、石墨中性、琥珀强调；衬线展示、等宽数字、纸面层级。

## 一、设计系统与令牌来源

- `packages/ui/src/tokens.ts` 为历史 v1 令牌（AntD 出厂值，待迁移），仅供存量代码引用；
- **v2 唯一令牌来源 = `.design_library/magictools/colors_and_type.css`**；落地任务据此派生重写 tokens.ts（含亮/暗双色板、surface 三级、海拔 5 级、motion token）；
- 核心令牌速览（值均抄自该 CSS，禁止另编）：

| 类别 | 关键值 |
|---|---|
| 主色 mt-ink | primary = 600 `#2c4a6e`，hover = 700 `#233c5a`，on-primary `#ffffff`；暗色 primary = 400 `#6e8bad`、link = 300 `#9db3ca`、on-primary `#0d141c`；50–900 十阶 |
| 中性 mt-graphite | 50 `#f6f7f9` → 900 `#232b33` 十阶；border/rule = 200 `#d9dde3`（暗色 `#2d3644`） |
| 琥珀强调 mt-amber | accent = 500 `#c08a35`，hover = 600 `#a06f2a`；暗色 accent = 400 `#cfa04c` |
| 语义色（各 50–900 十阶；600 主用 / 700 深阶，暗色降为 400） | success `#3a7049`/`#2f5a3b`；warning `#9a6a25`/`#7a531f`；error `#943d35`/`#76312b`；info `#3a5f84`/`#2f4c69` |
| 文本 | strong `#1c2530` / body `#2e3a48` / muted `#5f6c7c` / faint `#8b98a8` / inverse `#f2f5f9` |
| surface 三级 | 亮：bg `#f4f6f8`，surface-0 纸面 `#fbfcfd`、surface-1 卡片 `#ffffff`、surface-2 凹面 `#eef1f5`；暗：bg `#14181f`、0 `#171c24`、1 `#1b212b`、2 `#232b37` |
| radius / spacing / size | radius 4/6/10/9999px；spacing 4px 基 8 档（4/8/12/16/24/32/48/64px）；按钮 32/36/44px、输入高 36px、图标 16/20/24px |
| 海拔 / 动效 | shadow-1…5 墨调投影（亮 `rgba(27,46,69,·)`，暗 `rgba(8,12,18,·)`）；duration 120/200/320ms；ease-standard `cubic-bezier(0.4,0,0.2,1)`、ease-entrance `cubic-bezier(0,0,0.2,1)` |

- 字体三层：display/heading = `Noto Serif SC` + `Source Serif 4`（衬线展示）；body = `Noto Sans SC`；mono = `JetBrains Mono`（tabular-nums）；
- 字号阶（px）：display-lg 44 / display 36 / display-sm·h1 28 / h2 22 / h3 18 / lead 16 / h4 15 / body 14 / mono 13 / caption 12 / eyebrow 11。

## 二、强制规则（v2 新增与延续）

延续 v1：

1. 所有 web 应用入口必须用 MtThemeProvider 包裹（模板已内置）；
2. 颜色一律引用 token，禁止在业务代码硬编码色值；
3. 空数据场景使用 MtEmptyState（title 必填，操作按钮用 actionText + onAction）；
4. 新通用组件先沉淀到 packages/ui，经评审后供全平台复用；
5. 应用同时面向终端用户与配置管理时，必须拆分前后台双外壳（见三），禁止共用一套外壳一套导航。

v2 新增：

6. 禁止 AntD 出厂观感：默认蓝 `#1677ff`/`#2f54eb`、Tag 预设色、Empty 简笔画插画一律禁用；空态用 MtEmptyState 品牌化定制；
7. 海拔即层级：surface-0 纸面（无阴影）/ surface-1 卡片（shadow-1，hover 升 shadow-2）/ surface-2 浮层（shadow-4）；卡片内禁止再嵌卡片；
8. 数字一律等宽：表格数字列右对齐且用 JetBrains Mono；计数徽标 / 读数 / 时间戳同用 mono；
9. 状态标签规则：底取语义色 50 阶、字取 700 阶、高 22px；意图 / 计数类内容用 mono；暗色下底取 800 阶、字取 200 阶；
10. 主题派生规则：前台主题仅派生 accent hue / paper tint / display font 三个变量，布局结构与组件规则全平台统一；后台 AdminShell 永远深色一套（surface `#14181f` 系），禁止个性化；
11. 动效：hover / 按压用 duration-fast（120ms）+ ease-standard；浮层进出 duration-base（200ms）+ ease-entrance；禁止弹性夸张缓动。

## 三、前后台双外壳（v1 延续，引用更新）

原则：**前台各异，后台统一**。

| 外壳 | 组件 | 设计语言 | 适用 |
|---|---|---|---|
| 用户前台 | `UserShell`（packages/ui/src/UserShell.tsx） | 每应用独立纸色主题（v2 派生口径见下表） | 面向终端用户的消费型页面（浏览、阅读、对话） |
| 配置后台 | `AdminShell`（packages/ui/src/AdminShell.tsx） | 全平台统一石墨深色控制台（surface `#14181f` 系） | 面向管理员的增删改查、配置、监控页面 |
| 过渡外壳 | `AppShell` | 侧边导航 + 顶栏 + 跨应用切换 | 无前后台之分的单一形态应用 |

约定：

1. **路由划分**：后台路由统一挂 `/admin` 前缀（如 `/applicant/admin/positions`），入口按 `location.pathname.startsWith("/admin")` 切换外壳；
2. **互跳入口**：前台 UserShell 页脚「后台管理」（`adminPath`），后台 AdminShell 侧栏底部「返回前台」（`frontPath`）；
3. **前台主题定制**：传 `theme: UserShellTheme`，每个应用一个主题常量沉淀在各自 App 中；v2 起仅派生 accent hue / paper tint / display font 三变量（见下表）；
4. **后台禁止个性化**：AdminShell 全平台一套，不接收主题参数，保证运维心智一致；
5. 外壳均为受控组件（`onNavigate` 回调），不依赖 react-router，@mt/ui 保持零 router 依赖。

前台八主题（v2 派生口径）：

| 应用 | 受众 | accent 派生 | 纸色派生 | 气质 |
|---|---|---|---|---|
| applicant | 求职者 | 砖红 terracotta | 暖纸白 | 编辑部特稿，安抚体面 |
| scholar | 知识工作者 | 深馆藏绿 | 羊皮纸 | 图书馆目录，沉静考究 |
| assistant | 运营用户 | 瓷青（墨蓝浅调） | 瓷白 | 对话极简，可靠不花哨 |
| gatherer | 内容策展人 | 报刊藏青 | 新闻纸灰白 | 报刊排印，密度高 |
| investigator | 调研执行者 | 铜金 | 牛皮纸 | 档案卷宗，等宽数据 |
| assessor | 评审专家 | 深赭 | 暖白 | 文书评审，权威克制 |
| manager | 交付经理 | 天蓝（冷） | 冷灰蓝 | 驾驶舱仪表，mono 读数 |
| designer | 设计师/工程师 | 墨黑 | 纯白画廊 | 画廊留白，极简精确 |

- v1 常量名对照：MAGAZINE / LIBRARY / QUIET / PRESS / ARCHIVE / BRIEF / COCKPIT / GALLERY_THEME 保留，取值按上表派生口径重算；
- 无前台形态的应用（gatherer / investigator / assessor）前台仅作报头展示，默认路由重定向到后台。

## 四、组件规范要点（6 组件）

- **MtButton 按钮**：默认 md 36px 工房密度（sm 32 / lg 44）；主按钮墨蓝 ink-600 实心；双字文案全角空格（「生 成」）；按压反馈 duration-fast；
- **MtSurfaceCard 表面卡片**：surface-0 / 1 / 2 三级表面语言，海拔即层级，替代白卡平铺；卡片内禁嵌卡片；
- **MtTable 数据表格**：石墨表头 + 数字列 JetBrains Mono 右对齐 + 纸色悬浮行；后台 ControlTable 骨架；
- **MtInput 输入框**：surface-2 底而非纯白；聚焦墨蓝 2px 环（ink-600）；高 36px，支持前置图标与检索态；
- **MtShellNav 外壳导航**：一套令牌两种性格——前台报头水平导航（纸色），后台石墨深侧栏（surface `#14181f` 系）；
- **MtStatusTag 状态标签**：低饱和语义底 + 深阶文字（底 50 / 字 700，高 22px），等宽小字号，禁用 AntD 预设色。

细则见 `.design_library/magictools/components/{slug}.json` 契约（button / surface-card / data-table / input / shell-nav / status-tag）。

## 五、暗色模式（v2 新增）

- `.dark` 全量双色板；AdminShell 常驻暗色为首个落地场景；前台暂亮色（纸色主题本身即材质）；
- 暗色表面 `#14181f` 系三级（bg `#14181f` / surface-0 `#171c24` / 1 `#1b212b` / 2 `#232b37`）；语义色暗色下降饱和（600 → 400 阶）；阴影换墨调深影（`rgba(8,12,18,·)`）；
- 落地机制：`html.dark` 类切换 + CSS 变量重映射（tokens.ts 迁移时实现）。

## 六、落地迁移清单（另起任务执行）

- [ ] tokens.ts 按 v2 CSS 重写（亮/暗双色板）+ theme.test 断言更新；
- [ ] MtThemeProvider 扩展注入（surface / shadow / font / motion token 进 AntD ConfigProvider）；
- [ ] AdminShell 切 v2 深色派生；UserShell 八主题常量按派生口径重算；
- [ ] patterns（ControlTable / MagazineList / DetailHero / TimelineBurndown）表面与表格规则更新；
- [ ] MtEmptyState 品牌化（去 AntD 简笔画）；
- [ ] 业务页 11 个前台页 useTheme 键名对齐新派生层；
- [ ] ESLint no-hardcoded-colors 豁免清单复核（tokens.ts / 主题常量 / 双外壳）；
- [ ] e2e 视觉基线 16 张重生成（win32 + dispatch visual-baseline 产 linux）。

注：UI Checklist（PR 模板）增加 v2 强制规则勾选项。
