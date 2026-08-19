import { test, expect } from "@playwright/test";

test("网关将 /applicant 代理到 applicant web", async ({ page }) => {
  await page.goto("/applicant/positions");
  await expect(page.getByText("岗位列表")).toBeVisible();
});

test("网关健康检查返回 up", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("up");
});
