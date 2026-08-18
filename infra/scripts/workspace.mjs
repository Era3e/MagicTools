import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const [cmd, project, taskId] = args;

function run(command) {
  execSync(command, { stdio: "inherit" });
}

if (cmd === "create") {
  if (!project || !taskId) {
    console.error("用法: pnpm ws:create <项目> <任务ID>");
    process.exit(1);
  }
  const branch = "feat/" + project + "-" + taskId;
  const dir = "../mt-ws/" + branch;
  run("git worktree add " + dir + " -b " + branch);
  console.log("worktree 已创建: " + dir + "（分支 " + branch + "）");
} else if (cmd === "cleanup") {
  if (!project || !taskId) {
    console.error("用法: pnpm ws:cleanup <项目> <任务ID>");
    process.exit(1);
  }
  const branch = "feat/" + project + "-" + taskId;
  const dir = "../mt-ws/" + branch;
  run("git worktree remove " + dir + " --force");
  console.log("worktree 已清理: " + dir);
  console.log("提示: PR 合并后远程分支会被自动删除；若 PR 未合并请先处理 PR。");
} else {
  console.log("用法: pnpm ws:create <项目> <任务ID> 或 pnpm ws:cleanup <项目> <任务ID>");
  process.exit(1);
}
