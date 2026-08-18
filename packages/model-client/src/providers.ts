import type { ModelProviderConfig } from "./types";

export const DEEPSEEK: ModelProviderConfig = {
  name: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  apiKeyEnv: "DEEPSEEK_API_KEY",
  defaultModel: "deepseek-chat",
};

export const ZHIPU: ModelProviderConfig = {
  name: "zhipu",
  baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  apiKeyEnv: "ZHIPU_API_KEY",
  defaultModel: "glm-4-flash",
};

export const BUILTIN_PROVIDERS: ModelProviderConfig[] = [DEEPSEEK, ZHIPU];
