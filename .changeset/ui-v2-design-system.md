---
"@mt/ui": minor
---

UI v2「墨蓝石墨·工房感」落地：tokens.ts 全量替换 AntD 出厂值为品牌色板（墨蓝 ink-600 主色、石墨中性阶、四组语义色、暗色板/海拔/动效/尺寸/字体扩展块，键结构向后兼容）；MtThemeProvider 全量注入 AntD（控件高 36、品牌字体、表格石墨表头、浮层墨调阴影）+ Google Fonts 幂等注入；AdminShell 切石墨深色控制台（darkAlgorithm 真注入，后台表格/表单/浮层整体深色）；UserShell 八应用主题 accent 真注入 AntD；MtEmptyState 品牌化去 AntD 简笔画；八应用主题常量按 v2 派生口径重算；ESLint 白名单补 card/brick 主题键。视觉基线 16 张重生成，e2e 52 passed。
