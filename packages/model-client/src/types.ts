export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
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
}
