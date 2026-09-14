# LLM 智能层

> 文档状态：当前模块事实源快照（2026-09-15）。源码级功能与接口索引以 `docs/generated/` 为准；本文件用于理解模块结构、边界和实现方式。

## 10. LLM 智能层

### 10.1 供应商切换与桩模式

```bash
# 环境变量控制
DEEPSEEK_API_KEY=xxx   # 留空则此供应商不可用
ZHIPU_API_KEY=xxx       # 过期会 401，建议 MT_LLM_STUB=1 桩模式跑测试

# 全局桩（CI/本地无 Key 时用）
MT_LLM_STUB=1          # 所有子项目 llm.ts 检查此 env，true → 返回固定 mock 文本
```

**使用模式（子项目 llm.ts 统一封装）**：

```ts
import { createModelClient, parseJson, ZHIPU } from "@mt/model-client";
const llm = createModelClient(ZHIPU, (u) => console.log("[usage]", u));
// 无 Key 或 MT_LLM_STUB 时，llm.chat 返回占位符文本，不抛错

// 必须：结构化输出用 parseJson
const raw = (await llm.chat(messages)).content;
const data = parseJson(raw) as MySchema;  // 4 级降级容错
```

### 10.2 视觉能力（Applicant 截图识别）

智谱 glm-4v-flash 多模态：

```ts
const message: ChatMessage = {
  role: "user",
  content: [
    { type: "text", text: "提取图片中的岗位 JD 信息为 JSON" },
    { type: "image_url", image_url: { url: "data:image/png;base64," + b64 } }
  ]
};
await llm.chat([message], { vision: true });
// vision:true 自动路由到 visionModel（glm-4v-flash），无则 fallback defaultModel
```

### 10.3 向量能力（Scholar 检索）

智谱 embedding-2（1024 维）：

```ts
const vectors = await llm.embed(["文档1", "文档2"]);  // Promise<number[][]>
// MT_LLM_STUB 模式下返回 bigram 哈希伪向量（保证维度一致，仅用于测试流程）
```

Scholar 双通道检索：
1. 全文检索：`to_tsvector('english', content) @@ plainto_tsquery(?)` + pg_trgm 相似度
2. 向量检索：`embedding <=> $1 ORDER BY 1 LIMIT n`（余弦距离，pgvector 操作符）

---
