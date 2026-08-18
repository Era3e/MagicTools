import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

export function buildChecks(ports) {
  const checks = [];
  for (const [name, p] of Object.entries(ports)) {
    if (p.server) checks.push({ name: name + "-server", url: "http://127.0.0.1:" + p.server + "/api/" + name + "/health" });
    if (p.web) checks.push({ name: name + "-web", url: "http://127.0.0.1:" + p.web + "/" + name + "/" });
  }
  checks.push({ name: "gateway", url: "http://127.0.0.1:3000/health" });
  return checks;
}

export async function runChecks(checks, timeoutMs = 3000) {
  const results = [];
  for (const check of checks) {
    const started = Date.now();
    try {
      const res = await fetch(check.url, { signal: AbortSignal.timeout(timeoutMs) });
      results.push({ name: check.name, ok: res.ok, status: res.status, ms: Date.now() - started });
    } catch (err) {
      results.push({ name: check.name, ok: false, status: 0, ms: Date.now() - started, error: String(err).slice(0, 120) });
    }
  }
  return results;
}

// 仅当直接执行时运行 CLI（被测试导入时无副作用）
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
  const ports = parse(readFileSync(join(process.cwd(), "infra", "ports.yaml"), "utf8"));
  let checks = buildChecks(ports);
  if (only) checks = checks.filter((c) => c.name.startsWith(only));

  const results = await runChecks(checks);
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed += 1;
    console.log((r.ok ? "PASS" : "FAIL") + "  " + r.name.padEnd(22) + (r.status || r.error || "?") + "  (" + r.ms + "ms)");
  }
  process.exit(failed === 0 ? 0 : 1);
}
