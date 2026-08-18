import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { loadYamlFile, resolveEnvOverrides, validateConfig } from "./index";

const schema = z.object({ web: z.number(), server: z.number().optional() });

describe("@mt/config", () => {
  it("loadYamlFile 解析 YAML 文件", () => {
    const dir = mkdtempSync(join(tmpdir(), "mtcfg-"));
    const p = join(dir, "ports.yaml");
    writeFileSync(p, "gateway: { web: 3000 }\n", "utf8");
    const data = loadYamlFile(p) as Record<string, unknown>;
    expect(data.gateway).toEqual({ web: 3000 });
    rmSync(dir, { recursive: true, force: true });
  });

  it("resolveEnvOverrides 用环境变量覆盖同名前缀键", () => {
    process.env.MT_TEST_WEB = "4001";
    const out = resolveEnvOverrides({ web: 3999 }, "MT_TEST_");
    expect(out.web).toBe("4001");
    delete process.env.MT_TEST_WEB;
  });

  it("validateConfig 校验失败时抛出带信息错误", () => {
    expect(() => validateConfig(schema, { web: "not-a-number" })).toThrow(/配置校验失败/);
  });
});
