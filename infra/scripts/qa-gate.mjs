import { spawnSync } from "node:child_process";

const steps = [
  ["lint", ["lint"]],
  ["build", ["build"]],
  ["unit-test", ["test"]],
  ["infra-test", ["test:infra"]],
];

let failed = false;
for (const [label, args] of steps) {
  console.log("== qa-gate: " + label + " ==");
  const result = spawnSync("pnpm.cmd", args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    failed = true;
    break;
  }
}
console.log(failed ? "QA GATE FAILED" : "QA GATE PASSED");
process.exit(failed ? 1 : 0);
