import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export function findPortsFile(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "infra", "ports.yaml");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("未找到 infra/ports.yaml，请在仓库目录内运行");
}
