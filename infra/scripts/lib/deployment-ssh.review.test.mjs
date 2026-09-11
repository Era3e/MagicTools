import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deploymentFixture } from "./deployment-fixture.mjs";
import { digestBytes, validateDeploymentConfig } from "./release-artifacts.mjs";
import { deployRemote } from "../deploy-ssh.mjs";

function fixture(rollback = false) {
  const files = deploymentFixture();
  const manifestBytes = readFileSync(join(files.releaseDirectory, "release.json"));
  const release = JSON.parse(manifestBytes.toString("utf8"));
  const { config, configVersion } = validateDeploymentConfig(JSON.parse(readFileSync(files.configFile, "utf8")));
  const attemptId = "c".repeat(16);
  const receipt = { schema: "magictools-deployment-receipt/1", attemptId, action: rollback ? "rollback" : "deploy",
    success: true, stage: "succeeded", secretsPreserved: true, project: config.project,
    releaseId: release.releaseId, revision: release.revision, mode: release.mode,
    manifestSha256: digestBytes(manifestBytes), configVersion,
    ready: release.images.map(({ service, reference, localImageId, platform }) => ({ service, reference, localImageId, platform, healthy: true })) };
  const options = { host: "review@server.example", secretsFile: "/opt/review/existing.env", stateDirectory: "/opt/review/state",
    remoteDirectory: "/opt/review/deployer", ...(rollback ? { rollback: true } : { releaseDirectory: files.releaseDirectory, configFile: files.configFile }) };
  const calls = [];
  const snapshotFiles = new Map(["release.json", "ports.json", "compose.json", "postgres-init.sql"].map((name) =>
    ["bundle/" + name, readFileSync(join(files.releaseDirectory, name))]));
  snapshotFiles.set("config.json", readFileSync(files.configFile));
  const outputDirectory = join(files.directory, "ssh-review");
  const dependencies = { outputDirectory, executeTransport: async (command, args) => {
    calls.push({ command, args });
    if (command === "scp" && args.at(-1).endsWith("remote-receipt.json")) writeFileSync(args.at(-1), JSON.stringify(receipt));
    if (command === "scp" && args.at(-2).startsWith(options.host + ":" + options.stateDirectory + "/attempts/")) {
      const key = args.at(-2).slice((options.host + ":" + options.stateDirectory + "/attempts/" + attemptId + "/").length);
      if (snapshotFiles.has(key)) {
        mkdirSync(dirname(args.at(-1)), { recursive: true });
        writeFileSync(args.at(-1), snapshotFiles.get(key));
      }
    }
    return { exitCode: 0, stdout: command === "ssh" && args.at(-1).startsWith("node ") ? "Deployment attempt: " + attemptId + "\n" : "" };
  } };
  const report = () => JSON.parse(readFileSync(join(outputDirectory, readdirSync(outputDirectory)[0], "transport.json"), "utf8"));
  return { files, options, receipt, calls, dependencies, report, attemptId, snapshotFiles };
}

