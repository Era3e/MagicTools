import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// This is an argv transport adapter, not a second backup command implementation.
// Base64 contains UTF8 JSON data; user values never become shell or JavaScript code.
let args;
try {
  const payload = process.argv[2];
  if (process.argv.length !== 3 || !payload || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) throw new Error();
  args = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  if (!Array.isArray(args) || args.some((value) => typeof value !== "string" || value.includes("\0"))) throw new Error();
} catch {
  console.error("Invalid PowerShell backup argument payload.");
  process.exit(1);
}

const child = spawn(process.execPath, [fileURLToPath(new URL("backup.mjs", import.meta.url)), ...args], {
  stdio: "inherit", windowsHide: true, shell: false,
});
child.on("error", () => { console.error("Unable to start the backup CLI."); process.exitCode = 1; });
child.on("close", (code) => { process.exitCode = code ?? 1; });
