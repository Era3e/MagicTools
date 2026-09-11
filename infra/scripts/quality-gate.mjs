import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { root, runDatabaseValidation } from "./test-database.mjs";
import { captureValidationIdentity, verifyQualityEvidence } from "./lib/quality-evidence.mjs";
import { runPnpm } from "./lib/validation-process.mjs";

export const QUALITY_STAGES = ["lint", "build-and-unit", "coverage", "infra", "docs", "design", "database"];

export async function runQualityGate() {
  const validationId = randomBytes(12).toString("hex");
  const directory = join(root, ".qa", "quality", validationId);
  mkdirSync(directory, { recursive: true });
  const report = { schema: "magictools-quality-evidence/1", success: false, identity: null,
    startedAt: new Date().toISOString(), mode: { database: "real", external: "stub-or-mock", liveModel: "not-run" }, stages: [] };
  const commands = {
    lint: ["exec", "eslint", "."], "build-and-unit": ["exec", "turbo", "run", "build", "test"],
    coverage: ["coverage"], infra: ["test:infra"], docs: ["docs:lint"], design: ["design:check"],
  };
  try {
    report.identity = captureValidationIdentity(root, process.env, validationId);
    for (const id of QUALITY_STAGES) {
      const stage = { id, status: "running", startedAt: new Date().toISOString(), exitCode: null };
      report.stages.push(stage);
      try {
        if (id === "database") {
          stage.database = await runDatabaseValidation({ outputDirectory: join(directory, "database"), identity: report.identity });
          stage.exitCode = 0;
        } else {
          const result = await runPnpm(commands[id], { cwd: root });
          stage.exitCode = result.exitCode;
        }
        if (stage.exitCode !== 0) throw new Error(id + " 验证失败，退出码 " + stage.exitCode);
        stage.status = "passed";
      } catch (error) { stage.status = "failed"; stage.exitCode ??= 1; stage.error = String(error); throw error; }
      finally { stage.finishedAt = new Date().toISOString(); }
    }
    const current = captureValidationIdentity(root, process.env, validationId);
    report.success = true;
    verifyQualityEvidence(report, { identity: current, stages: QUALITY_STAGES,
      databaseManifest: JSON.parse(readFileSync(join(root, "infra/testing/database-suites.json"), "utf8")) });
  } catch (error) {
    report.success = false; report.error = String(error); throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    const file = join(directory, "quality.json");
    writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
    console.log("Quality evidence:", file);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runQualityGate().catch((error) => { console.error(String(error)); process.exitCode = 1; });
}
