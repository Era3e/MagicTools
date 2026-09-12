import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const scratchBase = realpathSync(tmpdir());
function createScratch() { return mkdtempSync(join(scratchBase, "mt backup wrappers ")); }
function cleanupScratch(directory) {
  const target = resolve(directory);
  assert.equal(dirname(target), scratchBase, "只清理本轮临时根目录的直接子目录");
  assert.ok(target.startsWith(join(scratchBase, "mt backup wrappers ")), "拒绝清理其它目录");
  assert.equal(lstatSync(target).isSymbolicLink(), false, "拒绝递归清理链接");
  assert.equal(realpathSync(target), target, "拒绝目录重定向");
  rmSync(target, { recursive: true, force: true });
}
const shellChecks = [
  { name: "Windows PowerShell 5.1", command: "powershell.exe", major: /^5\.1\./, applicable: process.platform === "win32" },
  { name: "PowerShell 7", command: process.platform === "win32" ? "pwsh.exe" : "pwsh", major: /^7\./, applicable: true },
].map((shell) => {
  const probe = shell.applicable ? spawnSync(shell.command, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"], { windowsHide: true, encoding: "utf8", timeout: 10_000 }) : null;
  return { ...shell, version: probe?.stdout?.trim(), skip: !shell.applicable ? "当前平台不支持 Windows PowerShell 5.1，不计为已覆盖" :
    probe?.status !== 0 ? "未能运行 " + shell.command + "（" + (probe?.error?.code ?? probe?.status) + "），不计为已覆盖" : false };
});
for (const shell of shellChecks) test("包装执行环境：" + shell.name + (shell.version ? " " + shell.version : ""), { skip: shell.skip }, () => {
  assert.match(shell.version, shell.major);
});
const shells = shellChecks.filter((shell) => !shell.skip).map((shell) => shell.command);

function invoke(shell, script, args, directory, environment = {}) {
  return spawnSync(shell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, ...args], {
    cwd: directory, encoding: "utf8", windowsHide: true, timeout: 20_000,
    env: { ...process.env, PATH: dirname(process.execPath) + (process.platform === "win32" ? ";" : ":") + process.env.PATH, ...environment },
  });
}

test("PowerShell 无操作参数由统一 Node CLI 拒绝并记录失败事件", { skip: shells.length === 0 ? "本机未安装 PowerShell，无法执行原生包装验收" : false }, () => {
  for (const shell of shells) {
    const scratch = createScratch();
    try {
      const result = invoke(shell, join(root, "infra/backup.ps1"), [], scratch);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      const events = join(scratch, ".qa/backup-events");
      assert.ok(existsSync(events), "应调用 Node 记录失败事件，不能停在 PowerShell 必填提示");
      const eventFile = readdirSync(events).find((file) => file.endsWith(".event.json"));
      const event = JSON.parse(readFileSync(join(events, eventFile), "utf8"));
      assert.equal(event.operation, "unknown");
      assert.match(event.operationId, /^[a-f0-9]{16}$/);
    } finally { cleanupScratch(scratch); }
  }
});

test("未知操作和 create 缺参均由 Node 返回 exit1，不执行真实备份", { skip: shells.length === 0 ? "本机未安装 PowerShell，无法执行原生包装验收" : false }, () => {
  for (const shell of shells) for (const command of ["unknown", "create"]) {
    const scratch = createScratch();
    try {
      const result = invoke(shell, join(root, "infra/backup.ps1"), [command, "--events-dir", join(scratch, "events")], scratch);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      const event = JSON.parse(readFileSync(join(scratch, "events", readdirSync(join(scratch, "events")).find((file) => file.endsWith(".event.json"))), "utf8"));
      assert.equal(event.operation, command);
      assert.equal(event.stage, "preflight");
    } finally { cleanupScratch(scratch); }
  }
});

// Only the native-process boundary is controlled here: these fixtures never call
// Docker, PostgreSQL, SSH, or a webhook, and are not backup correctness evidence.
function controlledFixture(scratch) {
  const infra = join(scratch, "repo's directory with spaces", "infra");
  mkdirSync(join(infra, "scripts"), { recursive: true });
  for (const file of ["backup.ps1", "restore.ps1"]) copyFileSync(join(root, "infra", file), join(infra, file));
  copyFileSync(join(root, "infra/scripts/backup-powershell.mjs"), join(infra, "scripts/backup-powershell.mjs"));
  writeFileSync(join(infra, "scripts/backup.mjs"), 'console.log(JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() })); process.exit(Number(process.env.MT_WRAPPER_TEST_EXIT ?? 0));\n');
  return infra;
}

