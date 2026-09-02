# MagicTools Design System（墨蓝石墨·工房感）

## 1. Overview

MagicTools 是一套覆盖 8 个子应用的 AI 生产力套件（React 18 + AntD 5），信息架构是「双外壳」：前台八个应用各自持有主题化界面（求职者的编辑部特稿、知识工作者的图书馆目录、交付经理的驾驶舱仪表……），后台收敛为一个统一的 AdminShell 管理控制台。本设计系统为这整套套件提供底座——气质是「墨蓝石墨·工房感」：专业、克制、密度高、带编辑部排印味道的工具感，而非消费级产品的轻盈装饰。

评审的出发点是一次明确的「消灭塑料感」行动：AntD 出厂默认值（默认蓝、默认灰、统一小圆角、简笔画空态）在 8 个应用同时出现时，整个套件像一排未调音的样机。本系统用墨蓝主色、石墨中性阶、三级表面海拔、衬线展示层与等宽数字读数，替换掉这些出厂默认。

本文覆盖：色彩 / 字体 / 间距 / 圆角 / 阴影 / 动效 / 暗色的全部 token 语义，内容语气与真实文案范例，6 个核心组件模式，文件索引与已知替代方案。写给新加入的资深设计师当内部 wiki 读——不是 API 参考手册。

## 2. Content Fundamentals

### Voice & tone

专业克制的「工房语气」：像资深工头报进度，不像营销文案喊口号。中文为主，英文只出现在专有名号位（如 FLIGHT DECK），不做中英混排装饰。标题遵循「领域名词 · 动作/状态」双段式，中间用全角间隔号「·」连接——这是全站最统一的文案骨架。数字永远渲染成等宽读数，不做文字化表达。不使用 emoji，不使用感叹号，不用「请」字开头的客套句式；安抚感靠措辞的体面（前台求职场景），权威感靠措辞的简省（后台评审场景）。

### Concrete copy examples

- 求职前台模块标题：*「岗位博览 · N 个机会在册」*
- 知识应用检索入口：*「知识书院 · 馆藏检索」*
- 交付管理看板名号：*「交付驾驶舱 · FLIGHT DECK」*
- 组件定制入口：*「组件画廊 · 委托生成」*
- 调研卷宗命名：*「调研档案馆 · 第 N 卷」*
- 后台管理页标题：*「采集源管理」*
- 路由诊断列表：*「意图日志 · 路由评估」*
- 批量操作按钮态：*「推送选中（N）」*

### When generating copy

- 双字按钮文案中间加全角空格：「生 成」「保 存」「编 辑」——AntD 默认行为，勿在自定义按钮里破坏；E2E 选择器用 `/生\s*成/` 形式兼容。
- 眉题（eyebrow）一律大写 + 0.08em 字距、11px / 600——这是页面里唯一允许 uppercase 的位置。
- 计数与编号用 JetBrains Mono 等宽渲染（tabular-nums），保证表格与驾驶舱读数纵向对齐。
- 标题遵循「名词 · 状态」间隔号结构；纯管理页（如「采集源管理」）可省略后半段。
- 括号内计数用全角括号：「推送选中（N）」，N 由数据实时渲染。

## Design Principles

1. **海拔即层级**：surface-0 纸面 / surface-1 卡片 / surface-2 浮层三级表面 + 5 级墨调阴影，靠海拔而非描边粗细表达层级；静止卡片只带 shadow-1，禁止上来就浮夸大投影。
2. **主题真注入（底座 + 派生）**：本库是底座；八个前台主题（砖红 / 馆藏绿 / 瓷青 / 藏青 / 铜金 / 深赭 / 天蓝 / 墨黑）由 accent hue + paper tint + display font role 三轴算法化派生，完整注入 AntD ConfigProvider——不做「换个变量名」的假主题。
3. **等宽数字读数**：所有可变数字（计数、ID、时间戳、路由评分）用 JetBrains Mono + tabular-nums；驾驶舱与日志列表的数字必须纵向可扫描。
4. **双字按钮全角空格**：见 Content Fundamentals；AntD 行为保持，禁止丢弃。

