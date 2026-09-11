export function isImageRepository(value) {
  if (typeof value !== "string" || value.length > 240 || !/^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*(?::[0-9]{1,5})?(?:\/[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*)*$/.test(value)) return false;
  const port = value.split("/")[0].split(":")[1];
  return !port || (Number(port) > 0 && Number(port) <= 65535);
}

export function isRegistryNamespace(value) {
  if (!isImageRepository(value) || !value.includes("/")) return false;
  const host = value.split("/")[0];
  return host === "localhost" || host.includes(".") || host.includes(":");
}

export function runtimeCatalog(ports) {
  if (!ports?.gateway?.web) throw new Error("缺少网关端口");
  const catalog = [];
  const occupied = new Set();
  const add = (item) => {
    if (!Number.isInteger(item.port) || item.port < 1 || item.port > 65535 || occupied.has(item.port)) throw new Error("服务端口非法或重复");
    occupied.add(item.port); catalog.push(item);
  };
  for (const [app, values] of Object.entries(ports)) {
    if (!/^[a-z][a-z0-9-]*$/.test(app)) throw new Error("应用标识非法");
    if (app === "gateway") add({ service: app, app, kind: "node", port: values.web, dockerfile: "apps/gateway/Dockerfile", readinessPath: "/ready" });
    else {
      add({ service: app + "-server", app, kind: "node", port: values.server, dockerfile: `apps/${app}/server/Dockerfile`, readinessPath: `/api/${app}/health/ready` });
      add({ service: app + "-web", app, kind: "web", port: values.web, dockerfile: `apps/${app}/web/Dockerfile`, readinessPath: `/${app}/` });
    }
  }
  return catalog;
}

export function validateBuildManifest(manifest, catalog, { allowPartial = false } = {}) {
  if (manifest?.schema !== "magictools-image-build/1" || manifest.success !== true || !["release", "validation"].includes(manifest.mode)) throw new Error("构建清单未成功完成");
  if (!manifest.source || typeof manifest.source.clean !== "boolean" || !/^[a-f0-9]{40}$/.test(manifest.source.checkoutSha) || !/^[a-f0-9]{64}$/.test(manifest.source.fingerprint)) throw new Error("构建来源无效");
  const revision = manifest.source.clean ? manifest.source.checkoutSha : "worktree-" + manifest.source.fingerprint;
  if (manifest.revision !== revision || (manifest.mode === "release" && !manifest.source.clean)) throw new Error("发布构建必须绑定干净源码，验证工作树不能冒充提交");
  if (!/^linux\/(amd64|arm64)$/.test(manifest.platform)) throw new Error("构建目标平台无效");
  if (allowPartial && manifest.mode !== "validation") throw new Error("发布清单必须包含完整服务");
  if (!Array.isArray(manifest.images) || !manifest.images.length || (!allowPartial && manifest.images.length !== catalog.length)) throw new Error("构建清单缺少服务");
  const seen = new Set();
  for (const item of manifest.images) {
    if (!catalog.some((service) => service.service === item.service) || seen.has(item.service)) throw new Error("构建服务未知或重复");
    seen.add(item.service);
    if (!/^sha256:[a-f0-9]{64}$/.test(item.localImageId) || item.revision !== revision || item.healthcheck !== true || item.platform !== manifest.platform) throw new Error("镜像身份、平台或就绪契约不符");
    if (typeof item.reference !== "string" || !item.reference.endsWith("/" + item.service + ":" + revision) || !isImageRepository(item.reference.slice(0, -revision.length - 1))) throw new Error("服务镜像引用无效");
  }
  return manifest;
}
