import { createModelClient, type ChatMessage, type ChatOptions } from "@mt/model-client";
import { DEEPSEEK, ZHIPU } from "@mt/model-client";

export const EMBEDDING_DIMS = 1024;

export type Intent =
  | "product_inquiry"
  | "data_query"
  | "chitchat_reject"
  | "process_execution"
  | "trouble_shooting"
  | "complaint_feedback";

export type Domain = "magictools" | "cybercloud" | "chitchat";

// chat 供应商：LLM_PROVIDER=zhipu 强制智谱；否则有 DeepSeek Key 用 DeepSeek（智谱 IP 白名单限制时可用）
// 懒加载：运行时读取环境变量，供应商变化时自动重建客户端
let chatClientCache: ReturnType<typeof createModelClient> | null = null;
let chatClientProvider = "";
function getChatClient(): ReturnType<typeof createModelClient> {
  const provider = process.env.LLM_PROVIDER === "zhipu" || !process.env.DEEPSEEK_API_KEY ? ZHIPU : DEEPSEEK;
  if (!chatClientCache || chatClientProvider !== provider.name) {
    chatClientCache = createModelClient(provider, (u) => console.log("[llm]", u.model, u.ms + "ms"));
    chatClientProvider = provider.name;
  }
  return chatClientCache;
}
// 向量化固定走智谱 embedding-2（DeepSeek 无 embedding 端点）
const embedClient = createModelClient(ZHIPU, () => {});

export async function llmChat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  if (process.env.MT_LLM_STUB === "1") {
    return JSON.stringify(stubPayloadFor(messages));
  }
  const result = await getChatClient().chat(messages, options);
  return result.content;
}

function stubPayloadFor(messages: ChatMessage[]): Record<string, unknown> {
  const system = messages.find((m) => m.role === "system");
  const sysText = typeof system?.content === "string" ? system.content : "";
  if (sysText.includes("{intent")) {
    const userText = messages
      .filter((m) => m.role === "user")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n");
    const stubConfidence = process.env.CLARIFY_STUB_CONFIDENCE;
    return {
      domain: classifyDomain(userText),
      intent: classifyIntent(userText),
      confidence: stubConfidence ? Number(stubConfidence) : 1,
    };
  }
  if (sysText.includes("{troubleshoot")) {
    return { answer: "排查建议：1) 检查异常服务的日志（.run-logs）与数据库连接；2) 确认 Postgres 容器健康；3) 重启对应服务后观察 /health 状态。" };
  }
  if (sysText.includes("{answer")) {
    return { answer: "桩回答：基于圈定知识的回答。" };
  }
  if (sysText.includes("{params")) {
    return { endpoint: "/api/v1/data/query", params: { metric: "sales" } };
  }
  if (sysText.includes("{format")) {
    return { answer: "桩数据查询结果：本月销售额 12345 元（CYBERCLOUD_STUB 桩模式）" };
  }
  if (sysText.includes("{action")) {
    const userText = messages
      .filter((m) => m.role === "user")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n");
    if (/采集/.test(userText)) return { action: "trigger_collect", params: { sourceId: "" } };
    return { action: "create_requirement", params: { title: "桩需求：自动创建", description: "" } };
  }
  return {};
}

/** 桩模式系统归属判别：问候 → cybercloud 域词 → MagicTools 内部 */
export function classifyDomain(text: string): Domain {
  if (/^(你好|您好|hi|hello|谢谢|再见|拜拜)/i.test(text.trim())) return "chitchat";
  if (/(插件|业务对象|数据对象|智能体|cybercloud|字段|对象关系|对象索引|数据|查询|统计|报表|指标)/.test(text)) return "cybercloud";
  return "magictools";
}

/** 桩模式意图判别：数据 → cybercloud 域 → 动作 → 排查 → 反馈 → 问候，其余产品问答 */
export function classifyIntent(text: string): Intent {
  if (/(数据|查询|统计|报表|指标)/.test(text)) return "data_query";
  // 方案 A：cybercloud 域操作（插件/对象/字段/智能体）优先于 MagicTools 动作词，交给 cybercloud 智能体
  if (/(插件|业务对象|数据对象|智能体|cybercloud|字段|对象关系|对象索引)/.test(text)) return "data_query";
  if (/(创建|新建|建一个|建个|触发|采集|跑一次|执行)(.{0,12}需求|.{0,8}采集)|需求.{0,6}创建/.test(text)) return "process_execution";
  if (/(报错|失败|异常|排查|挂了|起不来|出问题|错误)/.test(text)) return "trouble_shooting";
  if (/(投诉|反馈|不满意|吐槽)/.test(text)) return "complaint_feedback";
  if (/^(你好|您好|hi|hello|谢谢|再见|拜拜)/i.test(text.trim())) return "chitchat_reject";
  return "product_inquiry";
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (process.env.MT_LLM_STUB === "1") {
    return texts.map((t) => pseudoVector(t, EMBEDDING_DIMS));
  }
  return embedClient.embed(texts);
}

/** 桩模式确定性伪向量：字符 bigram 哈希打点后单位化（与 scholar 桩向量算法一致，保证检索相似性） */
export function pseudoVector(text: string, dims = EMBEDDING_DIMS): number[] {
  const vec = new Array<number>(dims).fill(0);
  const t = text.toLowerCase();
  for (let i = 0; i < t.length - 1; i++) {
    const bigram = t.slice(i, i + 2);
    let h = 2166136261;
    for (let j = 0; j < bigram.length; j++) {
      h ^= bigram.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    vec[(h >>> 0) % dims] = 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
