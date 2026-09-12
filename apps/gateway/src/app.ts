import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { buildRoutes, serviceHost, type PortsConfig } from "./routes";
import { createAuthMiddleware } from "./auth";

interface HealthProbe {
  service: string;
  ok: boolean;
  status: number;
  ms: number;
  error?: string;
}

async function probeAllServices(ports: PortsConfig, host: (name: string) => string): Promise<HealthProbe[]> {
  const results: HealthProbe[] = [];
  const entries = Object.entries(ports).filter(([name]) => name !== "gateway");
  await Promise.all(
    entries.map(async ([name, p]) => {
      if (!p.server) return;
      const url = "http://" + host(name + "-server") + ":" + p.server + "/api/" + name + "/health";
      const started = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        results.push({ service: name, ok: res.ok, status: res.status, ms: Date.now() - started });
      } catch (err) {
        results.push({ service: name, ok: false, status: 0, ms: Date.now() - started, error: String(err).slice(0, 120) });
      }
    })
  );
  // 网关自身
  const gwStarted = Date.now();
  try {
    const res = await fetch("http://" + host("gateway") + ":3000/health", { signal: AbortSignal.timeout(3000) });
    results.push({ service: "gateway", ok: res.ok, status: res.status, ms: Date.now() - gwStarted });
  } catch (err) {
    results.push({ service: "gateway", ok: false, status: 0, ms: Date.now() - gwStarted, error: String(err).slice(0, 120) });
  }
  return results.sort((a, b) => a.service.localeCompare(b.service));
}

export function createGateway(ports: PortsConfig, env: NodeJS.ProcessEnv = process.env) {
  const app = express();
  app.use(createAuthMiddleware(env));
  const host = serviceHost(env);
  for (const route of buildRoutes(ports, host)) {
    if (route.path.startsWith("/api/") === false) {
      // web 应用以 base=/<name>/ 构建，根路径重定向补尾斜杠（仅精确匹配，其余交给代理）
      app.get(route.path, (req, res, next) => {
        if (req.path !== route.path) {
          next();
          return;
        }
        res.redirect(route.path + "/");
      });
    }
    app.use(
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        pathFilter: (path: string) => path.startsWith(route.path),
      })
    );
  }
  app.get("/health", (_req, res) => res.json({ status: "up", service: "gateway" }));
  app.get("/ready", async (_req, res) => {
    const targets = Object.entries(ports).filter(([name]) => name !== "gateway").flatMap(([name, port]) => [
      ...(port.server ? [{ service: name + "-server", port: port.server, path: "/api/" + name + "/health/ready" }] : []),
      ...(port.web ? [{ service: name + "-web", port: port.web, path: "/" + name + "/" }] : []),
    ]);
    const services = await Promise.all(targets.map(async (target) => {
      try {
        const response = await fetch("http://" + host(target.service) + ":" + target.port + target.path, { signal: AbortSignal.timeout(3000) });
        return { service: target.service, ready: response.ok };
      } catch { return { service: target.service, ready: false }; }
    }));
    const ready = services.length > 0 && services.every((service) => service.ready);
    res.status(ready ? 200 : 503).json({ ready, service: "gateway", services });
  });
  app.get("/api/health", async (_req, res) => {
    try {
      const probes = await probeAllServices(ports, host);
      const allOk = probes.every((p) => p.ok);
      res.json({ status: allOk ? "up" : "degraded", timestamp: new Date().toISOString(), services: probes });
    } catch (err) {
      res.status(503).json({ status: "degraded", error: String(err) });
    }
  });
  app.get("/status", (_req, res) => {
    res.type("html").send(statusDashboard());
  });
  app.get("/", (_req, res) => {
    const apps = buildRoutes(ports, host)
      .filter((route) => !route.path.startsWith("/api/"))
      .map((route) => ({ name: route.path.slice(1), href: route.path + "/" }));
    res.type("html").send(landingPage(apps));
  });
  return app;
}

interface LandingApp {
  name: string;
  href: string;
}

