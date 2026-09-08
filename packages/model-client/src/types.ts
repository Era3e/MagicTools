export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  vision?: boolean;
}

export interface UsageLog {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  ms: number;
}

export interface ModelProviderConfig {
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  defaultModel: string;
  /** 环境变量模型覆盖键（如 ZHIPU_MODEL）——设置时优先于 defaultModel，免改代码切模型档位 */
  envModelKey?: string;
  visionModel?: string;
  embeddingModel?: string;
}
