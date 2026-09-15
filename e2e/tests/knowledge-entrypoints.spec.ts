import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const script = resolve(__dirname, "../../infra/scripts/knowledge-sync.mjs");
  const result = spawnSync(process.execPath, [
    script,
    "--base-url", "http://127.0.0.1:3000",
    "--publish-product",
    "--version", "p20-e2e-" + Date.now(),
    "--deployment-ref", "p20-e2e-registry",
    "--published-by", "e2e-knowledge-entrypoints",
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
});

test("用户帮助目录只展示当前发布任务", async ({ page }) => {
  await page.goto("/scholar/entries");
  await expect(page.getByRole("heading", { name: "MagicTools 用户帮助" })).toBeVisible();
  await expect(page.getByText("登记岗位并解析 JD")).toBeVisible();
  await expect(page.getByText("提问并核对引用")).toBeVisible();
  await expect(page.getByRole("button", { name: /新增|编辑|圈定/ })).toHaveCount(0);
});

test("公共帮助检索展示证据分块与版本", async ({ page }) => {
  await page.goto("/scholar/search");
  await page.getByPlaceholder("输入任务或问题，例如：如何核对引用").fill("提问并核对引用");
  await page.getByRole("button", { name: /检\s*索/ }).click();
  await expect(page.getByRole("link", { name: "提问并核对引用" })).toBeVisible();
  await expect(page.getByText(/chunk \d+ · \d+-\d+/).first()).toBeVisible();
  await expect(page.getByText(/版本 p20-e2e-/).first()).toBeVisible();
});

test("后台代码检索展示开发问题与来源证据", async ({ page }) => {
  await page.goto("/scholar/admin/code-index");
  await expect(page.getByRole("heading", { name: "项目代码检索" })).toBeVisible();
  await page.getByPlaceholder("检索系统边界、代码入口、验收口径…").fill("外部请求如何路由和鉴权");
  await page.getByRole("button", { name: /检\s*索/ }).click();
  await expect(page.getByText("外部请求如何路由和鉴权？").first()).toBeVisible();
  await expect(page.getByText("development 空间")).toBeVisible();
});