const APP_META: Record<string, { title: string; description: string; route: string }> = {
  applicant: { title: "求职工坊", description: "面向求职者的材料工房，从简历到面试一路打点。", route: "/applicant · :3011" },
  scholar: { title: "学者书库", description: "给长期阅读者的馆藏，书摘与图谱一并归档。", route: "/scholar · :3012" },
  assistant: { title: "智能助手", description: "日常问答的对话台，模型调用统一走网关。", route: "/assistant · :3013" },
  manager: { title: "交付管理", description: "面向项目交付的驾驶舱，需求与排期同屏。", route: "/manager · :3014" },
  designer: { title: "组件工坊", description: "设计师的展廊，下单定制组件与展陈。", route: "/designer · :3015" },
  gatherer: { title: "采集工坊", description: "资料员的剪刀，把散落网页收进平台。", route: "/gatherer · :3016 · 控制台" },
  investigator: { title: "调研工坊", description: "研究员的案头，问卷与访谈在此成文。", route: "/investigator · :3017 · 控制台" },
  assessor: { title: "评审工坊", description: "审稿人的红笔，把关意见落到条目。", route: "/assessor · :3018 · 控制台" },
};

/* eslint-disable @mt/rules/no-hardcoded-colors -- 网关为独立 Node 服务（无 @mt/ui 依赖），
   八应用 accent 色板唯一内联定义点，值与 @mt/ui APP_ACCENT_TOKENS 保持同步（ui-spec §三 v2.3）；
   同步性由 app.test.ts 的 drift guard 用例机器断言（勿删） */
export const APP_ACCENT: Record<string, string> = {
  applicant: "#a8522e",
  scholar: "#2f5a3b",
  assistant: "#4a688c",
  manager: "#3a5f84",
  designer: "#1c2530",
  gatherer: "#1f3a5c",
  investigator: "#8a6a3b",
  assessor: "#6e3b28",
};
/* eslint-enable @mt/rules/no-hardcoded-colors */

const EVENTS: Array<{ evt: string; from: string; to: string; desc: string }> = [
  { evt: "researcher.response.push", from: "调研工坊", to: "评审工坊", desc: "调研产出推送评审队列，先过质检再定去留。" },
  { evt: "requirement.created", from: "评审工坊", to: "交付管理", desc: "需求立项即进交付排期，验收口径同步落档。" },
  { evt: "knowledge.item.collected", from: "采集工坊", to: "学者书库", desc: "新收条目自动归目入藏，摘要任务随之挂起。" },
];

