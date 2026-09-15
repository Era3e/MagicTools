export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ModelCallContext {
  service?: string;
  operation?: string;
  taskId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface RequestCancellation {
  signal?: AbortSignal;
  timeoutMs?: number;
  context?: ModelCallContext;
}

export type ChatOptions = RequestCancellation & {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  vision?: boolean;
};

export type EmbedOptions = RequestCancellation;

export type ModelCallOperation = "chat" | "chat-stream" | "embedding";
export type ModelCallStatus = "success" | "error" | "timeout" | "cancelled";
export type ModelTokenSource = "provider" | "unknown";

export interface UsageLog {
  id: string;
  service: string;
  operation: ModelCallOperation;
  provider: string;
  model: string;
  requestedModel?: string | null;
  effectiveModel: string;
  status: ModelCallStatus;
  attempt: number;
  attempts: number;
  inputTokens: number | null;
  outputTokens: number | null;
  tokenSource: ModelTokenSource;
  ms: number;
  taskId?: string | null;
  traceId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  cancelled: boolean;
  context: Record<string, unknown>;
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
  defaultTimeoutMs?: number;
}
