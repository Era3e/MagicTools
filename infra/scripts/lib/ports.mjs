export function nextFree(taken, base) {
  let port = base;
  while (taken.includes(port)) port += 1;
  return port;
}

export function allocPorts(existing, name) {
  const reserved = existing[name];
  if (reserved) {
    // ports.yaml 中已登记 = 端口保留，直接复用（8 个子项目端口在注册表中预登记）
    return { web: reserved.web, server: reserved.server };
  }
  const entries = Object.entries(existing);
  const web = nextFree(entries.map(([, p]) => p.web).filter(Boolean), 4001);
  const server = nextFree(entries.map(([, p]) => p.server).filter(Boolean), 5001);
  return { web, server };
}
