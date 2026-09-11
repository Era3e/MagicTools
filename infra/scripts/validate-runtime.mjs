import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { parse, stringify } from "yaml";
import { setTimeout as delay } from "node:timers/promises";
import { root, catalog, inspectImage } from "./build-images.mjs";
import { validateBuildManifest } from "./lib/runtime-artifacts.mjs";
import { makeValidationCompose, validateRuntimeEvidence } from "./lib/runtime-validation.mjs";
import { captureValidationIdentity } from "./lib/quality-evidence.mjs";
import { runProcess } from "./lib/validation-process.mjs";

export async function validateRuntime(manifestPath) {
  const runId = "runtime-" + randomBytes(8).toString("hex");
  const directory = join(root, ".qa/runtime", runId); mkdirSync(directory, { recursive: true });
  const report = { schema: "magictools-runtime-evidence/1", success: false, runId, startedAt: new Date().toISOString(),
    source: null, revision: null, mode: { database: "real", containers: "real", external: "not-invoked", liveModel: "not-run" }, checks: [], images: [] };
  const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", windowsHide: true, timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
  const composeArgs = ["compose", "--project-name", runId, "--env-file", join(directory, "empty.env"), "-f", join(directory, "compose.yml")];
  const compose = (...args) => docker(...composeArgs, ...args);
  const execute = async (...args) => {
    const result = await runProcess("docker", [...composeArgs, ...args], { cwd: directory, timeoutMs: 360_000 });
    if (result.exitCode !== 0) throw new Error("Compose 执行失败：" + args[0]);
  };
  const checked = async (name, check) => {
    const started = Date.now(); await check(); report.checks.push({ name, status: "passed", elapsedMs: Date.now() - started });
    console.log("PASS runtime:", name);
  };
  let started = false;
  let expectedBuild;
  let expectedServices;
  try {
    const images = JSON.parse(readFileSync(manifestPath, "utf8"));
    const services = catalog(); validateBuildManifest(images, services);
    expectedBuild = images; expectedServices = services;
    report.source = images.source; report.revision = images.revision;
    const current = captureValidationIdentity(root, process.env, runId);
    assert.equal(current.checkoutSha, images.source.checkoutSha, "构建与验证提交不同");
    assert.equal(current.fingerprint, images.source.fingerprint, "构建后源码已改变，请重建镜像");
    for (const item of images.images) {
      const actual = inspectImage(item.localImageId);
      assert.equal(actual.labels?.["org.opencontainers.image.revision"], images.revision);
      assert.equal(actual.os + "/" + actual.architecture, images.platform, "实际平台与清单不符：" + item.service);
      assert.ok(actual.health?.Test?.length && actual.health.Test[0] !== "NONE", "实际镜像缺少健康探针：" + item.service);
      report.images.push({ service: item.service, localImageId: actual.id });
    }
    const composeConfig = makeValidationCompose(parse(readFileSync(join(root, "infra/compose.prod.yml"), "utf8")), services, images.images, runId);
    const postgresReference = composeConfig.services.postgres.image;
    if (!/^pgvector\/pgvector:pg16@sha256:[a-f0-9]{64}$/.test(postgresReference)) throw new Error("数据库镜像必须固定pgvector digest");
    const pulled = await runProcess("docker", ["pull", "--platform", images.platform, postgresReference], { cwd: root });
    if (pulled.exitCode !== 0) throw new Error("固定数据库镜像拉取失败");
    const postgresImage = inspectImage(postgresReference);
    if (postgresImage.os + "/" + postgresImage.architecture !== images.platform) throw new Error("数据库镜像实际平台与本次运行不符");
    report.postgres = { reference: postgresReference, localImageId: postgresImage.id, platform: images.platform };
    writeFileSync(join(directory, "compose.yml"), stringify(composeConfig));
    writeFileSync(join(directory, "empty.env"), "");
    copyFileSync(join(root, "infra/postgres-init.sql"), join(directory, "postgres-init.sql"));
    assert.equal(compose("ps", "--all", "--quiet"), "", "本轮项目必须从空环境开始");
    started = true;
    await checked("cold-start-17-services", () => execute("up", "-d", "--wait", "--wait-timeout", "240", "--pull", "never"));
    const address = compose("port", "gateway", String(services.find((item) => item.service === "gateway").port));
    assert.match(address, /^127\.0\.0\.1:\d+$/);
    const origin = "http://" + address;
    const request = async (path, options) => fetch(origin + path, { ...options, signal: AbortSignal.timeout(15_000) });
    const expectHttp = async (path, status, options) => {
      const response = await request(path, options); assert.equal(response.status, status, path); return response;
    };
    await checked("isolated-images-and-nonroot-node", async () => {
      for (const item of services) {
        const id = compose("ps", "--quiet", item.service);
        const state = JSON.parse(docker("inspect", id, "--format", '{"image":{{json .Image}},"mounts":{{json .Mounts}},"health":{{json .State.Health.Status}},"labels":{{json .Config.Labels}}}'));
        assert.equal(state.image, images.images.find((image) => image.service === item.service).localImageId, item.service);
        assert.equal(state.health, "healthy", item.service);
        assert.equal(state.labels["magictools.validation"], runId);
        assert.equal(state.mounts.length, 0, "应用不能挂载源码或依赖：" + item.service);
        if (item.kind === "node") assert.equal(compose("exec", "-T", item.service, "id", "-u"), "1000");
      }
    });
    await checked("eight-databases-and-migrations", async () => {
      for (const item of services.filter((item) => item.service.endsWith("-server"))) {
        const expected = readdirSync(join(root, "apps", item.app, "server/migrations")).filter((file) => file.endsWith(".sql")).sort();
        const applied = compose("exec", "-T", "postgres", "psql", "-U", "postgres", "-d", item.app, "-At", "-c", "SELECT name FROM schema_migrations ORDER BY name").split(/\r?\n/);
        assert.deepEqual(applied, expected, item.app);
        await expectHttp(item.readinessPath, 200);
      }
    });
    await checked("assistant-probes-container-services", async () => {
      const result = JSON.parse(compose("exec", "-T", "assistant-server", "node", "-e", 'require("./dist/trouble.service").probeHealth().then(result => console.log(JSON.stringify(result))).catch(() => process.exit(1))'));
      assert.equal(result.length, 9);
      assert.equal(result.every((item) => item.ok), true, "Assistant 必须探测实际容器服务");
    });
    await checked("web-deep-links-and-assets", async () => {
      for (const item of services.filter((item) => item.kind === "web")) {
        const home = await (await expectHttp("/" + item.app + "/", 200)).text();
        const deep = await (await expectHttp("/" + item.app + "/admin/runtime-check", 200)).text();
        assert.equal(deep, home, "SPA 深链必须返回应用入口：" + item.app);
        const script = home.match(/<script[^>]*src="([^"]+\.js)"/);
        const style = home.match(/<link[^>]*href="([^"]+\.css)"/);
        assert.ok(script, item.app + " JS"); assert.ok(style, item.app + " CSS");
        for (const [match, type] of [[script, /javascript/], [style, /text\/css/]]) {
          assert.ok(match[1].startsWith("/" + item.app + "/assets/"));
          const asset = await expectHttp(match[1], 200);
          assert.match(asset.headers.get("content-type"), type);
          assert.ok((await asset.text()).length > 100);
        }
      }
    });
    let requirement;
    await checked("manager-create-and-update", async () => {
      const post = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: runId, priority: "P2" }) };
      requirement = await (await expectHttp("/api/manager/requirements", 201, post)).json();
      assert.ok(requirement.id);
      const updated = await (await expectHttp("/api/manager/requirements/" + requirement.id, 200, { ...post, method: "PATCH", body: JSON.stringify({ expectedRevision: requirement.revision, description: "runtime persistence" }) })).json();
      assert.equal(updated.description, "runtime persistence");
    });
    await checked("designer-builds-real-preview", async () => {
      const response = await expectHttp("/api/designer/preview", 201, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: 'import React from "react"; import { MtStatusTag } from "@mt/ui"; export default function Preview() { return <MtStatusTag tone="success">Runtime probe</MtStatusTag>; }' }) });
      const preview = await response.json(); assert.equal(preview.ok, true, preview.error); assert.ok(preview.previewId);
      const html = await (await expectHttp("/api/designer/preview/" + preview.previewId, 200)).text();
      assert.ok(html.includes("Runtime probe") && html.includes("<script>"));
    });
    await checked("database-outage-and-recovery", async () => {
      await execute("stop", "postgres");
      for (const item of services.filter((item) => item.service.endsWith("-server"))) {
        await expectHttp("/api/" + item.app + "/health", 200);
        await expectHttp(item.readinessPath, 503);
      }
      await expectHttp("/ready", 503);
      await execute("start", "postgres");
      let ready = false;
      for (let attempt = 0; attempt < 45; attempt++) {
        if ((await request("/ready")).status === 200) { ready = true; break; }
        await delay(1000);
      }
      assert.equal(ready, true, "数据库恢复后全服务就绪");
    });
    await checked("persistent-volume-after-recreation", async () => {
      await execute("down");
      await execute("up", "-d", "--wait", "--wait-timeout", "240", "--pull", "never");
      const nextOrigin = "http://" + compose("port", "gateway", String(services.find((item) => item.service === "gateway").port));
      const response = await fetch(nextOrigin + "/api/manager/requirements/" + requirement.id, { signal: AbortSignal.timeout(15_000) });
      assert.equal(response.status, 200); assert.equal((await response.json()).description, "runtime persistence");
    });
    const finalIdentity = captureValidationIdentity(root, process.env, runId);
    assert.equal(finalIdentity.fingerprint, images.source.fingerprint, "验收中源码已变化");
    report.success = true;
  } catch (error) { report.error = String(error); throw error; }
  finally {
    if (started) {
      if (!report.success) {
        try { writeFileSync(join(directory, "runtime.log"), compose("logs", "--no-color", "--tail", "80") + "\n"); }
        catch { /* 日志采集不能隐藏原始失败。 */ }
      }
      try { writeFileSync(join(directory, "services.json"), compose("ps", "--all", "--format", "json") + "\n"); }
      catch { /* 原始启动错误仍保留。 */ }
      try { await execute("down", "--volumes", "--remove-orphans"); report.cleanup = "passed"; }
      catch { report.success = false; report.cleanup = "failed"; process.exitCode = 1; }
    }
    report.finishedAt = new Date().toISOString();
    if (report.success) {
      try { validateRuntimeEvidence(report, expectedBuild, expectedServices); }
      catch (error) { report.success = false; report.error = String(error); process.exitCode = 1; }
    }
    writeFileSync(join(directory, "runtime.json"), JSON.stringify(report, null, 2) + "\n");
    console.log("Runtime evidence:", join(directory, "runtime.json"));
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error("用法：pnpm images:validate <本轮 build.json>");
    await validateRuntime(resolve(process.argv[2]));
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
