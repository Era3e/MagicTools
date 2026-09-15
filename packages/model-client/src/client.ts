import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type {
  ChatMessage,
  ChatOptions,
  EmbedOptions,
  ModelCallContext,
  ModelCallOperation,
  ModelCallStatus,
  ModelProviderConfig,
  UsageLog,
} from "./types";

export interface ModelClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<{ content: string; usage: UsageLog }>;
  embed(texts: string[], options?: EmbedOptions): Promise<number[][]>;
}

const callContextStorage = new AsyncLocalStorage<ModelCallContext>();

export function runWithModelCallContext<T>(context: ModelCallContext, callback: () => Promise<T>): Promise<T> {
  return callContextStorage.run(context, callback);
}

export function getModelCallContext(): ModelCallContext | undefined {
  return callContextStorage.getStore();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function explicitModel(provider: ModelProviderConfig, options: ChatOptions): string | null {
  if (options.model) return options.model;
  if (provider.envModelKey) {
    const fromEnv = process.env[provider.envModelKey];
    if (fromEnv) return fromEnv;
  }
  return null;
}

function resolveModel(provider: ModelProviderConfig, options: ChatOptions): string {
  return (
    explicitModel(provider, options) ??
    (options.vision && provider.visionModel ? provider.visionModel : provider.defaultModel)
  );
}

interface CallSignal {
  signal: AbortSignal;
  cancel: () => void;
  dispose: () => void;
  timedOut: () => boolean;
  externalAborted: () => boolean;
  consumerCancelled: () => boolean;
}

function createCallSignal(provider: ModelProviderConfig, options: { signal?: AbortSignal; timeoutMs?: number }): CallSignal {
  const controller = new AbortController();
  let timedOut = false;
  let externalAborted = false;
  let consumerCancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const external = options.signal;
  const onExternalAbort = () => {
    externalAborted = true;
    controller.abort(external?.reason);
  };
  const timeoutMs = options.timeoutMs ?? provider.defaultTimeoutMs ?? 120_000;
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timer = setTimeout(() => {
      timedOut = true;
      const error = new Error(`模型调用超时 ${timeoutMs}ms`);
      error.name = "TimeoutError";
      controller.abort(error);
    }, timeoutMs);
  }
  if (external?.aborted) onExternalAbort();
  else external?.addEventListener("abort", onExternalAbort, { once: true });

  return {
    signal: controller.signal,
    cancel: () => {
      consumerCancelled = true;
      controller.abort(new Error("模型流式调用被消费方提前取消"));
    },
    dispose() {
      if (timer) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
    timedOut: () => timedOut,
    externalAborted: () => externalAborted,
    consumerCancelled: () => consumerCancelled,
  };
}

function errorStatus(call: CallSignal, error: unknown): ModelCallStatus {
  if (call.consumerCancelled()) return "cancelled";
  if (call.externalAborted()) return "cancelled";
  if (call.timedOut() || (error as { name?: string })?.name === "TimeoutError") return "timeout";
  return "error";
}

function errorCode(error: unknown, status: ModelCallStatus): string {
  if (status === "timeout") return "timeout";
  if (status === "cancelled") return "cancelled";
  if ((error as { name?: string })?.name === "AbortError") return "cancelled";
  return (error as { name?: string })?.name || "error";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mergedContext(provider: ModelProviderConfig, options: { context?: ModelCallContext }): Record<string, unknown> {
  const ambient = callContextStorage.getStore() ?? {};
  const context = { ...ambient, ...(options.context ?? {}) };
  context.service = context.service ?? provider.name;
  if (context.metadata) context.metadata = { ...(ambient.metadata ?? {}), ...(options.context?.metadata ?? {}) };
  return context as Record<string, unknown>;
}

interface UsageFields {
  inputTokens?: number | null;
  outputTokens?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
}

function normalizeUsage(value: UsageFields | undefined): Pick<UsageLog, "inputTokens" | "outputTokens" | "tokenSource"> {
  const inputTokens = value?.inputTokens ?? value?.prompt_tokens ?? null;
  const outputTokens = value?.outputTokens ?? value?.completion_tokens ?? null;
  return {
    inputTokens,
    outputTokens,
    tokenSource: inputTokens === null && outputTokens === null ? "unknown" : "provider",
  };
}

function makeUsage(input: {
  provider: ModelProviderConfig;
  operation: ModelCallOperation;
  requestedModel: string | null;
  effectiveModel: string;
  status: ModelCallStatus;
  attempt: number;
  attempts: number;
  ms: number;
  context: Record<string, unknown>;
  error?: unknown;
  call?: CallSignal;
  usage?: UsageFields;
}): UsageLog {
  const status = input.error === undefined ? input.status : errorStatus(input.call!, input.error);
  return {
    id: randomUUID(),
    service: String(input.context.service ?? input.provider.name),
    operation: input.operation,
    provider: input.provider.name,
    model: input.effectiveModel,
    requestedModel: input.requestedModel,
    effectiveModel: input.effectiveModel,
    status,
    attempt: input.attempt,
    attempts: input.attempts,
    ...normalizeUsage(input.usage),
    ms: input.ms,
    taskId: (input.context.taskId as string | undefined) ?? null,
    traceId: (input.context.traceId as string | undefined) ?? null,
    errorCode: input.error === undefined ? null : errorCode(input.error, status),
    errorMessage: input.error === undefined ? null : errorMessage(input.error),
    cancelled: status === "cancelled",
    context: input.context,
  };
}

function buildRequest(
  provider: ModelProviderConfig,
  messages: ChatMessage[],
  options: ChatOptions,
  stream: boolean,
  signal: AbortSignal
): RequestInit {
  return {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env[provider.apiKeyEnv],
    },
    body: JSON.stringify({
      model: resolveModel(provider, options),
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    }),
  };
}

export async function* chatStream(
  provider: ModelProviderConfig,
  messages: ChatMessage[],
  options: ChatOptions = {},
  logUsage: (usage: UsageLog) => void = () => {}
): AsyncGenerator<string, void, undefined> {
  const call = createCallSignal(provider, options);
  const context = mergedContext(provider, options);
  const requestedModel = explicitModel(provider, options);
  const model = resolveModel(provider, options);
  const started = Date.now();
  let finished = false;
  let reported = false;
  let streamUsage: UsageFields | undefined;

  const report = (error?: unknown) => {
    if (reported) return;
    reported = true;
    logUsage(
      makeUsage({
        provider,
        operation: "chat-stream",
        requestedModel,
        effectiveModel: model,
        status: error === undefined ? "success" : "error",
        attempt: 1,
        attempts: 1,
        ms: Date.now() - started,
        context,
        error,
        call,
        usage: streamUsage,
      })
    );
  };

  try {
    const res = await fetch(provider.baseUrl + "/chat/completions", buildRequest(provider, messages, options, true, call.signal));
    if (!res.ok || !res.body) {
      throw new Error("模型调用失败: " + res.status + " " + (await res.text()).slice(0, 200));
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
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
          finished = true;
          await reader.cancel().catch(() => undefined);
          report();
          return;
        }
        const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }>; usage?: UsageFields };
        if (json.usage) streamUsage = json.usage;
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }
    finished = true;
    report();
  } catch (error) {
    report(error);
    throw error;
  } finally {
    if (!finished) {
      if (!reported) {
        call.cancel();
        report(call.signal.reason);
      }
      if (!call.signal.aborted) call.cancel();
    }
    call.dispose();
  }
}

