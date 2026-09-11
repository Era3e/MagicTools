import { makeValidationCompose } from "./runtime-validation.mjs";

const binding = (value, key, secret = false) => {
  const match = typeof value === "string" && value.match(/^\$\{([A-Z][A-Z0-9_]*)(?::([?-])([^{}]*))?\}$/);
  return match && match[1] === key && !(secret && match[2] === "-" && match[3]);
};

export function assertDeploymentValidationIsolation(base, catalog, images) {
  // 复用现有资源白名单，但不使用其重写结果：实际部署仍消费原制品，需额外验证保留的字段。
  makeValidationCompose(base, catalog, images, "deployment-validation-preflight");
  const apps = new Set(catalog.filter((item) => item.service.endsWith("-server")).map((item) => item.app));
  for (const [name, service] of Object.entries(base.services)) {
    if (name !== "gateway" && service.ports?.length) throw new Error("部署验证禁止宿主数据库或业务服务端口");
    if (name === "postgres") {
      if (Object.keys(service.environment).some((key) => !["POSTGRES_PASSWORD", "POSTGRES_DB"].includes(key)) || service.environment.POSTGRES_DB !== "magictools") throw new Error("部署验证数据库初始化环境不符");
      const password = service.environment.POSTGRES_PASSWORD;
      if (password !== "postgres" && !binding(password, "POSTGRES_PASSWORD", true)) throw new Error("部署验证不能使用固化的数据库凭证");
      continue;
    }
    for (const [key, value] of Object.entries(service.environment ?? {})) {
      if (key === "PORT") {
        if (String(value) !== String(catalog.find((item) => item.service === name).port)) throw new Error("部署验证端口与清单不符");
      } else if (key === "MT_PROD") {
        if (String(value) !== "1") throw new Error("部署验证必须使用容器服务寻址");
      } else if (key.endsWith("DATABASE_URL")) {
        const app = key === "DATABASE_URL" ? name.slice(0, -7) : key.slice(0, -13).toLowerCase();
        const variable = app.toUpperCase() + "_DATABASE_URL";
        if (!apps.has(app) || (value !== "postgres://postgres:postgres@postgres:5432/" + app && !binding(value, variable, true))) throw new Error("部署验证数据库连接必须指向本次独立实例");
      } else if (!binding(value, key, /KEY|TOKEN|SECRET|PASSWORD|JWT|USERNAME/.test(key))) {
        throw new Error("部署验证不能携带硬编码运行配置或秘密：" + key);
      }
    }
  }
  return base;
}
