import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { parse } from "yaml";
import { z } from "zod";

// 从 startDir 向上查找仓库根 .env（pnpm --filter 以包目录为 cwd，故需向上定位）
export function findRootEnvFile(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// 加载 .env 到进程环境（不存在则静默跳过）；默认从 cwd 向上查找
export function loadRootEnv(startDir: string = process.cwd()): void {
  const file = findRootEnvFile(startDir);
  if (file) config({ path: file });
}

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
