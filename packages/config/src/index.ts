import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

export function loadYamlFile(path: string): unknown {
  return parse(readFileSync(path, "utf8"));
}

export function resolveEnvOverrides(
  base: Record<string, unknown>,
  prefix: string
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value !== undefined) {
      out[key.slice(prefix.length).toLowerCase()] = value;
    }
  }
  return out;
}

export function validateConfig<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error("配置校验失败: " + result.error.message);
  }
  return result.data;
}
