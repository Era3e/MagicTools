export interface PortMap {
  web: number;
  server?: number;
}

export type PortsConfig = Record<string, PortMap>;

export interface ProxyRoute {
  name: string;
  path: string;
  target: string;
}

export function buildRoutes(ports: PortsConfig, host: (serviceName: string) => string): ProxyRoute[] {
  const routes: ProxyRoute[] = [];
  for (const [name, port] of Object.entries(ports)) {
    if (port.web) {
      routes.push({ name: name + "-web", path: "/" + name, target: "http://" + host(name + "-web") + ":" + port.web });
    }
    if (port.server) {
      routes.push({ name: name + "-server", path: "/api/" + name, target: "http://" + host(name + "-server") + ":" + port.server });
    }
  }
  return routes;
}

export function serviceHost(env: NodeJS.ProcessEnv): (name: string) => string {
  return (name: string) => (env.MT_PROD === "1" ? name : "127.0.0.1");
}
