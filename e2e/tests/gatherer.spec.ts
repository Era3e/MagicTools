import { test, expect } from "@playwright/test";

test("gatherer 全流程（建源→试采→采集→去重→推送，双桩）", async ({ request }) => {
  const created = await request.post("/api/gatherer/sources", {
    data: { name: "E2E源" + Date.now(), type: "rss", url: "https://example.com/feed", cron: "" },
  });
  expect(created.ok()).toBeTruthy();
  const source = await created.json();

  const tested = await request.post("/api/gatherer/sources/" + source.id + "/test");
  expect(tested.ok()).toBeTruthy();

  const collected = await request.post("/api/gatherer/sources/" + source.id + "/collect");
  expect(collected.ok()).toBeTruthy();
  expect((await collected.json()).new).toBeGreaterThan(0);

  const again = await request.post("/api/gatherer/sources/" + source.id + "/collect");
  expect((await again.json()).new).toBe(0);

  const items = await (await request.get("/api/gatherer/items?sourceId=" + source.id)).json();
  expect(items.length).toBeGreaterThan(0);

  const pushed = await request.post("/api/gatherer/items/push", { data: { ids: [items[0].id] } });
  expect(pushed.ok()).toBeTruthy();
  expect((await pushed.json()).pushedCount).toBe(1);
});

test("gatherer 源列表页面渲染", async ({ page, request }) => {
  await request.post("/api/gatherer/sources", { data: { name: "E2E页面源" + Date.now(), type: "rss" } });
  await page.goto("/gatherer/sources");
  await expect(page.getByText("信息源")).toBeVisible();
});
