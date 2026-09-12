const UPSTREAMS = [
  ["assessor-server", "INVESTIGATOR_DATABASE_URL", "investigator"],
  ["manager-server", "ASSESSOR_DATABASE_URL", "assessor"],
  ["scholar-server", "GATHERER_DATABASE_URL", "gatherer"],
  ["assistant-server", "SCHOLAR_DATABASE_URL", "scholar"],
];

export function recoveryConnectionFields(catalog) {
  return [...catalog.filter((item) => item.kind === "node" && item.app !== "gateway").map((item) => [item.service, "DATABASE_URL", item.app]),
    ...UPSTREAMS.filter(([service]) => catalog.some((item) => item.service === service))].map(([service, field, database]) => ({ service, field, database, variable: database.toUpperCase() + "_DATABASE_URL" }));
}

// 调用者使用Compose的config --format json解析私有env，避免另写一套dotenv解释规则。
// 本函数返回的连接值只能用于进程环境；公开回执使用bindRecoveryConnections的connections。
export function resolvedRecoveryEnvironment(compose, catalog) {
  const values = {};
  for (const item of recoveryConnectionFields(catalog)) {
    const value = compose.services?.[item.service]?.environment?.[item.field];
    if (typeof value !== "string" || !value) throw new Error("Compose解析后的恢复连接缺失：" + item.variable);
    if (Object.hasOwn(values, item.variable) && values[item.variable] !== value) throw new Error("Compose主库与上游连接不一致：" + item.variable);
    values[item.variable] = value;
  }
  return values;
}

export function bindRecoveryConnections(compose, catalog, resolved, binding) {
  const apps = catalog.filter((item) => item.kind === "node" && item.app !== "gateway").map((item) => item.app).sort();
  if (typeof binding?.container?.name !== "string" || !/^[a-z][a-z0-9-]{2,62}$/.test(binding.container.name) || !Array.isArray(binding?.databases) ||
    JSON.stringify([...binding.databases].sort()) !== JSON.stringify(apps)) throw new Error("恢复连接的业务库或目标清单不完整");
  if (catalog.some((item) => item.service === binding.container.name)) throw new Error("恢复数据库名称与应用DNS名称存在冲突");
  const expected = recoveryConnectionFields(catalog);
  const observed = Object.entries(compose.services ?? {}).flatMap(([service, definition]) => Object.keys(definition.environment ?? {})
    .filter((field) => field.endsWith("DATABASE_URL")).map((field) => service + ":" + field)).sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected.map((item) => item.service + ":" + item.field).sort())) throw new Error("恢复连接字段与主库/上游契约不一致");
  const environment = {}; const connections = [];
  for (const item of expected) {
    const reference = compose.services[item.service].environment[item.field];
    const match = typeof reference === "string" && reference.match(/^\$\{([A-Z][A-Z0-9_]*)(?::\?[^{}]*)?\}$/);
    if (!match || match[1] !== item.variable) throw new Error("恢复连接必须引用独立env变量：" + item.variable);
    let url;
    try {
      const value = resolved[item.variable];
      if (typeof value !== "string" || value !== value.trim() || /[\0\r\n\t]/.test(value)) throw new Error();
      url = new URL(value);
      decodeURIComponent(url.password);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || !["postgres", binding.container.name].includes(url.hostname) ||
        (url.port && url.port !== "5432") || decodeURIComponent(url.pathname) !== "/" + item.database || url.search || url.hash ||
        !url.username || !url.password || /[\0\r\n]/.test(decodeURIComponent(url.username))) throw new Error();
    } catch { throw new Error("恢复连接配置无效：" + item.variable); }
    url.hostname = binding.container.name; url.port = "5432";
    url.pathname = "/" + item.database;
    environment[item.variable] = url.href;
    connections.push({ service: item.service, field: item.field, database: item.database, variable: item.variable, host: binding.container.name, port: 5432 });
  }
  return { environment, connections };
}
