import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { findPortsFile } from "./ports-file";

describe("findPortsFile", () => {
  it("从包目录向上定位仓库 ports.yaml", () => {
    const p = findPortsFile(process.cwd());
    expect(p.replace(/\\/g, "/").endsWith("infra/ports.yaml")).toBe(true);
    expect(existsSync(p)).toBe(true);
  });

  it("找不到时抛出带信息错误", () => {
    expect(() => findPortsFile("C:/definitely-not-exist-mt-xyz")).toThrow(/未找到/);
  });
});
