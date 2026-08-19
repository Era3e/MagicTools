import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { findRootEnvFile, loadRootEnv, loadYamlFile, resolveEnvOverrides, validateConfig } from "./index";

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

  it("findRootEnvFile 从子目录向上定位仓库根 .env", () => {
    const dir = mkdtempSync(join(tmpdir(), "mtenv-"));
    mkdirSync(join(dir, "apps", "x"), { recursive: true });
    writeFileSync(join(dir, ".env"), "GATEWAY_TOKEN=abc\n", "utf8");
    const found = findRootEnvFile(join(dir, "apps", "x"));
    expect(found).toBe(join(dir, ".env"));
    rmSync(dir, { recursive: true, force: true });
  });

  it("findRootEnvFile 找不到时返回 null", () => {
    expect(findRootEnvFile("C:/definitely-not-exist-mt-env-xyz")).toBe(null);
  });

  it("loadRootEnv 加载 .env 到进程环境", () => {
    const dir = mkdtempSync(join(tmpdir(), "mtenv2-"));
    writeFileSync(join(dir, ".env"), "MT_ENV_AUTOLOAD_TEST=hello\n", "utf8");
    loadRootEnv(join(dir, "apps", "x"));
    expect(process.env.MT_ENV_AUTOLOAD_TEST).toBe("hello");
    delete process.env.MT_ENV_AUTOLOAD_TEST;
    rmSync(dir, { recursive: true, force: true });
  });
});
