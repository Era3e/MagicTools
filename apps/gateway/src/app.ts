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
    app.use(
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        pathFilter: (path: string) => path.startsWith(route.path),
      })
    );
  }
  app.get("/health", (_req, res) => res.json({ status: "up", service: "gateway" }));
  return app;
}