## 3. Visual Foundations

### Color

主色是墨蓝（mt-ink），10 阶，锚定 `--mt-ink-600` **#2c4a6e**——比 AntD 默认蓝更暗、更灰、更沉着，是「墨水」而非「科技蓝」。hover 沿色阶上抬到 ink-700，不换色相；暗色模式下主色抬到 ink-400（#6e8bad 一带）以保对比度。link 与 primary 同源，链接不做独立蓝。

中性是石墨（mt-graphite），10 阶，从 #f6f7f9 铺到 #232b33，带轻微冷调。日常工作主力是 graphite-200（全部 hairline 边框与分隔线）、graphite-400/500（次级图标与占位文字）——中性阶的最大工作量在「结构线」，不在「大色块」。

琥珀点缀（mt-amber）10 阶，锚定 `--mt-amber-500` **#c08a35**，hover 到 amber-600。用法极克制：焦点高亮、驾驶舱关键读数、收藏标记——不做大面积铺色，一个界面同时出现的琥珀元素应当一只手数得完。琥珀是「工房里的黄铜件」，不是第二个品牌色。

语义四组各 10 阶：success 锚 #3a7049、warning 锚 #9a6a25、error 锚 #943d35、info 锚 #3a5f84。info 与 ink 同族偏冷，避免「信息蓝 ≠ 品牌蓝」的违和；语义色统一压暗降饱和，与墨蓝石墨气质一致，不使用高饱和警示撞色。

纸感是关键约束：**表面不用纯白做底**。页面背景 #f4f6f8，纸面 surface-0 是 #fbfcfd（比纯白低半档），卡片 surface-1 才是 #ffffff，surface-2 #eef1f5 用于凹陷区（代码块、表格表头、选中底）。整页纯白铺底是禁止项。文本四级：strong #1c2530 / body #2e3a48 / muted #5f6c7c / faint #8b98a8。

### Typography

三层声音：**展示层 Noto Serif SC**（拉丁回退 **Source Serif 4**）承担 display 与 h1–h3，给前台应用编辑部气质；**正文层 Noto Sans SC**（400/500/600/700）承担 body、控件与一切高密度阅读区；**数据层 JetBrains Mono**（500）承担一切读数与代码。

阶梯补齐了 display 级：display-lg 44px/1.15（-0.015em 紧排）、display 36px/1.2、display-sm 28px/1.25。h1 28 / h2 22 / h3 18 均为衬线 600；**h4 起转无衬线**（15px）——衬线止步于标题区，正文密度区不出现衬线。body 14px/1.65、lead 16px/1.7、caption 12px、eyebrow 11px/600/0.08em/uppercase、mono 13px/1.6 且 tabular-nums。标题统一 600，不用 700 以上重衬线。

### Spacing

4px 基，8 档 token：4 / 8 / 12 / 16 / 24 / 32 / 48 / 64。控件高度：按钮 sm 32 / md 36 / lg 44，输入统一 36；图标 16 / 20 / 24。信息密度优先——模块内 12/16，模块间 24/32，48/64 只给前后台门面页。驾驶舱类页面宁可压缩行高（body 1.65 起步），不放大留白。

### Radius

三档克制：**4px** 给输入、按钮、标签等控件；**6px** 给卡片；**10px** 只给模态与大型浮层；9999px 全圆仅限 status-tag 一类状态圆片。不出现 12px 以上大圆角——统一大圆角正是「塑料感」来源之一。

### Shadow / Elevation

5 级墨调阴影，全部基于墨蓝 rgba(27,46,69,x) 而非纯黑——落在灰底上是「浮起一层薄雾」，不是「黑框投影」。shadow-1 卡片静止、shadow-2 卡片悬停、shadow-3 下拉、shadow-4 模态、shadow-5 全屏 Overlay。海拔与三级表面对应使用：surface-1 卡片配 shadow-1/2，surface-2 浮层配 shadow-3 起。暗色下阴影整体加深为近黑 rgba(8,12,18,x) 系。

