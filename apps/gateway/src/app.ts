import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { buildRoutes, serviceHost, type PortsConfig } from "./routes";

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
