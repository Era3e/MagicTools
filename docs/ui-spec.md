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
4. 新通用组件先沉淀到 packages/ui，经评审后供全平台复用。
