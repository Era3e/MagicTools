import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runtimeCatalog } from "./lib/runtime-artifacts.mjs";
import { digestBytes, releaseFiles, validateDeploymentConfig, validateReleaseManifest } from "./lib/release-artifacts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const exec = promisify(execFile);
const remotePath = (value) => typeof value === "string" && /^\/[A-Za-z0-9._/-]+$/.test(value) && !value.split("/").includes("..");
const quote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
const parseFile = (path, label) => { try { return JSON.parse(readFileSync(path, "utf8")); } catch { throw new Error(label + "读取或JSON解析失败"); } };
async function executeTransport(command, args) {
  try {
    const result = await exec(command, args, { windowsHide: true, timeout: 25 * 60_000, maxBuffer: 4 * 1024 * 1024 });
    return { exitCode: 0, stdout: result.stdout };
  } catch (error) { return { exitCode: typeof error.code === "number" ? error.code : 1, stdout: error.stdout ?? "" }; }
}

export async function deployRemote(options, dependencies = {}) {
  const runId = randomBytes(8).toString("hex");
  const directory = join(dependencies.outputDirectory ?? join(root, ".qa/deploy-transfers"), runId);
  const payload = join(directory, "payload"); mkdirSync(payload, { recursive: true });
  const report = { schema: "magictools-deployment-transport/1", runId, success: false, remoteOutcome: "not-started", startedAt: new Date().toISOString(), stage: "preflight" };
  const run = dependencies.executeTransport ?? executeTransport;
  try {
    if (!/^(?:[A-Za-z0-9_][A-Za-z0-9_.-]*@)?[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(options.host ?? "")) throw new Error("SSH主机参数非法，请使用主机名或已配置别名");
    for (const value of [options.remoteDirectory ?? "/opt/magictools/deployer", options.secretsFile, options.stateDirectory]) if (!remotePath(value)) throw new Error("远端路径必须是无跳转的绝对POSIX路径");
    const remoteDirectory = posix.normalize(options.remoteDirectory ?? "/opt/magictools/deployer");
    const remoteState = posix.normalize(options.stateDirectory);
    const remoteSecrets = posix.normalize(options.secretsFile);
    const parent = remoteDirectory.replace(/\/$/, "") + "/deploy-" + runId;
    const remotePayload = parent + "/payload";
    let expectedRelease; let expectedConfig;
    if (options.rollback) {
      if (options.releaseDirectory || options.configFile) throw new Error("远端回退使用既有成功快照，不能指定新制品或配置");
    } else {
      if (!options.releaseDirectory || !options.configFile) throw new Error("远端部署必须指定本地制品目录与公开配置");
      expectedConfig = validateDeploymentConfig(parseFile(options.configFile, "公开配置"));
      const releaseDirectory = resolve(options.releaseDirectory);
      const catalog = runtimeCatalog(parseFile(join(releaseDirectory, "ports.json"), "端口配置"));
      const manifest = readFileSync(join(releaseDirectory, "release.json"));
      try { expectedRelease = JSON.parse(manifest.toString("utf8")); } catch { throw new Error("发布清单JSON无效"); }
      validateReleaseManifest(expectedRelease, catalog, { allowValidation: options.allowValidation === true });
      const bundle = join(payload, "release"); mkdirSync(bundle);
      for (const file of expectedRelease.files) {
        const bytes = readFileSync(join(releaseDirectory, file.path));
        if (digestBytes(bytes) !== file.sha256 || !releaseFiles.includes(file.path)) throw new Error("制品文件校验失败");
        writeFileSync(join(bundle, file.path), bytes);
      }
      writeFileSync(join(bundle, "release.json"), manifest);
      writeFileSync(join(payload, "config.json"), JSON.stringify(expectedConfig.config, null, 2) + "\n");
      report.releaseId = expectedRelease.releaseId; report.manifestSha256 = digestBytes(manifest); report.configVersion = expectedConfig.configVersion;
    }
    mkdirSync(join(payload, "scripts/lib"), { recursive: true });
    for (const name of ["deploy-release.mjs", "lib/runtime-artifacts.mjs", "lib/release-artifacts.mjs", "lib/deployment-state.mjs"]) {
      writeFileSync(join(payload, "scripts", name), readFileSync(join(root, "infra/scripts", name)));
    }
    report.host = options.host;
    const ssh = ["-T", "-o", "BatchMode=yes", options.host];
    report.stage = "prepare";
    let result = await run("ssh", [...ssh, "mkdir -p " + quote(remoteDirectory) + " && mkdir " + quote(parent)]);
    if (result.exitCode !== 0) throw new Error("SSH准备远端目录失败（" + result.exitCode + "）");
    report.stage = "upload";
    result = await run("scp", ["-o", "BatchMode=yes", "-r", payload, options.host + ":" + parent + "/"]);
    if (result.exitCode !== 0) throw new Error("SSH制品传输失败（" + result.exitCode + "）");
    const args = [remotePayload + "/scripts/deploy-release.mjs", "--secrets", remoteSecrets, "--state-dir", remoteState];
    if (options.rollback) args.push("--rollback");
    else args.push("--release", remotePayload + "/release", "--config", remotePayload + "/config.json");
    if (options.allowValidation) args.push("--validation");
    report.stage = "execute"; report.remoteOutcome = "unknown";
    result = await run("ssh", [...ssh, "node " + args.map(quote).join(" ")]);
    const attemptLine = result.stdout.split(/\r?\n/).filter((line) => line.startsWith("Deployment attempt: ")).at(-1);
    const remoteAttempt = attemptLine?.slice("Deployment attempt: ".length).trim();
    if (!/^[a-f0-9]{16}$/.test(remoteAttempt ?? "")) throw new Error("SSH未返回可验证的回执标识，远端状态未确认");
    // 路径由调用方的状态目录和受限ID构造，支持该目录在服务器上是符号链接。
    const remoteReceipt = remoteState.replace(/\/$/, "") + "/attempts/" + remoteAttempt + "/receipt.json";
    report.stage = "readback";
    const localReceipt = join(directory, "remote-receipt.json");
    const copied = await run("scp", ["-o", "BatchMode=yes", options.host + ":" + remoteReceipt, localReceipt]);
    if (copied.exitCode !== 0) throw new Error("SSH回执回读失败，远端状态未确认");
    const receipt = parseFile(localReceipt, "远端回执");
    if (receipt.schema !== "magictools-deployment-receipt/1" || !/^[a-f0-9]{16}$/.test(receipt.attemptId) || !remoteReceipt.endsWith("/" + receipt.attemptId + "/receipt.json")) throw new Error("远端回执身份非法");
    report.remoteAttemptId = receipt.attemptId;
    if (receipt.success === false) report.remoteOutcome = "failed";
    if (result.exitCode !== 0 || receipt.success !== true || receipt.secretsPreserved !== true || receipt.stage !== "succeeded") throw new Error("远端部署未成功，请查看回读回执");
    if (receipt.action !== (options.rollback ? "rollback" : "deploy")) throw new Error("远端回执动作与请求不一致");
    if (options.rollback) {
      report.stage = "verify-rollback-snapshot";
      const snapshot = join(directory, "rollback-snapshot"); mkdirSync(join(snapshot, "bundle"), { recursive: true });
      for (const name of ["bundle/release.json", ...releaseFiles.map((file) => "bundle/" + file), "config.json"]) {
        const remoteFile = remoteState.replace(/\/$/, "") + "/attempts/" + remoteAttempt + "/" + name;
        const readback = await run("scp", ["-o", "BatchMode=yes", options.host + ":" + remoteFile, join(snapshot, name)]);
        if (readback.exitCode !== 0) throw new Error("SSH回退快照回读失败，不能确认回退结果");
      }
      const manifest = readFileSync(join(snapshot, "bundle/release.json"));
      expectedRelease = parseFile(join(snapshot, "bundle/release.json"), "回退发布清单");
      const catalog = runtimeCatalog(parseFile(join(snapshot, "bundle/ports.json"), "回退端口配置"));
      validateReleaseManifest(expectedRelease, catalog, { allowValidation: options.allowValidation === true });
      for (const file of expectedRelease.files) if (digestBytes(readFileSync(join(snapshot, "bundle", file.path))) !== file.sha256) throw new Error("回退快照校验失败");
      expectedConfig = validateDeploymentConfig(parseFile(join(snapshot, "config.json"), "回退公开配置"));
      report.releaseId = expectedRelease.releaseId; report.manifestSha256 = digestBytes(manifest); report.configVersion = expectedConfig.configVersion;
    }
    if (receipt.project !== expectedConfig.config.project || receipt.revision !== expectedRelease.revision || receipt.mode !== expectedRelease.mode ||
      receipt.releaseId !== expectedRelease.releaseId || receipt.manifestSha256 !== report.manifestSha256 || receipt.configVersion !== report.configVersion ||
      !Array.isArray(receipt.ready) || receipt.ready.length !== expectedRelease.images.length || expectedRelease.images.some((image) =>
        !receipt.ready.some((item) => item.service === image.service && item.reference === image.reference && item.healthy === true && item.platform === expectedRelease.platform && /^sha256:[a-f0-9]{64}$/.test(item.localImageId)))) throw new Error("远端结果与完整制品/配置不一致");
    report.success = true; report.remoteOutcome = "succeeded"; report.stage = "succeeded";
  } catch (error) { report.error = String(error); throw error; }
  finally {
    report.finishedAt = new Date().toISOString();
    writeFileSync(join(directory, "transport.json"), JSON.stringify(report, null, 2) + "\n");
    console.log("Remote deployment evidence:", join(directory, "transport.json"));
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2); const options = {};
    const names = { "--host": "host", "--remote-dir": "remoteDirectory", "--release": "releaseDirectory", "--config": "configFile", "--secrets": "secretsFile", "--state-dir": "stateDirectory" };
    while (args.length) {
      const arg = args.shift();
      if (arg === "--rollback") options.rollback = true;
      else if (arg === "--validation") options.allowValidation = true;
      else if (names[arg] && args[0] && !args[0].startsWith("--")) options[names[arg]] = args.shift();
      else throw new Error("SSH部署参数未知或缺值");
    }
    await deployRemote(options);
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