export function createModelClient(
  provider: ModelProviderConfig,
  logUsage: (usage: UsageLog) => void = () => {}
): ModelClient {
  return {
    async embed(texts: string[], options: EmbedOptions = {}) {
      const context = mergedContext(provider, options);
      const requestedModel = null;
      const model = provider.embeddingModel ?? provider.defaultModel;
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const call = createCallSignal(provider, options);
        const started = Date.now();
        try {
          const res = await fetch(provider.baseUrl + "/embeddings", {
            method: "POST",
            signal: call.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + process.env[provider.apiKeyEnv],
            },
            body: JSON.stringify({ model, input: texts.length === 1 ? texts[0] : texts }),
          });
          if (res.status === 429 || res.status >= 500) {
            const text = await res.text();
            throw Object.assign(new Error("embedding 上游服务错误 " + res.status), { retryable: true, body: text });
          }
          if (!res.ok) throw new Error("embedding 调用失败: " + res.status + " " + (await res.text()).slice(0, 200));
          const data = (await res.json()) as { data?: Array<{ embedding?: number[] }>; usage?: UsageFields };
          const usage = makeUsage({
            provider,
            operation: "embedding",
            requestedModel,
            effectiveModel: model,
            status: "success",
            attempt,
            attempts: attempt,
            ms: Date.now() - started,
            context,
            usage: data.usage,
          });
          logUsage(usage);
          return (data.data ?? []).map((item) => item.embedding ?? []);
        } catch (error) {
          lastError = error;
          logUsage(
            makeUsage({
              provider,
              operation: "embedding",
              requestedModel,
              effectiveModel: model,
              status: "error",
              attempt,
              attempts: attempt,
              ms: Date.now() - started,
              context,
              error,
              call,
            })
          );
          const cancellation = errorStatus(call, error) !== "error";
          if (attempt === 3 || cancellation || !(error as { retryable?: boolean }).retryable) break;
          await sleep(attempt * 500);
        } finally {
          call.dispose();
        }
      }
      throw lastError instanceof Error ? lastError : new Error("embedding 调用失败");
    },
    async chat(messages, options = {}) {
      if (options.stream) {
        let content = "";
        let usage: UsageLog | undefined;
        for await (const part of chatStream(provider, messages, options, (record) => {
          usage = record;
          logUsage(record);
        })) {
          content += part;
        }
        return { content, usage: usage! };
      }

      const context = mergedContext(provider, options);
      const requestedModel = explicitModel(provider, options);
      const model = resolveModel(provider, options);
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const call = createCallSignal(provider, options);
        const started = Date.now();
        try {
          const res = await fetch(provider.baseUrl + "/chat/completions", buildRequest(provider, messages, options, false, call.signal));
          if (res.status === 429 || res.status >= 500) {
            const text = await res.text();
            throw Object.assign(new Error("上游服务错误 " + res.status), { retryable: true, body: text });
          }
          if (!res.ok) {
            throw new Error("模型调用失败: " + res.status + " " + (await res.text()).slice(0, 200));
          }
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: UsageFields;
          };
          const usage = makeUsage({
            provider,
            operation: "chat",
            requestedModel,
            effectiveModel: model,
            status: "success",
            attempt,
            attempts: attempt,
            ms: Date.now() - started,
            context,
            usage: data.usage,
          });
          logUsage(usage);
          return { content: data.choices?.[0]?.message?.content ?? "", usage };
        } catch (error) {
          lastError = error;
          logUsage(
            makeUsage({
              provider,
              operation: "chat",
              requestedModel,
              effectiveModel: model,
              status: "error",
              attempt,
              attempts: attempt,
              ms: Date.now() - started,
              context,
              error,
              call,
            })
          );
          const cancellation = errorStatus(call, error) !== "error";
          if (attempt === 3 || cancellation || !(error as { retryable?: boolean }).retryable) break;
          await sleep(attempt * 500);
        } finally {
          call.dispose();
        }
      }
      throw lastError instanceof Error ? lastError : new Error("模型调用失败");
    },
  };
}