test("五种 backup 操作和 restore 包装从任意目录原样透传含空格及 shell 字符的参数", { skip: shells.length === 0 ? "本机未安装 PowerShell，无法执行原生包装验收" : false }, () => {
  for (const shell of shells) {
    const scratch = createScratch();
    try {
      const infra = controlledFixture(scratch);
      const value = join(scratch, "archive's directory $(Write-Output injected); & text") + (process.platform === "win32" ? "\\" : "/");
      for (const command of ["create", "verify", "restore", "prune", "ssh"]) {
        const args = [command, "--directory", value, "--key-file", join(scratch, "private key file.key"), "--opaque", '中文 "quoted" $()'];
        const result = invoke(shell, join(infra, "backup.ps1"), args, scratch);
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(result.stdout.trim()), { argv: args, cwd: scratch });
      }
      const args = ["--backup", value, "--key-file", join(scratch, "private key file.key"), "--target", "mt-restore-wrappers"];
      const result = invoke(shell, join(infra, "restore.ps1"), args, scratch);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), { argv: ["restore", ...args], cwd: scratch });
    } finally { cleanupScratch(scratch); }
  }
});

function decodePowerShellFile(file) {
  const bytes = readFileSync(file);
  return bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2).toString("utf16le") : bytes.toString("utf8").replace(/^\uFEFF/, "");
}

test("PowerShell 文件重定向和变量捕获保留两条 UTF8 文本流及原生退出码", { skip: shells.length === 0 ? "本机未安装 PowerShell，无法执行原生包装验收" : false }, () => {
  for (const shell of shells) for (const wrapper of ["backup.ps1", "restore.ps1"]) {
    const scratch = createScratch();
    try {
      const infra = controlledFixture(scratch);
      writeFileSync(join(infra, "scripts/backup.mjs"), "process.stdout.write('stdout 中文 marker\\n'); process.stderr.write('stderr 中文 marker\\n'); process.exitCode = 23;\n");
      const driver = join(scratch, "redirect and capture.ps1");
      writeFileSync(driver, "& $env:MT_WRAPPER_TEST_SCRIPT 1> $env:MT_WRAPPER_TEST_OUT 2> $env:MT_WRAPPER_TEST_ERR\n$redirectExit = $LASTEXITCODE\n$captured = & $env:MT_WRAPPER_TEST_SCRIPT 2> $env:MT_WRAPPER_TEST_CAPTURE_ERR\n$captureExit = $LASTEXITCODE\n$captured | Set-Content -LiteralPath $env:MT_WRAPPER_TEST_CAPTURE_OUT -Encoding UTF8\nif ($redirectExit -ne 23 -or $captureExit -ne 23) { exit 99 }\nexit 0\n");
      const files = { MT_WRAPPER_TEST_OUT: join(scratch, "stdout.txt"), MT_WRAPPER_TEST_ERR: join(scratch, "stderr.txt"),
        MT_WRAPPER_TEST_CAPTURE_OUT: join(scratch, "capture-out.txt"), MT_WRAPPER_TEST_CAPTURE_ERR: join(scratch, "capture-err.txt") };
      const result = invoke(shell, driver, [], scratch, { ...files, MT_WRAPPER_TEST_SCRIPT: join(infra, wrapper) });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      for (const name of ["MT_WRAPPER_TEST_OUT", "MT_WRAPPER_TEST_CAPTURE_OUT"]) assert.match(decodePowerShellFile(files[name]), /stdout 中文 marker/, shell + " " + wrapper + " stdout 被绕过");
      for (const name of ["MT_WRAPPER_TEST_ERR", "MT_WRAPPER_TEST_CAPTURE_ERR"]) assert.match(decodePowerShellFile(files[name]), /stderr 中文 marker/, shell + " " + wrapper + " stderr 被绕过");
      assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
    } finally { cleanupScratch(scratch); }
  }
});

test("两个包装的大量 stdout/stderr 文本都完整重定向，不死锁或截断", { skip: shells.length === 0 ? "本机未安装 PowerShell，无法执行原生包装验收" : false }, () => {
  for (const shell of shells) for (const wrapper of ["backup.ps1", "restore.ps1"]) {
    const scratch = createScratch();
    try {
      const infra = controlledFixture(scratch);
      writeFileSync(join(infra, "scripts/backup.mjs"), "const write=(stream,text)=>new Promise((done,reject)=>stream.write(text,error=>error?reject(error):done()));\nawait Promise.all([write(process.stdout,'OUT-BEGIN 中文\\n'+'O'.repeat(1024*1024)+'\\nOUT-END 中文\\n'),write(process.stderr,'ERR-BEGIN 中文\\n'+'E'.repeat(768*1024)+'\\nERR-END 中文\\n')]); process.exitCode=23;\n");
      const driver = join(scratch, "large redirected streams.ps1");
      writeFileSync(driver, "& $env:MT_WRAPPER_TEST_SCRIPT 1> $env:MT_WRAPPER_TEST_OUT 2> $env:MT_WRAPPER_TEST_ERR\nexit $LASTEXITCODE\n");
      const stdoutFile = join(scratch, "stdout.txt"), stderrFile = join(scratch, "stderr.txt");
      const result = invoke(shell, driver, [], scratch, { MT_WRAPPER_TEST_SCRIPT: join(infra, wrapper), MT_WRAPPER_TEST_OUT: stdoutFile, MT_WRAPPER_TEST_ERR: stderrFile });
      assert.equal(result.status, 23, result.error?.message ?? result.stdout + result.stderr);
      const stdout = decodePowerShellFile(stdoutFile), stderr = decodePowerShellFile(stderrFile);
      assert.match(stdout, /OUT-BEGIN 中文/); assert.match(stdout, /OUT-END 中文/);
      assert.match(stderr, /ERR-BEGIN 中文/); assert.match(stderr, /ERR-END 中文/);
      // PowerShell may add ErrorRecord formatting/newlines, but payload is intact.
      assert.ok(stdout.replace(/\s/g, "").includes("O".repeat(1024 * 1024)), "stdout payload 不完整");
      assert.ok(stderr.replace(/\s/g, "").includes("E".repeat(768 * 1024)), "stderr payload 不完整");
      assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
    } finally { cleanupScratch(scratch); }
  }
});

