import { buildImages, root } from "./build-images.mjs";
import { publishImages } from "./publish-images.mjs";
import { validateRuntime } from "./validate-runtime.mjs";

try {
  if (process.argv.length !== 4 || process.argv[2] !== "--registry") throw new Error("用法：pnpm images:release --registry <host/namespace>");
  const result = await buildImages();
  const runtime = await validateRuntime(result.directory + "/build.json");
  if (!runtime.success) throw new Error("待发布制品运行验收失败");
  await publishImages({ buildManifest: result.directory + "/build.json", runtimeManifest: root + "/.qa/runtime/" + runtime.runId + "/runtime.json", registry: process.argv[3] });
} catch (error) { console.error(String(error)); process.exitCode = 1; }
