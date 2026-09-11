import { spawn } from "node:child_process";

export async function runDocker(args, { input, timeout = 120_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const chunks = []; let size = 0; let failed = false;
    const timer = setTimeout(() => { failed = true; child.kill(); }, timeout);
    child.stdout.on("data", (chunk) => { size += chunk.length; if (size > 4 * 1024 * 1024) { failed = true; child.kill(); } else chunks.push(chunk); });
    child.stderr.resume(); child.stdin.on("error", () => {});
    child.on("error", () => { failed = true; });
    child.on("close", (code) => { clearTimeout(timer); resolve({ exitCode: failed ? 1 : code ?? 1, stdout: failed ? "" : Buffer.concat(chunks).toString("utf8") }); });
    child.stdin.end(input);
  });
}

export async function docker(args, options) {
  const result = await runDocker(args, options);
  if (result.exitCode !== 0) throw new Error("Docker " + args[0] + "操作失败（退出码" + result.exitCode + "）");
  return result.stdout.trim();
}

export async function dockerStream(args, direction, action) {
  const child = spawn("docker", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const timer = setTimeout(() => child.kill(), 30 * 60_000);
  child.stderr.resume(); child.stdin.on("error", () => {});
  if (direction === "read") child.stdin.end(); else child.stdout.resume();
  const completed = new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("Docker流无法启动")));
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error("Docker流未成功完成")));
  });
  const transfer = Promise.resolve().then(() => action(direction === "read" ? child.stdout : child.stdin));
  try { const [result] = await Promise.all([transfer, completed]); return result; }
  catch (error) { child.kill(); await Promise.allSettled([transfer, completed]); throw error; }
  finally { clearTimeout(timer); }
}

export class BackupResources {
  constructor(operationId) { this.operationId = operationId; this.items = []; this.preserved = new Set(); }
  get label() { return "magictools.backup.operation=" + this.operationId; }
  async inspect(kind, name) {
    const result = await runDocker([kind, "inspect", name]);
    if (result.exitCode === 0) {
      try { return JSON.parse(result.stdout)[0]; } catch { throw new Error("备份资源元数据无效"); }
    }
    const listing = await runDocker([kind, "ls", ...kind === "container" ? ["-a"] : [], "--filter", "name=" + name, "--format", kind === "container" ? "{{.Names}}" : "{{.Name}}"]);
    if (listing.exitCode !== 0 || listing.stdout.split(/\r?\n/).includes(name)) throw new Error("无法确认备份资源状态");
    return null;
  }
  async create(kind, name, args) {
    if (await this.inspect(kind, name)) throw new Error("备份目标资源已存在，拒绝覆盖");
    this.items.push({ kind, name });
    await docker(args);
    if (!await this.owned(kind, name)) throw new Error("备份资源创建后不存在");
    return name;
  }
  async owned(kind, name) {
    const value = await this.inspect(kind, name);
    if (!value) return null;
    if ((kind === "container" ? value.Config.Labels : value.Labels)?.["magictools.backup.operation"] !== this.operationId) throw new Error("备份资源归属不符，拒绝操作");
    return value;
  }
  preserve(kind, name) { this.preserved.add(kind + ":" + name); }
  async remove(kind, name) {
    if (await this.owned(kind, name)) await docker(kind === "container" ? ["rm", "-f", "-v", name] : [kind, "rm", name]);
    this.items = this.items.filter((item) => item.kind !== kind || item.name !== name);
  }
  async cleanup() {
    const failed = [];
    for (const item of [...this.items].reverse()) {
      if (this.preserved.has(item.kind + ":" + item.name)) continue;
      try { await this.remove(item.kind, item.name); } catch { failed.push(item.kind + ":" + item.name); }
    }
    if (failed.length) throw new Error("备份临时资源清理失败：" + failed.join(","));
  }
}

export async function databaseQuery(container, database, query) {
  return docker(["exec", "-i", "--user", "postgres", container, "psql", "-X", "-q", "-A", "-t", "--no-password", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], { input: query });
}

export async function waitForDatabase(container) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if (await databaseQuery(container, "postgres", "SELECT NOT pg_is_in_recovery();") === "t") return; } catch { /* 隔离实例仍在恢复 */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error("备份恢复数据库未就绪");
}