### Borders, Backgrounds, Motion

边框一律 hairline（graphite-200，--border/--rule 同源），用表面层次代替粗描边盒子；muted 底（graphite-100）用于表头与选中行。动效 duration 三档：fast 120ms / base 200ms / slow 320ms；easing 两条：standard cubic-bezier(0.4,0,0.2,1) 交互态、entrance cubic-bezier(0,0,0.2,1) 进场。不做弹跳，不做超过 320ms 的动画。

### Dark mode

一等公民，`.dark` 全量双色板。暗色表面是 **#14181f 系**：background #14181f、surface-0 #171c24、surface-1 #1b212b、surface-2 #232b37，边框 #2d3644；主色抬到 ink-400、琥珀抬到 amber-400、语义色各抬到 400 档、文本整组反转（strong #f0f4f8）。**AdminShell 是暗色常驻场景**——后台不是「暗色适配」，而是首发暗色。

## 4. Component Patterns

| Component | Source | Key Insight |
|---|---|---|
| button | `preview/component-button.html` · `components/button.json` | 双字文案全角空格；sm/md/lg = 32/36/44；primary 墨蓝 ink-600，hover 沿 ink 色阶上抬不换色相 |
| surface-card | `preview/component-surface-card.html` | surface-1 + shadow-1 起步，悬停只升到 shadow-2——海拔克制是本系统卡片的辨识点 |
| data-table | `preview/component-data-table.html` | 表头 graphite-100 底、行分隔 hairline、数字列 JetBrains Mono tabular-nums 纵向对齐 |
| input | `preview/component-input.html` | 36px 高、radius 4、graphite-200 hairline 边框；聚焦走 ink 描边，不发光 |
| shell-nav | `preview/component-shell-nav.html` | AdminShell 暗色常驻侧栏：surface-0 #171c24 之上叠 ink-400 active 指示 |
| status-tag | `preview/component-status-tag.html` | 全站唯一允许 radius-full 的元素；语义色浅端做底、深端做字，不描边 |

## 5. Index

- `colors_and_type.css` — 全部 token 的唯一运行时来源（色彩/字体/间距/圆角/阴影/动效，含 `.dark`），引用而非复制。
- `css.json` — 程序化消费的 token JSON。
- `components/index.json` + `components/*.json` — 组件契约（变体、状态、anatomy）。
- `components.css` — 从 preview 页聚合抽取的组件 CSS。
- `preview/component-*.html` — 6 个组件小样卡片。
- `ui_kits/dashboard/index.html` — 驾驶舱型 UI Kit，可点击的多屏参考（布局、密度、模式）。
- `uikit-plan.json` — 组件白名单与屏幕蓝图。

## 6. Caveats / known substitutions

1. **Google Fonts 依赖**：colors_and_type.css 顶部 `@import` 引入 Noto Serif SC / Source Serif 4 / Noto Sans SC / JetBrains Mono，内网或离线环境不可达。替代栈：Noto Serif SC → 宋体系（SimSun / 华文宋体，多字重会牺牲）；Source Serif 4 → Georgia / Times New Roman；Noto Sans SC → PingFang SC / Microsoft YaHei（微软雅黑）；JetBrains Mono → Consolas / Cascadia Mono（tabular-nums 行为保持）。衬线展示气质会明显打折，内网部署建议改为自托管字体文件。
2. **AntD 复合控件不重写**：Select / DatePicker / Table 等经 ConfigProvider token 换肤，本库 CSS 只约束自研组件与原型层；不要在业务代码里覆写 AntD 内部类名。
3. **八应用主题派生层本期为规范约定**：accent hue + paper tint + display font role 三轴派生规则已定，ConfigProvider 主题工厂的代码落地另起任务——本库 ≠ 已接入生产。
4. **视觉基线需重生成**：preview 与 ui_kits 均由 token 派生，token 迭代后必须重新生成，禁止手工同步预览页。
5. 本系统为 from-scratch 规范创建（无 Figma 证据源），组件置信度为 medium，落地时以真实交互校准。
