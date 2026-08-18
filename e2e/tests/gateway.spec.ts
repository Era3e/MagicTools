import { test, expect } from "@playwright/test";

test("网关将 /applicant 代理到 applicant web", async ({ page }) => {
  await page.goto("/applicant");
  await expect(page.getByText("applicant").first()).toBeVisible();
  await expect(page.getByText(/服务状态: up/)).toBeVisible();
});

test("网关健康检查返回 up", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("up");
});
