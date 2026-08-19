import { test, expect } from "@playwright/test";

test("investigator 主题全流程（API 链路，双桩模式）", async ({ request }) => {
  const created = await request.post("/api/investigator/surveys", {
    data: { name: "E2E调研主题" + Date.now(), appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  expect(created.ok()).toBeTruthy();
  const survey = await created.json();

  const synced = await request.post("/api/investigator/surveys/" + survey.id + "/sync");
  expect(synced.ok()).toBeTruthy();
  expect((await synced.json()).fetchedCount).toBeGreaterThan(0);

  const responses = await request.get("/api/investigator/surveys/" + survey.id + "/responses");
  expect(responses.ok()).toBeTruthy();
  const list = await responses.json();
  expect(list.length).toBeGreaterThan(0);

  const pushed = await request.post("/api/investigator/surveys/" + survey.id + "/push", {
    data: { recordIds: [list[0].id] },
  });
  expect(pushed.ok()).toBeTruthy();
  expect((await pushed.json()).pushedCount).toBe(1);
});

test("investigator 主题列表页面渲染", async ({ page, request }) => {
  const name = "E2E页面主题" + Date.now();
  await request.post("/api/investigator/surveys", { data: { name, appToken: "appX", tableId: "tblX", answerFields: ["回答"] } });
  await page.goto("/investigator/surveys");
  await expect(page.getByText(name).first()).toBeVisible();
});
