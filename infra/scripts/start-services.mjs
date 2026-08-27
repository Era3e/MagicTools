// infra/scripts/start-services.mjs — 一键起 gateway + 8*server + 8*web（dist + vite preview）
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const LOG_DIR = join(ROOT, ".run-logs");
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const APPS = [
  ["gatherer",     4001, 5001],
  ["investigator", 4002, 5002],
  ["assessor",     4003, 5003],
  ["manager",      4004, 5004],
  ["designer",     4005, 5005],
  ["scholar",      4006, 5006],
  ["assistant",    4007, 5007],
  ["applicant",    4008, 5008],
];

function start(name, cwd, cmd, args, env = {}) {
  const out = join(LOG_DIR, name + ".out.log");
  const err = join(LOG_DIR, name + ".err.log");
  rmSync(out, { force: true });
  rmSync(err, { force: true });
  writeFileSync(out, "");
  writeFileSync(err, "");
  // Windows 上 pnpm.cmd/vite preview 等 .cmd 文件必须走 shell；
  // 但 shell:true 下父脚本一旦 process.exit 会连带 kill 子树，所以本脚本禁止强制退出，
  // 依赖子进程 stdio/事件循环引用让父进程常驻即可。
  const useShell = process.platform === "win32" && (cmd.endsWith(".cmd") || cmd.endsWith(".bat"));
  const child = spawn(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: useShell,
    windowsHide: true,
    env: { ...process.env, ...env },
  });
  child.stdout.on("data", (d) => {
    writeFileSync(out, d, { flag: "a" });
  });
  child.stderr.on("data", (d) => {
    writeFileSync(err, d, { flag: "a" });
  });
  child.on("exit", (code) => {
    writeFileSync(err, `\n[exit] code=${code ?? "null"}\n`, { flag: "a" });
  });
  const cols = process.stdout.columns || 80;
  const msg = `  start ${name.padEnd(22)} pid=${String(child.pid).padStart(5)}  cwd=${cwd.replace(ROOT, ".")}`;
  console.log(msg.slice(0, cols));
  return child;
}

// 桩环境与 CI 对齐（.github/workflows/ci.yml smoke/e2e job）：
// 本地跑全量 e2e 必须与 CI 相同的桩开关，否则 gatherer/investigator/assistant
// 会真拉 RSS / 真调飞书 / 真查 cybercloud，导致 API 链路用例 500/502。
const MT_LLM_STUB = { MT_LLM_STUB: "1" };
const SERVER_ENV = {
  gatherer:     { FEED_STUB: "1", ...MT_LLM_STUB },
  investigator: { FEISHU_STUB: "1", ...MT_LLM_STUB },
  assessor:     { GITHUB_STUB: "1", ...MT_LLM_STUB },
  manager:      { GITHUB_STUB: "1" },
  designer:     { ...MT_LLM_STUB },
  scholar:      { ...MT_LLM_STUB },
  assistant:    { CYBERCLOUD_STUB: "1", ACTION_STUB: "1", CLARIFY_STUB_CONFIDENCE: "0.9", ...MT_LLM_STUB },
  applicant:    {},
};

const procs = [];
procs.push(start("gateway", join(ROOT, "apps", "gateway"), "node", ["dist/index.js"]));
for (const [app, webPort, serverPort] of APPS) {
  procs.push(start(`${app}-server`, join(ROOT, "apps", app, "server"), "node", ["dist/main.js"], SERVER_ENV[app] ?? {}));
  // 用 pnpm.cmd exec vite preview --host 127.0.0.1 --port X --strictPort
  procs.push(start(`${app}-web`, join(ROOT, "apps", app, "web"), "pnpm.cmd", [
    "exec",
    "vite",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(webPort),
    "--strictPort",
  ]));
}

setTimeout(() => {
  let alive = 0;
  let dead = 0;
  for (const p of procs) {
    if (p.exitCode === null) alive += 1;
    else dead += 1;
  }
  console.log(`\n=== status: alive=${alive} exited=${dead} (total spawned ${procs.length}) ===`);
  console.log("tip: pnpm smoke to health-check; logs at .run-logs/*.log");
  // 注：不要 process.exit() — Windows 下 shell:true 会把子进程一起杀掉。
  // 让脚本自然结束（父事件循环会因未处理的 Node IPC/定时器引用继续挂起，
  // 即便本脚本退出，Start-Process/child_process.spawn 出来的独立 node 进程也会继续存在）。
}, 14000);
