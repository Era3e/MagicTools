import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deploymentFixture } from "./deployment-fixture.mjs";
import { digestBytes, validateDeploymentConfig } from "./release-artifacts.mjs";
import { deployRemote } from "../deploy-ssh.mjs";

const inputFor = (fixture) => ({ ...fixture, host: "deploy@server.example", stateDirectory: "/opt/magictools/state", secretsFile: "/opt/magictools/existing.env", remoteDirectory: "/opt/magictools/deployer" });
const outputFor = (fixture) => join(fixture.directory, "transport");
const reportFor = (directory) => JSON.parse(readFileSync(join(directory, readdirSync(directory)[0], "transport.json"), "utf8"));

test("SSH子进程失败写失败回执，远端未执行时不报告部署成功", async () => {
  const fixture = deploymentFixture(); const calls = [];
  await assert.rejects(deployRemote(inputFor(fixture), { outputDirectory: outputFor(fixture), executeTransport: async (command, args) => {
    calls.push({ command, args }); return { exitCode: 255, stdout: "" };
  } }), /SSH|远端|传输/);
  const report = reportFor(outputFor(fixture));
  assert.equal(report.success, false); assert.equal(report.remoteOutcome, "not-started");
  assert.equal(calls.length, 1); assert.equal(calls[0].command, "ssh");
});

test("SSH执行退出0仍须回读成功回执，秘密文件只传远端路径且不上传", async () => {
  const fixture = deploymentFixture(); const calls = []; const input = inputFor(fixture);
  await assert.rejects(deployRemote(input, { outputDirectory: outputFor(fixture), executeTransport: async (command, args) => {
    calls.push({ command, args });
    return { exitCode: 0, stdout: command === "ssh" && args.at(-1).includes("node ") ? "missing receipt" : "" };
  } }), /回执/);
  const report = reportFor(outputFor(fixture)); assert.equal(report.success, false);
  assert.equal(report.remoteOutcome, "unknown");
  const upload = calls.find((call) => call.command === "scp"); assert.ok(upload);
  const payload = upload.args[upload.args.length - 2];
  const names = readdirSync(payload, { recursive: true });
  assert.equal(names.some((name) => name.endsWith(".env")), false);
  assert.ok(names.includes("config.json"));
  assert.equal(JSON.stringify(calls).includes("unit-secret-that-must-remain"), false);
  assert.ok(calls.at(-1).args.at(-1).includes("/opt/magictools/existing.env"));
});

test("远端参数注入或公开配置夹带秘密在SSH前拒绝", async () => {
  for (const variant of ["host", "remote-path", "public-secret"]) {
    const fixture = deploymentFixture(); const input = inputFor(fixture); let called = false;
    if (variant === "host") input.host = "-oProxyCommand=unexpected";
    if (variant === "remote-path") input.remoteDirectory = "/opt/../../outside";
    if (variant === "public-secret") {
      const config = JSON.parse(readFileSync(input.configFile, "utf8")); config.API_KEY = "private-key"; writeFileSync(input.configFile, JSON.stringify(config));
    }
    await assert.rejects(deployRemote(input, { outputDirectory: outputFor(fixture), executeTransport: async () => { called = true; } }));
    assert.equal(called, false); assert.equal(reportFor(outputFor(fixture)).success, false);
  }
});

test("远端目录别名通过受限attempt ID回读，结果须绑定上传制品和配置", async () => {
  const fixture = deploymentFixture(); const input = { ...inputFor(fixture), stateDirectory: "/opt/./magictools/state-link" };
  const releaseBytes = readFileSync(join(input.releaseDirectory, "release.json"));
  const release = JSON.parse(releaseBytes.toString("utf8"));
  const config = validateDeploymentConfig(JSON.parse(readFileSync(input.configFile, "utf8")));
  const attemptId = "a".repeat(16); const calls = [];
  const receipt = { schema: "magictools-deployment-receipt/1", attemptId, action: "deploy", success: true, stage: "succeeded", secretsPreserved: true, project: config.config.project, revision: release.revision, mode: release.mode,
    releaseId: release.releaseId, manifestSha256: digestBytes(releaseBytes), configVersion: config.configVersion,
    ready: release.images.map((image) => ({ service: image.service, reference: image.reference, healthy: true, platform: release.platform, localImageId: image.localImageId })) };
  const result = await deployRemote(input, { outputDirectory: outputFor(fixture), executeTransport: async (command, args) => {
    calls.push({ command, args });
    if (command === "scp" && args.at(-1).endsWith("remote-receipt.json")) writeFileSync(args.at(-1), JSON.stringify(receipt));
    return { exitCode: 0, stdout: command === "ssh" && args.at(-1).includes("node ") ? "Deployment receipt: /actual/storage/receipt.json\nDeployment attempt: " + attemptId + "\n" : "" };
  } });
  assert.equal(result.success, true); assert.equal(result.remoteOutcome, "succeeded");
  assert.ok(calls.some((call) => call.args.includes(input.host + ":/opt/magictools/state-link/attempts/" + attemptId + "/receipt.json")));
});

test("SSH非零退出或回执内容不符不能凭远端success字段报告成功", async () => {
  for (const variant of ["exit", "receipt", "mismatch"]) {
    const fixture = deploymentFixture(); const input = inputFor(fixture);
    const bytes = readFileSync(join(input.releaseDirectory, "release.json")); const release = JSON.parse(bytes.toString("utf8"));
    const attemptId = "b".repeat(16);
    const receipt = { schema: "magictools-deployment-receipt/1", attemptId, action: "deploy", success: variant !== "receipt", stage: "succeeded", secretsPreserved: true,
      project: JSON.parse(readFileSync(input.configFile, "utf8")).project, revision: release.revision, mode: release.mode,
      releaseId: release.releaseId, manifestSha256: variant === "mismatch" ? "f".repeat(64) : digestBytes(bytes),
      configVersion: validateDeploymentConfig(JSON.parse(readFileSync(input.configFile, "utf8"))).configVersion,
      ready: release.images.map((image) => ({ service: image.service, reference: image.reference, healthy: true, platform: release.platform, localImageId: image.localImageId })) };
    await assert.rejects(deployRemote(input, { outputDirectory: outputFor(fixture), executeTransport: async (command, args) => {
      if (command === "scp" && args.at(-1).endsWith("remote-receipt.json")) writeFileSync(args.at(-1), JSON.stringify(receipt));
      const executed = command === "ssh" && args.at(-1).includes("node ");
      return { exitCode: executed && variant === "exit" ? 255 : 0, stdout: executed ? "Deployment attempt: " + attemptId : "" };
    } }));
    const report = reportFor(outputFor(fixture)); assert.equal(report.success, false);
    assert.notEqual(report.remoteOutcome, "succeeded");
  }
});
