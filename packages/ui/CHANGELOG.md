# @mt/ui

## 0.2.0

### Minor Changes

- 9f0c096: UI v2.1「墨蓝石墨·工房感 · 质感升级」：参考 Linear/Stripe/Vercel/GitHub 五家头部科技公司产品 UI，升级六维度质感技法——(1) Linear 四级表面亮度阶梯替代投影承载层级（surface0-4：#14181f→#2d3848）；(2) Stripe 双层投影系统（近距小模糊+远距大模糊+inset 顶部高光线）；(3) GitHub 发丝级半透明边框（rgba 白 7%/12%/16% 三档）+ 表格行 hover 重音条（inset 2px accent）；(4) Linear 噪点纹理升级（SVG feTurbulence 0.65 baseFrequency/3 octaves + mix-blend-mode overlay/4.5% opacity）；(5) Vercel 透明度文字层级（rgba 95%/65%/40%/28% 四档，换底自动适配）+ tabular-nums 数据列对齐；(6) 暗色光学修正（字重降一档 350/500 + 负字距 -0.01em）；新增焦点环（GitHub 3px 品牌色透明度）、多层环境聚光灯（主氛围光+琥珀色副氛围光）、渐变描边 token、悬浮聚光灯 token。AdminShell 注入全局 CSS（焦点环/表格发丝线/卡片双层投影/按钮内描边+hover 辉光/字重光学修正）。AdminDarkThemeProvider 补齐 Menu/Input/Select/Tag/Modal 组件级暗色注入。设计库 colors_and_type.css 同步暗色令牌。

## 0.1.0

### Minor Changes

- 668c8e9: 按「前台各异、后台统一」规范铺开全部 8 应用双外壳：UserShell 新增 footerNote 个性化页脚；scholar 图书馆风（知识书院）、assistant 对话极简风、gatherer 报刊风（知识采集部）、investigator 档案风（调研档案馆）、assessor 文书风（评审文书房）、manager 驾驶舱风（交付驾驶舱）、designer 画廊风（组件画廊）；管理页统一迁入 /admin/\* 控制台路由，旧路径 redirect 兼容。
- 8c4c045: 统一前端外壳：@mt/ui 新增 AppShell（侧边导航 + 顶栏 + 跨应用切换）并扩展设计令牌，8 子项目接入替换裸 Card 与重复外壳；修复 applicant 简历改写误作用首份简历；接入 ESLint（typescript-eslint + react-hooks）与覆盖率门槛；scholar-server e2e 补齐 DB 不可用时的 skip 守卫。
- acae500: 质量治理三角闭环：
  - E2E 强化：8 应用 e2e 用例加副作用断言（URL 跳转 / Modal 开关 / 列表增改 / 接口请求拦截 URL+method），新增 16 页视觉快照基线 `_visual.spec.ts`（视口截图 + 动态列表区 mask，与并发写库解耦）；`pnpm e2e:visual:update` / `pnpm e2e:visual` 脚本。
  - E2E 可信度治理：本地启动脚本 `infra/scripts/start-services.mjs` 桩环境对齐 CI（FEED_STUB/FEISHU_STUB/GITHUB_STUB/CYBERCLOUD_STUB 等）；修正 12 处测试契约失配（AntD 双字按钮字间空格、onOk 页脚确定、路由/字段名、disabled 竞态、waitForResponse 完成事件、并发 [0] 位置断言）；guard-skip 静默跳过全部改为显式 `test.skip`，暴露 2 个导航入口缺失（mvp-deferred D-16/D-17）；全量 51 passed / 2 skipped / 0 failed。
  - 文档追溯：新增 `docs/superpowers/coverage-matrix.md`（规格-代码-测试三维追踪矩阵）与 `docs/memory/mvp-deferred.md`（MVP 明确推迟项、原因、重启触发条件），区分「未实现」与「不做」。
  - UI 规范工程化：`@mt/ui` 新增三种页面模式 MagazineList / ControlTable / DetailHero、`ThemeContext` + `useTheme` 钩子；自定义 ESLint 规则 `@mt/rules/no-hardcoded-colors` 禁业务页硬编码色值（豁免 tokens.ts、应用顶层 \*\_THEME、AdminShell/UserShell 专用键）；manager/scholar/applicant/assistant/designer 共 11 前台页迁移 `useTheme()` 取色；PR 模板新增 UI Checklist 与 0 bug loop 验收表格；AGENTS.md 新增硬性约定 8（E2E 校准纪律）。
  - 配套修复：MtEmptyState 扩展 description 属性，兼容 patterns 类型。
- d12386d: 前后台双外壳打样（applicant）：@mt/ui 新增 UserShell（主题化前台外壳，杂志风默认主题）与 AdminShell（统一控制台后台外壳）；applicant 前台改为杂志风岗位博览墙（检索/分页/空态引导），表格管理挪至 /admin/positions 后台路由，前后台经页脚/侧栏互相跳转。

### Patch Changes

- 5eae2a3: Assistant D-09 意图路由在线学习：纠错样本自动构造 few-shot 注入分类提示词（每意图 3 条/总数 12 封顶、60s TTL 缓存、纠错落库即清缓存即时生效）；新增评估闭环（混淆矩阵 + 回放评估命中率）与 OpenAI 兼容 JSONL 微调数据集导出；IntentLogPage 新增「路由评估」卡片。附带 D-13 收尾：修复 5 处 ESLint 错误、AdminShell 接入 ThemeProvider、补齐 @ant-design/icons 依赖。
