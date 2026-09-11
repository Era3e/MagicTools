import { buildImages } from "./build-images.mjs";
import { validateRuntime } from "./validate-runtime.mjs";

try {
  const result = await buildImages({ validation: true });
  const runtime = await validateRuntime(result.directory + "/build.json");
  if (!runtime.success) throw new Error("镜像运行验证未通过");
} catch (error) { console.error(String(error)); process.exitCode = 1; }
