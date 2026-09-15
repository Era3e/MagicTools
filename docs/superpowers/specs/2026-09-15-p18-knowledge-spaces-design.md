# P18 开发和产品知识空间设计

> 设计状态：当前设计基线。

## 目标

1. Scholar 建立 development/product 两类知识空间，存量内容默认归入私有开发空间。
2. 产品内容必须通过产品版本发布，发布记录绑定不可变内容修订、来源修订和部署标识。
3. 公共 API 服务端固定 product/public/published/current version，禁止开发空间内容通过列表、详情、FTS 或向量检索泄漏。
4. 知识条目可关联 Manager 需求，公共返回携带需求证据。
5. 成员撤权、下架和删除必须清理发布、图谱关联和向量索引，不依赖缓存过期。

## 模型与边界

- `knowledge_spaces`：key/kind/visibility，默认 development 与 product。
- `knowledge_space_members`：按 Gateway 透传用户授权。
- `product_versions`：draft/published/archived，保存 source_revision 与 deployment_ref。
- `entry_revisions`：条目内容不可变修订，保存来源修订、来源 URL、需求链接和创建者。
- `entry_publications`：条目、产品版本、内容修订三方绑定。
- 未变化条目可在后续产品版本复用同一内容修订；发布记录按条目+版本唯一。
- `entry_requirement_links`：条目与 Manager 需求幂等关联。

创建和编辑都会生成修订；已发布内容后续编辑只产生新的当前修订，公共 API 继续返回发布时绑定的旧修订。公共查询在 SQL join 中完成空间、版本、状态和发布记录过滤。

旧条目、图谱、Obsidian、收件箱与空间管理接口默认要求 Gateway 管理员；成员可通过空间条目 API 读取被授权空间，撤权后立即拒绝。

## 验收

- 公共列表/详情/FTS/向量入口不能返回开发空间内容。
- 产品版本必须携带来源修订和部署标识才可发布。
- 发布后编辑不改变当前公共版本内容。
- 成员撤权后不再看到私有空间。
- 下架会删除发布记录、图谱关联并清空向量；删除会清理条目、修订、发布和需求关联。
