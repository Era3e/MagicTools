# P19：统一 Scholar 检索 API 与证据筛选设计

> 设计状态：当前设计基线。

## 目标

Assistant 不再直连 Scholar 数据库检索知识。Scholar 提供一个服务端固定的公共混合检索 API，只返回当前发布产品版本中的不可变证据分块；Assistant 经 Gateway 消费候选，并把模型输出的候选编号映射为可验证引用。

## 范围

- Scholar 新增 `entry_chunks`：每个分块绑定 `entry_id`、`revision_id`、`chunk_no`、字符区间、证据文本和 1024 维向量。
- 修订创建时同步生成新分块；发布检索只 join `entry_publications.revision_id`，发布后编辑不影响线上召回。
- 新增 `POST /api/scholar/public/search`：服务端解析当前公共产品版本，同时执行 FTS 与向量检索，按分块合并、按条目聚合，输出候选编号、命中通道、版本/部署标识、修订、需求证据与字符区间。
- 向量-only 候选必须达到最低相似度门槛；FTS 与向量同时命中的候选获得轻量加权。
- Assistant 新增 `ScholarClient`，默认经 `INTERNAL_GATEWAY_URL` 调 Gateway 反代；不再读取 `SCHOLAR_DATABASE_URL`。
- `KnowledgeService` 提示模型输出 `{answer, citations:[候选编号]}`，服务端只保留可映射编号；编号全部无效时丢弃模型答案，降级为首条真实证据的确定性回答。

## 非目标

- 不声称真实模型效果优化；模型调用仍在 `MT_LLM_STUB=1` 或真实外部配置下分别验证。
- 不改变现有 Scholar 管理检索 API 和前台页面行为。
- 不在本需求内发布用户帮助页面入口（P20 处理）。

## 验收

1. 无关向量近邻被门槛过滤，返回“未找到相关知识”且引用为空。
2. 长文档后半段的专有词能命中后续分块，引用携带非零字符区间。
3. development 私有条目不能进入公共混合检索。
4. 发布后编辑生成草稿修订，公共检索仍返回发布修订，草稿词不可召回。
5. 模型输出虚构候选编号时，服务端只保留存在编号；编号全部无效时不返回幻觉答案，降级为首条真实证据。每条引用携带 revision/version/chunk/evidence。
6. Assistant 代码和数据库测试计划中不再存在 `scholarPool`、`SCHOLAR_DATABASE_URL` 或 Scholar 上游库。
