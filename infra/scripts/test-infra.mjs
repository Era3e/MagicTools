import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lib = join(root, "infra/scripts/lib");
const tests = readdirSync(lib).filter((file) => file.endsWith(".test.mjs")).sort().map((file) => join(lib, file));
if (!tests.length) throw new Error("基础设施测试清单为空");

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Node 20/Windows 不展开 shell glob，显式枚举后跨平台执行同一批测试。
run(["--test", ...tests]);
run([join(lib, "docs-guard.mjs")]);
