import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { allocPorts } from "./lib/ports.mjs";

const name = process.argv[2];
if (!name) {
  console.error("用法: pnpm new:app <name>");
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("名称仅允许小写字母、数字与连字符，且以字母开头");
  process.exit(1);
}

const cwd = process.cwd();
const appsDir = join(cwd, "apps", name);
if (existsSync(appsDir)) {
  console.error("应用目录已存在: " + name);
  process.exit(1);
}

const portsPath = join(cwd, "infra", "ports.yaml");
const ports = parse(readFileSync(portsPath, "utf8"));
const isNew = !ports[name];
const { web, server } = allocPorts(ports, name);
ports[name] = { web, server };
if (isNew) {
  writeFileSync(portsPath, stringify(ports));
}

function renderDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const dst = join(to, entry);
    if (statSync(src).isDirectory()) {
      renderDir(src, dst);
      continue;
    }
    const content = readFileSync(src, "utf8")
      .split("__NAME__").join(name)
      .split("__WEB_PORT__").join(String(web))
      .split("__SERVER_PORT__").join(String(server));
    writeFileSync(dst, content);
  }
}

renderDir(join(cwd, "infra", "templates", "web"), join(appsDir, "web"));
renderDir(join(cwd, "infra", "templates", "server"), join(appsDir, "server"));
console.log("已创建 apps/" + name + "（web:" + web + " server:" + server + "）");
