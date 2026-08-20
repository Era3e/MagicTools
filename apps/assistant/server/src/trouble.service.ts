import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Injectable } from "@nestjs/common";
import { parse as parseYaml } from "yaml";
import { parseJson } from "./json";
import { llmChat } from "./llm";
import { answerSchema } from "./schemas";

export interface HealthProbe {
  service: string;
  ok: boolean;
  status: number;
  ms: number;
  error?: string;
}

function findPortsFile(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "infra", "ports.yaml");
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // 继续向上查找
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("未找到 infra/ports.yaml");
}

export async function probeHealth(): Promise<HealthProbe[]> {
  const portsFile = findPortsFile(process.cwd());
  const ports = parseYaml(readFileSync(portsFile, "utf8")) as Record<string, { web?: number; server?: number }>;
  const results: HealthProbe[] = [];
  const targets = Object.entries(ports).filter(([name]) => name !== "gateway");
  await Promise.all(
    targets.map(async ([name, p]) => {
      if (!p.server) return;
      const url = "http://127.0.0.1:" + p.server + "/api/" + name + "/health";
      const started = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        results.push({ service: name, ok: res.ok, status: res.status, ms: Date.now() - started });
      } catch (err) {
        results.push({ service: name, ok: false, status: 0, ms: Date.now() - started, error: String(err).slice(0, 120) });
      }
    })
  );
  // 网关健康
  const gwStarted = Date.now();
  try {
    const res = await fetch("http://127.0.0.1:3000/health", { signal: AbortSignal.timeout(3000) });
    results.push({ service: "gateway", ok: res.ok, status: res.status, ms: Date.now() - gwStarted });
  } catch (err) {
    results.push({ service: "gateway", ok: false, status: 0, ms: Date.now() - gwStarted, error: String(err).slice(0, 120) });
  }
  return results.sort((a, b) => a.service.localeCompare(b.service));
}

const DIAGNOSE_PROMPT =
  "你是平台故障排查助手。根据各服务健康状态与用户问题，输出 JSON：{answer: 排查建议文本（含服务状态概览与分步建议）}。{troubleshoot}";

@Injectable()
export class TroubleService {
  async diagnose(question: string): Promise<{ reply: string }> {
    const results = await probeHealth();
    const down = results.filter((r) => !r.ok);
    const overview = results.map((r) => r.service + "：" + (r.ok ? "正常" : "异常")).join("，");
    const raw = await llmChat([
      { role: "system", content: DIAGNOSE_PROMPT },
      { role: "user", content: "服务状态：\n" + overview + "\n异常详情：\n" + JSON.stringify(down) + "\n用户问题：" + question },
    ]);
    try {
      const parsed = answerSchema.parse(parseJson(raw));
      return { reply: "【服务状态】" + overview + "\n" + parsed.answer };
    } catch {
      return { reply: "【服务状态】" + overview + "\n建议：请检查异常服务的日志与数据库连接。" };
    }
  }
}
