import { test, expect } from "@playwright/test";

test("designer 全流程（生成→预览→沉淀→列表→历史）", async ({ request }) => {
  const gen = await request.post("/api/designer/generate", { data: { prompt: "生成一个问候卡片组件" } });
  expect(gen.ok()).toBeTruthy();
  const genBody = await gen.json();
  expect(genBody.status).toBe("ok");
  expect(genBody.code).toContain("GreetingCard");

  const prev = await request.post("/api/designer/preview", { data: { code: genBody.code } });
  expect(prev.ok()).toBeTruthy();
  const prevBody = await prev.json();
  expect(prevBody.ok).toBe(true);
  const html = await request.get("/api/designer/preview/" + prevBody.previewId);
  expect(html.ok()).toBeTruthy();
  expect(await html.text()).toContain('<div id="root">');

  const add = await request.post("/api/designer/components", {
    data: { name: genBody.componentName, description: genBody.description, code: genBody.code },
  });
  expect(add.ok()).toBeTruthy();

  const list = await request.get("/api/designer/components");
  expect((await list.json()).length).toBeGreaterThanOrEqual(1);

  const history = await request.get("/api/designer/generations");
  expect((await history.json()).length).toBeGreaterThanOrEqual(1);
});

test("designer 生成页面渲染", async ({ page }) => {
  await page.goto("/designer/generate");
  await expect(page.getByText("组件生成")).toBeVisible();
});