for (const rollback of [false, true]) {
  test("独立SSH验收：完整" + (rollback ? "回退" : "部署") + "回执通过且秘密内容不进入上传载荷", async () => {
    const input = fixture(rollback);
    const report = await deployRemote(input.options, input.dependencies);
    assert.equal(report.success, true); assert.equal(report.remoteOutcome, "succeeded");
    const upload = input.calls.find(({ command, args }) => command === "scp" && args.includes("-r"));
    assert.ok(upload);
    const payload = upload.args.at(-2);
    const entries = readdirSync(payload, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
    for (const entry of entries) {
      assert.doesNotMatch(entry.name, /(?:^|\.)env(?:\.|$)/);
      assert.equal(readFileSync(join(entry.parentPath ?? entry.path, entry.name), "utf8").includes("unit-secret-that-must-remain"), false);
    }
    assert.equal(JSON.stringify(input.calls).includes("unit-secret-that-must-remain"), false);
    assert.ok(input.calls.every(({ args }) => args.includes("BatchMode=yes")));
    if (rollback) {
      const downloads = input.calls.filter(({ command, args }) => command === "scp" && !args.includes("-r"));
      assert.deepEqual(downloads.map(({ args }) => args.at(-2).split("/attempts/" + input.attemptId + "/")[1]).sort(),
        ["receipt.json", ...input.snapshotFiles.keys()].sort());
    }
  });
}

test("独立SSH验收：回退缺少制品配置身份及服务清单时不能报告成功", async () => {
  const input = fixture(true);
  for (const key of ["project", "releaseId", "revision", "mode", "manifestSha256", "configVersion"]) delete input.receipt[key];
  input.receipt.ready = [{ healthy: true }];
  await assert.rejects(deployRemote(input.options, input.dependencies), /回退|回执|结果|制品|配置/);
  assert.equal(input.report().success, false);
  assert.notEqual(input.report().remoteOutcome, "succeeded");
});

test("独立SSH验收：回退遗漏服务或使用移动引用时不能报告成功", async (t) => {
  for (const variant of ["missing-service", "mutable-reference", "duplicate-service"]) {
    await t.test(variant, async () => {
      const input = fixture(true);
      if (variant === "missing-service") input.receipt.ready.pop();
      if (variant === "mutable-reference") input.receipt.ready[0].reference = "registry.example/review:latest";
      if (variant === "duplicate-service") input.receipt.ready[1] = structuredClone(input.receipt.ready[0]);
      await assert.rejects(deployRemote(input.options, input.dependencies), /回退|回执|结果|制品|配置/);
      assert.equal(input.report().success, false);
    });
  }
});

test("独立SSH验收：正向回执的项目源码与制品模式必须一致", async (t) => {
  for (const [key, wrongValue] of [["project", "other-project"], ["revision", "f".repeat(40)], ["mode", "validation"]]) {
    await t.test(key, async () => {
      const input = fixture(); input.receipt[key] = wrongValue;
      await assert.rejects(deployRemote(input.options, input.dependencies), /回执|结果|制品|配置/);
      assert.equal(input.report().success, false);
    });
  }
});

test("独立SSH验收：回执就绪证据必须包含实际镜像ID和匹配平台", async (t) => {
  for (const rollback of [false, true]) {
    for (const variant of ["missing-image-id", "invalid-image-id", "wrong-platform"]) {
      await t.test((rollback ? "rollback-" : "deploy-") + variant, async () => {
        const input = fixture(rollback);
        if (variant === "missing-image-id") delete input.receipt.ready[0].localImageId;
        if (variant === "invalid-image-id") input.receipt.ready[0].localImageId = "sha256:short";
        if (variant === "wrong-platform") input.receipt.ready[0].platform = "linux/arm64";
        await assert.rejects(deployRemote(input.options, input.dependencies), /回执|结果|制品|配置|回退|镜像/);
        assert.equal(input.report().success, false);
      });
    }
  }
});

test("独立SSH验收：回退快照损坏或回读中断不能生成成功结论", async (t) => {
  for (const variant of ["sql-checksum", "manifest-schema", "config-mismatch", "snapshot-download-exit"]) {
    await t.test(variant, async () => {
      const input = fixture(true);
      if (variant === "sql-checksum") input.snapshotFiles.set("bundle/postgres-init.sql", Buffer.from("SELECT 'corrupted';\n"));
      if (variant === "manifest-schema") {
        const manifest = JSON.parse(input.snapshotFiles.get("bundle/release.json")); manifest.schema = "unexpected/1";
        input.snapshotFiles.set("bundle/release.json", Buffer.from(JSON.stringify(manifest)));
      }
      if (variant === "config-mismatch") {
        const config = JSON.parse(input.snapshotFiles.get("config.json")); config.gatewayPort += 1;
        input.snapshotFiles.set("config.json", Buffer.from(JSON.stringify(config)));
      }
      if (variant === "snapshot-download-exit") {
        const transport = input.dependencies.executeTransport;
        input.dependencies.executeTransport = async (command, args) => {
          const returned = await transport(command, args);
          if (command === "scp" && args.at(-2).endsWith("/bundle/ports.json")) returned.exitCode = 1;
          return returned;
        };
      }
      await assert.rejects(deployRemote(input.options, input.dependencies), /回退|回执|结果|制品|配置|发布|JSON|校验|快照/);
      assert.equal(input.report().success, false);
      assert.equal(input.report().remoteOutcome, "unknown");
    });
  }
});

test("独立SSH验收：回读失败与错误attempt均保留远端状态未确认", async (t) => {
  for (const variant of ["readback-exit", "receipt-attempt", "last-attempt", "ssh-exit"]) {
    await t.test(variant, async () => {
      const input = fixture(); const transport = input.dependencies.executeTransport;
      input.dependencies.executeTransport = async (command, args) => {
        const returned = await transport(command, args);
        const executing = command === "ssh" && args.at(-1).startsWith("node ");
        if (variant === "readback-exit" && command === "scp" && args.at(-1).endsWith("remote-receipt.json")) returned.exitCode = 1;
        if (variant === "last-attempt" && executing) returned.stdout += "Deployment attempt: " + "d".repeat(16) + "\n";
        if (variant === "ssh-exit" && executing) returned.exitCode = 255;
        return returned;
      };
      if (variant === "receipt-attempt") input.receipt.attemptId = "e".repeat(16);
      await assert.rejects(deployRemote(input.options, input.dependencies), /回执|远端/);
      assert.equal(input.report().success, false);
      assert.equal(input.report().remoteOutcome, "unknown");
    });
  }
});
