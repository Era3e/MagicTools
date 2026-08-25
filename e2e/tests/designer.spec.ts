import { test, expect } from "@playwright/test";

test("designer 全流程（生成→预览→沉淀→列表→历史）", async ({ request }) => {
  const created = await request.post("/api/designer/generate", {
    data: { prompt: "一个问候卡片" },
  });
  expect(created.ok()).toBeTruthy();
  const gen = await created.json();
  expect(gen.status).toBe("ok");
  expect(gen.componentName).toBeTruthy();

  const preview = await request.post("/api/designer/preview", { data: { code: gen.code } });
  expect(preview.ok()).toBeTruthy();

  const saved = await request.post("/api/designer/components", {
    data: { name: gen.componentName, description: "e2e", code: gen.code },
  });
  expect(saved.ok()).toBeTruthy();

  const comps = await (await request.get("/api/designer/components")).json();
  expect(comps.length).toBeGreaterThanOrEqual(1);

  const history = await request.get("/api/designer/generations");
  expect((await history.json()).length).toBeGreaterThanOrEqual(1);
});

test("designer 生成页面渲染", async ({ page }) => {
  await page.goto("/designer/generate");
  await expect(page.getByText(/定制生成/)).toBeVisible();
});