function landingPage(apps: LandingApp[]): string {
  const cards = apps
    .map((app) => {
      const meta = APP_META[app.name] ?? { title: app.name, description: "", route: "/" + app.name };
      const accent = APP_ACCENT[app.name] ?? "#2c4a6e";
      return `<a class="pg-app-card" href="${app.href}" style="--card-accent:${accent}"><h3 class="pg-app-name">${meta.title}</h3><p class="pg-app-desc">${meta.description}</p><span class="pg-app-route">${meta.route}</span></a>`;
    })
    .join("");
  const flows = EVENTS.map(
    (e) =>
      `<li class="pg-flow"><span class="pg-flow-evt">${e.evt}</span><span class="pg-flow-route">${e.from}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>${e.to}</span><p class="pg-flow-desc">${e.desc}</p></li>`
  ).join("");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MagicTools · 平台总览</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --background: #f4f6f8; --surface-0: #fbfcfd; --surface-1: #ffffff; --surface-2: #eef1f5;
    --text-strong: #1c2530; --text-body: #2e3a48; --text-muted: #5f6c7c; --text-faint: #8b98a8;
    --ink-600: #2c4a6e; --ink-700: #233c5a; --amber-500: #c08a35; --amber-600: #a06f2a;
    --success-50: #f0f7f1; --success-600: #4a8a5d; --success-700: #2f5a3b;
    --hairline: rgba(20,33,48,0.08); --hairline-strong: rgba(20,33,48,0.14);
    --serif: "Noto Serif SC", "Source Serif 4", "Songti SC", Georgia, serif;
    --sans: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif;
    --mono: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
  }
  body { font-family: var(--sans); background: var(--background); color: var(--text-body); min-height: 100vh; display: flex; flex-direction: column; }
  .us-masthead { background: var(--background); border-bottom: 1px solid var(--hairline); }
  .us-masthead-inner { max-width: 1080px; min-height: 72px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 24px; }
  .us-brand { display: flex; flex-direction: column; gap: 3px; flex: none; }
  .us-eyebrow { font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
  .us-appname { font-family: var(--serif); font-size: 18px; font-weight: 600; color: var(--text-strong); }
  .us-actions { margin-left: auto; display: flex; align-items: center; gap: 14px; }
  .us-status-link { font-family: var(--sans); font-size: 13px; font-weight: 500; color: var(--text-muted); text-decoration: none; }
  .us-status-link:hover { color: var(--ink-700); }
  .us-main { max-width: 1080px; width: 100%; margin: 0 auto; padding: 32px 24px 64px; display: flex; flex-direction: column; gap: 48px; }
  .pg-hero { display: flex; flex-direction: column; gap: 16px; padding-bottom: 32px; border-bottom: 1px solid var(--hairline-strong); }
  .pg-title { margin: 0; font-family: var(--serif); font-size: 28px; font-weight: 600; line-height: 1.25; color: var(--text-strong); }
  .pg-hero-sub { margin: 0; max-width: 640px; font-size: 15px; line-height: 1.75; color: var(--text-muted); }
  .pg-readouts { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 0; margin-top: 4px; }
  .pg-readout { display: inline-flex; align-items: baseline; gap: 6px; font-family: var(--mono); font-size: 12px; font-weight: 500; color: var(--text-muted); white-space: nowrap; }
  .pg-readout--data { padding-left: 16px; margin-right: 16px; border-left: 1px solid var(--hairline-strong); }
  .pg-readout b { font-size: 14px; font-weight: 600; color: var(--ink-600); }
  .pg-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  .pg-sec-title { margin: 0; display: inline-flex; align-items: baseline; gap: 12px; font-family: var(--serif); font-size: 22px; font-weight: 600; color: var(--text-strong); }
  .pg-sec-no { font-family: var(--mono); font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: var(--amber-600); }
  .pg-sec-meta { font-family: var(--mono); font-size: 12px; font-weight: 500; color: var(--text-faint); white-space: nowrap; }
  .pg-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .pg-app-card { display: flex; flex-direction: column; gap: 8px; padding: 16px 16px 12px; background: var(--surface-1); border: 1px solid var(--hairline); border-top: 4px solid var(--card-accent, var(--ink-600)); border-radius: 6px; text-decoration: none; color: inherit; cursor: pointer; transition: border-color 120ms cubic-bezier(0.4,0,0.2,1), transform 120ms cubic-bezier(0.4,0,0.2,1); }
  .pg-app-card:hover { border-color: var(--hairline-strong); transform: translateY(-2px); }
  .pg-app-card:focus-visible { outline: 2px solid var(--ink-600); outline-offset: 2px; }
  .pg-app-name { margin: 0; font-family: var(--serif); font-size: 17px; font-weight: 600; color: var(--text-strong); }
  .pg-app-desc { margin: 0; font-size: 13px; line-height: 1.6; color: var(--text-muted); }
  .pg-app-route { margin-top: auto; padding-top: 12px; font-family: var(--mono); font-size: 12px; font-weight: 500; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pg-flow-list { list-style: none; border-top: 1px solid var(--hairline-strong); }
  .pg-flow { display: grid; grid-template-columns: 236px minmax(0, 0.9fr) minmax(0, 1.3fr); align-items: center; column-gap: 24px; padding: 16px 0; border-bottom: 1px solid var(--hairline); }
  .pg-flow-evt { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--ink-700); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pg-flow-route { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--text-body); white-space: nowrap; }
  .pg-flow-route svg { width: 14px; height: 14px; color: var(--amber-600); }
  .pg-flow-desc { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--text-muted); }
  .pg-status { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 20px; padding: 16px 20px; background: var(--surface-1); border: 1px solid var(--hairline); border-radius: 6px; }
  .pg-status-cmd { display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--text-strong); }
  .pg-status-count { font-family: var(--mono); font-size: 12.5px; color: var(--text-muted); }
  .pg-status-gap { flex: 1 1 auto; }
  .pg-status-badge { display: inline-flex; align-items: center; padding: 4px 12px; background: var(--success-50); border-radius: 4px; font-size: 12px; font-weight: 700; color: var(--success-700); }
  .us-footer { margin-top: auto; background: var(--background); border-top: 1px solid var(--hairline); }
  .us-footer-inner { max-width: 1080px; margin: 0 auto; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .us-footer-note { font-family: var(--mono); font-size: 12px; font-weight: 500; color: var(--text-muted); }
  .us-footer-copy { font-size: 12px; color: var(--text-muted); }
  @media (max-width: 960px) {
    .pg-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pg-flow { grid-template-columns: minmax(0, 1fr); row-gap: 8px; }
  }
  @media (max-width: 640px) {
    .us-main { padding: 20px 16px 48px; gap: 32px; }
    .pg-grid { grid-template-columns: minmax(0, 1fr); }
    .pg-sec-head { flex-direction: column; gap: 8px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pg-app-card { transition: none; }
  }
</style>
</head>
<body>
  <header class="us-masthead">
    <div class="us-masthead-inner">
      <div class="us-brand">
        <div class="us-eyebrow">MAGICTOOLS GATEWAY</div>
        <div class="us-appname">平台总览</div>
      </div>
      <div class="us-actions">
        <a class="us-status-link" href="/status">服务状态 →</a>
      </div>
    </div>
  </header>
  <main class="us-main">
    <section class="pg-hero">
      <h1 class="pg-title">工具工房，八件套</h1>
      <p class="pg-hero-sub">两条主线在此并行：需求主线自调研经评审至交付，知识主线把采集、书库与助手串成档案长廊，求职与组件工坊向两端敞开。</p>
      <div class="pg-readouts">
        <span class="pg-readout pg-readout--data">在册应用 <b>8</b></span>
        <span class="pg-readout pg-readout--data">服务 <b>17</b></span>
        <span class="pg-readout pg-readout--data">事件契约 <b>3</b></span>
      </div>
    </section>
    <section>
      <div class="pg-sec-head">
        <h2 class="pg-sec-title"><span class="pg-sec-no">01</span>应用目录</h2>
        <span class="pg-sec-meta">4 × 2 · 应用直达</span>
      </div>
      <div class="pg-grid">${cards}</div>
    </section>
    <section>
      <div class="pg-sec-head">
        <h2 class="pg-sec-title"><span class="pg-sec-no">02</span>事件流向</h2>
        <span class="pg-sec-meta">outbox · 事件契约 3</span>
      </div>
      <ol class="pg-flow-list">${flows}</ol>
    </section>
    <section>
      <div class="pg-sec-head">
        <h2 class="pg-sec-title"><span class="pg-sec-no">03</span>服务状态</h2>
        <span class="pg-sec-meta">infra/ports.yaml</span>
      </div>
      <div class="pg-status">
        <span class="pg-status-cmd">GATEWAY /status</span>
        <span class="pg-status-count">17 服务</span>
        <span class="pg-status-gap"></span>
        <a class="pg-status-badge" href="/status" style="text-decoration:none;">全部健康</a>
      </div>
    </section>
  </main>
  <footer class="us-footer">
    <div class="us-footer-inner">
      <div class="us-footer-note">MagicTools · 统一网关入口</div>
      <div class="us-footer-copy">© 2026 MagicTools · 墨蓝石墨工房</div>
    </div>
  </footer>
</body>
</html>`;
}

function statusDashboard(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MagicTools · 系统状态</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #1a1d21; color: #e5e6eb; min-height: 100vh; padding: 32px 24px; }
  .header { max-width: 1080px; margin: 0 auto 24px; }
  h1 { font-size: 22px; font-weight: 600; }
  .status-bar { margin-top: 8px; font-size: 13px; color: #86909c; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .dot.up { background: #00b42a; box-shadow: 0 0 8px rgba(0, 180, 42, .5); }
  .dot.degraded { background: #ff7d00; box-shadow: 0 0 8px rgba(255, 125, 0, .5); }
  .dot.error { background: #f53f3f; box-shadow: 0 0 8px rgba(245, 63, 63, .5); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 1080px; margin: 0 auto; }
  .card { background: #252930; border: 1px solid #34383f; border-radius: 12px; padding: 20px; }
  .card h2 { font-size: 14px; font-weight: 500; color: #c9cdd4; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; color: #86909c; font-weight: 500; border-bottom: 1px solid #34383f; }
  td { padding: 10px 12px; border-bottom: 1px solid #2d3037; }
  .svc-name { font-family: monospace; color: #c9cdd4; }
  .svc-latency { font-family: monospace; text-align: right; color: #86909c; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 500; }
  .badge.ok { background: rgba(0, 180, 42, .15); color: #00b42a; }
  .badge.fail { background: rgba(245, 63, 63, .15); color: #f53f3f; }
  .full-width { grid-column: 1 / -1; }
  #history-chart { height: 240px; }
  .footer { max-width: 1080px; margin: 24px auto 0; font-size: 12px; color: #4e5969; }
</style>
</head>
<body>
  <div class="header">
    <h1>MagicTools · 系统监控</h1>
    <div class="status-bar">
      <span id="global-dot" class="dot degraded"></span>
      <span id="global-text">加载中…</span>
      <span style="float:right">每 5 秒自动刷新</span>
    </div>
  </div>
  <div class="grid">
    <div class="card">
      <h2>服务健康</h2>
      <table>
        <thead><tr><th>服务</th><th>状态</th><th>延迟</th></tr></thead>
        <tbody id="services-body"><tr><td colspan="3" style="color:#86909c">等待数据…</td></tr></tbody>
      </table>
    </div>
    <div class="card">
      <h2>延迟分布 (ms)</h2>
      <canvas id="latency-chart"></canvas>
    </div>
    <div class="card full-width">
      <h2>可用性趋势 (最近 60 秒)</h2>
      <canvas id="history-chart"></canvas>
    </div>
  </div>
  <div class="footer">数据来源: <code>GET /api/health</code> · MagicTools Gateway</div>

<script>
const MAX_POINTS = 12; // 60s / 5s
const history = { labels: [], upCount: [], totalCount: [] };
let latencyChart, historyChart;

async function refresh() {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    const data = await res.json();
    render(data);
  } catch (err) {
    const body = document.getElementById('services-body');
    body.innerHTML = '<tr><td colspan="3" style="color:#f53f3f">连接失败: ' + err.message + '</td></tr>';
  }
}

function render(data) {
  const dot = document.getElementById('global-dot');
  const text = document.getElementById('global-text');
  if (data.status === 'up') { dot.className = 'dot up'; text.textContent = '全部服务正常'; }
  else { dot.className = 'dot degraded'; text.textContent = '部分服务异常 / degraded'; }

  const tbody = document.getElementById('services-body');
  tbody.innerHTML = data.services.map(s =>
    '<tr>' +
    '<td class="svc-name">' + s.service + '</td>' +
    '<td><span class="badge ' + (s.ok ? 'ok' : 'fail') + '">' + (s.ok ? 'UP' : 'FAIL') + '</span></td>' +
    '<td class="svc-latency">' + (s.ok ? s.ms + ' ms' : (s.error || '—')) + '</td>' +
    '</tr>'
  ).join('');

  const labels = data.services.map(s => s.service);
  const values = data.services.map(s => s.ok ? s.ms : 0);
  if (latencyChart) { latencyChart.data.labels = labels; latencyChart.data.datasets[0].data = values; latencyChart.update(); }
  else {
    latencyChart = new Chart(document.getElementById('latency-chart'), {
      type: 'bar',
      data: { labels, datasets: [{ label: '延迟 (ms)', data: values, backgroundColor: values.map(v => v < 200 ? '#00b42a' : v < 500 ? '#ff7d00' : '#f53f3f'), borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#2d3037' }, ticks: { color: '#86909c' } }, x: { grid: { display: false }, ticks: { color: '#c9cdd4', font: { size: 11 } } } } }
    });
  }

  const up = data.services.filter(s => s.ok).length;
  history.labels.push(new Date().toLocaleTimeString('zh-CN', { minute: '2-digit', second: '2-digit' }));
  history.upCount.push(up);
  history.totalCount.push(data.services.length);
  if (history.labels.length > MAX_POINTS) { history.labels.shift(); history.upCount.shift(); history.totalCount.shift(); }

  if (historyChart) {
    historyChart.data.labels = history.labels;
    historyChart.data.datasets[0].data = history.upCount;
    historyChart.data.datasets[1].data = history.totalCount;
    historyChart.update();
  } else {
    historyChart = new Chart(document.getElementById('history-chart'), {
      type: 'line',
      data: { labels: history.labels, datasets: [
        { label: '正常', data: history.upCount, borderColor: '#00b42a', backgroundColor: 'rgba(0,180,42,.15)', fill: true, tension: .3 },
        { label: '总服务', data: history.totalCount, borderColor: '#86909c', borderDash: [4,4], pointRadius: 0, fill: false }
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, plugins: { legend: { labels: { color: '#c9cdd4' } } }, scales: { y: { beginAtZero: true, grid: { color: '#2d3037' }, ticks: { color: '#86909c', stepSize: 1 } }, x: { grid: { color: '#2d3037' }, ticks: { color: '#86909c', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } } } }
    });
  }
}

refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
}
