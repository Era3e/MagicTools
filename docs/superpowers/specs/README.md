# 设计文档索引

已交付设计文档标注“历史设计基线”，它们保留某个迭代开始前的动机、方案和验收边界，不保证描述当前实现；仍在执行中的设计可短暂标注“当前设计基线”。当前实现请按顺序核对：

1. `docs/generated/feature-map.md` 与 `docs/generated/interface-index.md`；
2. `docs/code-wiki/<module>.md`；
3. 对应源码、迁移、测试和运行证据。

新设计文档必须在开头标注 `设计状态：历史设计基线` 或 `当前设计基线`；CI 中的 docs facts 守卫会检查该标识。
