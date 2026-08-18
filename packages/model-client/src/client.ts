import type { ChatMessage, ChatOptions, ModelProviderConfig, UsageLog } from "./types";

export interface ModelClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<{ content: string; usage: UsageLog }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequest(
  provider: ModelProviderConfig,
  messages: ChatMessage[],
  options: ChatOptions,
  stream: boolean
): RequestInit {
  const model = options.model ?? provider.defaultModel;
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env[provider.apiKeyEnv],
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
      stream,
    }),
  };
}

export async function* chatStream(
  provider: ModelProviderConfig,
  messages: ChatMessage[],
  options: ChatOptions = {},
  logUsage: (usage: UsageLog) => void = () => {}
): AsyncGenerator<string, void, undefined> {
  const started = Date.now();
  const res = await fetch(provider.baseUrl + "/chat/completions", buildRequest(provider, messages, options, true));
  if (!res.ok || !res.body) {
    throw new Error("模型调用失败: " + res.status + " " + (await res.text()).slice(0, 200));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outputTokens = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") {
        logUsage({
          provider: provider.name,
          model: options.model ?? provider.defaultModel,
          inputTokens: 0,
          outputTokens,
          ms: Date.now() - started,
        });
        return;
      }
      const json = JSON.parse(data);
      const delta: string | undefined = json.choices?.[0]?.delta?.content;
      if (delta) {
        outputTokens += 1;
        yield delta;
      }
    }
  }
}

export function createModelClient(
  provider: ModelProviderConfig,
  logUsage: (usage: UsageLog) => void = () => {}
): ModelClient {
  return {
    async chat(messages, options = {}) {
      if (options.stream) {
        let content = "";
        let usage: UsageLog = {
          provider: provider.name,
          model: options.model ?? provider.defaultModel,
          inputTokens: 0,
          outputTokens: 0,
          ms: 0,
        };
        for await (const part of chatStream(provider, messages, options, (u) => {
          usage = u;
          logUsage(u);
        })) {
          content += part;
        }
        return { content, usage };
      }
      const started = Date.now();
      const model = options.model ?? provider.defaultModel;
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(provider.baseUrl + "/chat/completions", buildRequest(provider, messages, options, false));
          if (res.status === 429 || res.status >= 500) {
            lastError = new Error("上游服务错误 " + res.status);
            await sleep(attempt * 500);
            continue;
          }
          if (!res.ok) {
            throw new Error("模型调用失败: " + res.status + " " + (await res.text()).slice(0, 200));
          }
          const data = await res.json();
          const usage: UsageLog = {
            provider: provider.name,
            model,
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
            ms: Date.now() - started,
          };
          logUsage(usage);
          return { content: data.choices[0].message.content ?? "", usage };
        } catch (err) {
          lastError = err;
          if (attempt < 3) await sleep(attempt * 500);
        }
      }
      throw lastError instanceof Error ? lastError : new Error("模型调用失败");
    },
  };
}
