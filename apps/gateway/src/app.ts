import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { buildRoutes, serviceHost, type PortsConfig } from "./routes";

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
  app.use((req, res, next) => {
    const token = env.GATEWAY_TOKEN;
    if (!token || req.headers["x-access-token"] === token) {
      next();
      return;
    }
    res.status(401).json({ code: 401, message: "未授权" });
  });
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

const APP_META: Record<string, { title: string; description: string }> = {
  applicant: { title: "求职助手", description: "岗位管理与简历分析改写" },
  gatherer: { title: "信息采集", description: "多源信息订阅与 LLM 摘要" },
  investigator: { title: "需求调研", description: "问卷调研与飞书集成" },
  assessor: { title: "方案评审", description: "技术方案分析与评审结论" },
  manager: { title: "需求管理", description: "需求排期与迭代跟踪" },
  designer: { title: "页面生成", description: "组件生成与页面预览" },
  scholar: { title: "知识库", description: "知识条目检索与图谱" },
  assistant: { title: "智能助手", description: "意图路由与多轮对话" },
};

function landingPage(apps: LandingApp[]): string {
  const cards = apps
    .map((app) => {
      const meta = APP_META[app.name] ?? { title: app.name, description: "" };
      return `<a class="card" href="${app.href}"><div class="title">${meta.title}</div><div class="name">${app.name}</div><div class="desc">${meta.description}</div></a>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MagicTools</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f5f6fa; color: #1f2329; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 48px 24px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .subtitle { color: #86909c; margin-bottom: 40px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; width: 100%; max-width: 1080px; }
  .card { display: block; background: #ffffff; border: 1px solid #e5e6eb; border-radius: 12px; padding: 20px; text-decoration: none; color: inherit; transition: all .2s; }
  .card:hover { border-color: #3370ff; box-shadow: 0 4px 16px rgba(51, 112, 255, .12); transform: translateY(-2px); }
  .title { font-size: 17px; font-weight: 600; }
  .name { display: inline-block; margin-top: 6px; font-size: 12px; color: #3370ff; background: rgba(51, 112, 255, .08); border-radius: 4px; padding: 1px 8px; }
  .desc { margin-top: 10px; font-size: 13px; color: #86909c; line-height: 1.6; }
</style>
</head>
<body>
  <h1>MagicTools</h1>
  <p class="subtitle">AI 工具集 · 选择一个应用开始</p>
  <div class="grid">${cards}</div>
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