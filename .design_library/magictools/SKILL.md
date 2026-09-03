---
name: magictools-design
description: Use this skill to generate well-branded interfaces for MagicTools — AI productivity suite with dual-shell IA (themed user-facing fronts + unified dark admin console). Contains colors, type, fonts, components, and UI kit for prototyping dashboard UIs.
user-invocable: true
---
# MagicTools Design Skill

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts, copy assets out and create static HTML files. If working on production code, read the rules here to become an expert in designing with this brand.

## Quick map

- `README.md` — brand context, content fundamentals, visual foundations (read first)
- `colors_and_type.css` — drop-in CSS variables for colors, type, radius, shadow, spacing
- `css.json` — structured token understanding source
- `components/index.json` — component index + cross-component patterns
- `components/{slug}.json` — component intent/variants contract (preview HTML first, JSON for intent)
- `uikit-plan.json` — component whitelist and UIKit planner output
- `library-consumption.json` — recommended downstream read order
- `preview/` — small HTML cards illustrating foundations and components
- `components.css` — aggregated component CSS extracted from preview pages
- `ui_kits/dashboard/` — full click-thru recreation (use as reference for layout, density, patterns)

## Essentials at a glance

- 品牌主色墨蓝 `--mt-ink-600` #2c4a6e — 冷峻克制的工房蓝，拒绝 AntD 出厂默认蓝；琥珀点缀 `--mt-amber-500` #c08a35 仅少量使用。
- 圆角 4/6/10（--radius-sm/md/lg）刻意收束，9999px 胶囊仅用于状态标签 — 从不做大圆角软卡片。
- 工房密度：控件高度 32/36/44（默认按钮 36px、输入框 36px）；间距 4px 基、8 档（4–64px）。
- 字体三声部：Noto Serif SC + Source Serif 4 展示与标题 / Noto Sans SC 正文 / JetBrains Mono 等宽数字（tabular-nums）。
- 语气：中文优先、专业克制、无表情符号；双字按钮文案带全角空格（如「生 成」）。
- 阴影 5 级墨调（shadow-1→5，rgba(27,46,69,…) 淡墨投影）；海拔即层级：surface-0 纸面 / surface-1 卡片 / surface-2 浮层，替代白卡平铺。
- 双外壳基因：前台八主题算法化派生（accent hue + paper tint + display font role），后台统一深色控制台 — `.dark` 全量双色板，暗色为一等公民。

## Components

| Slug | Name | Key Insight |
|------|------|-------------|
| button | MtButton 按钮 | 墨蓝实心主按钮，工房密度 36px 默认高，克制圆角与按压反馈 |
| surface-card | MtSurfaceCard 表面卡片 | 纸面/卡片/浮层三级表面语言，海拔即层级，替代白卡平铺 |
| data-table | MtTable 数据表格 | 石墨表头 + 等宽数字右对齐 + 纸色悬浮行 |
| input | MtInput 输入框 | 墨蓝聚焦环 2px，纸面底而非纯白 |
| shell-nav | MtShellNav 外壳导航 | 前台报头水平导航 vs 后台石墨深侧栏，一套令牌两种性格 |
| status-tag | MtStatusTag 状态标签 | 低饱和语义底 + 深阶文字，禁用 AntD 预设色 |
