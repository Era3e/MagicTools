#!/usr/bin/env node
import { ConditionalMergeGitHubClient, ConditionalMergeManagerClient, parseConditionalMergeConfig, runConditionalMerge } from "./lib/conditional-merge.mjs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function main() {
  const config = parseConditionalMergeConfig();
  if (process.argv.includes("--check-config")) {
    const output = { valid: config.valid, errors: config.errors, liveGithub: "not-run" };
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = config.valid ? 0 : 1;
    return Promise.resolve();
  }
  if (!config.valid) throw new Error("条件合并配置无效：" + config.errors.join("；"));
  return runConditionalMerge({
    config,
    manager: new ConditionalMergeManagerClient({ baseUrl: config.managerUrl, token: config.managerToken }),
    github: new ConditionalMergeGitHubClient({ token: config.githubToken }),
  }).then((receipt) => {
    console.log(JSON.stringify(receipt, null, 2));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.message ?? error);
    process.exit(1);
  });
}