test("restore 缺少包装依赖时失败消息仍遵守 PowerShell 重定向", { skip: shells.length === 0 ? "本机未安装 PowerShell，无法执行原生包装验收" : false }, () => {
  for (const shell of shells) {
    const scratch = createScratch();
    try {
      const wrapper = join(scratch, "restore.ps1"), driver = join(scratch, "missing wrapper.ps1"), stderrFile = join(scratch, "stderr.txt");
      copyFileSync(join(root, "infra/restore.ps1"), wrapper);
      writeFileSync(driver, "& $env:MT_WRAPPER_TEST_SCRIPT 2> $env:MT_WRAPPER_TEST_ERR\nexit $LASTEXITCODE\n");
      const result = invoke(shell, driver, [], scratch, { MT_WRAPPER_TEST_SCRIPT: wrapper, MT_WRAPPER_TEST_ERR: stderrFile });
      assert.equal(result.status, 1);
      assert.match(decodePowerShellFile(stderrFile), /Unable to start the restore CLI/);
      assert.equal(result.stderr, "");
    } finally { cleanupScratch(scratch); }
  }
});

test("PowerShell Set-Location 后相对参数使用新的工作目录", { skip: shells.length === 0 ? "本机未安装 PowerShell，无法执行原生包装验收" : false }, () => {
  for (const shell of shells) {
    const scratch = createScratch();
    try {
      const infra = controlledFixture(scratch);
      const requested = join(scratch, "requested current directory"); mkdirSync(requested);
      const driver = join(scratch, "invoke from different cwd.ps1");
      writeFileSync(driver, "Set-Location -LiteralPath $env:MT_WRAPPER_TEST_CWD\n& $env:MT_WRAPPER_TEST_SCRIPT create --directory 'relative archive'\nexit $LASTEXITCODE\n");
      const result = invoke(shell, driver, [], scratch, { MT_WRAPPER_TEST_CWD: requested, MT_WRAPPER_TEST_SCRIPT: join(infra, "backup.ps1") });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), { argv: ["create", "--directory", "relative archive"], cwd: requested });
    } finally { cleanupScratch(scratch); }
  }
});

test("包装保留原生非零退出码，不能回报成功或统一改为1", { skip: shells.length === 0 ? "本机未安装 PowerShell，无法执行原生包装验收" : false }, () => {
  for (const shell of shells) {
    const scratch = createScratch();
    try {
      const infra = controlledFixture(scratch);
      for (const wrapper of ["backup.ps1", "restore.ps1"]) {
        const result = invoke(shell, join(infra, wrapper), wrapper === "backup.ps1" ? ["verify"] : [], scratch, { MT_WRAPPER_TEST_EXIT: "7" });
        assert.equal(result.status, 7, result.stdout + result.stderr);
      }
    } finally { cleanupScratch(scratch); }
  }
});

test("恢复包装缺少参数同样进入 Node restore 校验而不执行数据库操作", { skip: shells.length === 0 ? "本机未安装 PowerShell，无法执行原生包装验收" : false }, () => {
  for (const shell of shells) {
    const scratch = createScratch();
    try {
      const events = join(scratch, "restore events");
      const result = invoke(shell, join(root, "infra/restore.ps1"), ["--events-dir", events], scratch);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.ok(existsSync(events), "恢复入口必须调用同一 CLI 的参数校验及失败事件路径");
      const event = JSON.parse(readFileSync(join(events, readdirSync(events).find((file) => file.endsWith(".event.json"))), "utf8"));
      assert.equal(event.operation, "restore");
      assert.equal(event.stage, "preflight");
    } finally { cleanupScratch(scratch); }
  }
});
