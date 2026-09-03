---
"@mt/ui": minor
---

UI v2.1「墨蓝石墨·工房感 · 质感升级」：参考 Linear/Stripe/Vercel/GitHub 五家头部科技公司产品 UI，升级六维度质感技法——(1) Linear 四级表面亮度阶梯替代投影承载层级（surface0-4：#14181f→#2d3848）；(2) Stripe 双层投影系统（近距小模糊+远距大模糊+inset 顶部高光线）；(3) GitHub 发丝级半透明边框（rgba 白 7%/12%/16% 三档）+ 表格行 hover 重音条（inset 2px accent）；(4) Linear 噪点纹理升级（SVG feTurbulence 0.65 baseFrequency/3 octaves + mix-blend-mode overlay/4.5% opacity）；(5) Vercel 透明度文字层级（rgba 95%/65%/40%/28% 四档，换底自动适配）+ tabular-nums 数据列对齐；(6) 暗色光学修正（字重降一档 350/500 + 负字距 -0.01em）；新增焦点环（GitHub 3px 品牌色透明度）、多层环境聚光灯（主氛围光+琥珀色副氛围光）、渐变描边 token、悬浮聚光灯 token。AdminShell 注入全局 CSS（焦点环/表格发丝线/卡片双层投影/按钮内描边+hover 辉光/字重光学修正）。AdminDarkThemeProvider 补齐 Menu/Input/Select/Tag/Modal 组件级暗色注入。设计库 colors_and_type.css 同步暗色令牌。
