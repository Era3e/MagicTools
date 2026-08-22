import { test, expect } from "@playwright/test";

test("scholar 全流程（录入→双通道检索→圈定→图谱）", async ({ request }) => {
  const a = await request.post("/api/scholar/entries", {
    data: { title: "苹果公司发布新手机", content: "苹果发布会内容" },
  });
  expect(a.ok()).toBeTruthy();
  await request.post("/api/scholar/entries", { data: { title: "香蕉是水果", content: "香蕉介绍" } });

  const fts = await request.get("/api/scholar/entries/search?q=" + encodeURIComponent("苹果") + "&mode=fts");
  expect(fts.ok()).toBeTruthy();
  const ftsBody = await fts.json();
  expect(ftsBody.length).toBeGreaterThanOrEqual(1);
  expect(ftsBody[0].title).toContain("苹果");

  const vec = await request.get("/api/scholar/entries/search?q=" + encodeURIComponent("苹果") + "&mode=vector&limit=2");
  expect(vec.ok()).toBeTruthy();
  const vecBody = await vec.json();
  expect(vecBody.length).toBeGreaterThanOrEqual(1);
  expect(vecBody[0].title).toContain("苹果");

  const patch = await request.patch("/api/scholar/entries/" + vecBody[0].id, { data: { assistantScope: true } });
  expect(patch.ok()).toBeTruthy();
  expect((await patch.json()).assistantScope).toBe(true);

  const gen = await request.post("/api/scholar/graph/generate");
  expect(gen.ok()).toBeTruthy();
  expect((await gen.json()).entities).toBeGreaterThan(0);

  const graph = await request.get("/api/scholar/graph");
  expect(graph.ok()).toBeTruthy();
  const graphBody = await graph.json();
  expect(graphBody.nodes.length).toBeGreaterThan(0);
});

test("scholar 条目页面渲染", async ({ page }) => {
  await page.goto("/scholar/entries");
  await expect(page.getByRole("main").getByText("知识条目")).toBeVisible();
});
