import { test, expect } from "@playwright/test";

test("Phase 1 三环全链路（investigator→assessor→manager）", async ({ request }) => {
  // 第一环：调研 → 推送
  const survey = await request.post("/api/investigator/surveys", {
    data: { name: "E2E主线主题" + Date.now(), appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  const sv = await survey.json();
  await request.post("/api/investigator/surveys/" + sv.id + "/sync");
  const resps = await (await request.get("/api/investigator/surveys/" + sv.id + "/responses")).json();
  await request.post("/api/investigator/surveys/" + sv.id + "/push", { data: { recordIds: [resps[0].id] } });

  // 第二环：分析 → 审核 → 推送
  await request.post("/api/assessor/inbox/poll");
  const requests = await (await request.get("/api/assessor/requests")).json();
  const target = requests[0];
  await request.post("/api/assessor/requests/" + target.id + "/generate");
  await request.post("/api/assessor/requests/" + target.id + "/review", { data: { approve: true, comment: "E2E" } });
  await request.post("/api/assessor/requests/" + target.id + "/push");

  // 第三环：需求落地
  const polled = await request.post("/api/manager/inbox/poll");
  expect(polled.ok()).toBeTruthy();
  expect((await polled.json()).created).toBeGreaterThanOrEqual(1);

  const reqs = await (await request.get("/api/manager/requirements?source=assessor")).json();
  expect(reqs.length).toBeGreaterThanOrEqual(1);
  expect(reqs[0].source).toBe("assessor");

  // PR 关联 + 状态联动
  const linked = await request.patch("/api/manager/requirements/" + reqs[0].id, {
    data: { prUrl: "https://github.com/Era3e/MagicTools/pull/1" },
  });
  expect(linked.ok()).toBeTruthy();
  const refreshed = await request.post("/api/manager/requirements/" + reqs[0].id + "/refresh-pr");
  expect(refreshed.ok()).toBeTruthy();
  expect((await refreshed.json()).status).toBe("developing");
});

test("manager 需求列表页面渲染", async ({ page, request }) => {
  await request.post("/api/manager/requirements", { data: { title: "E2E页面需求" + Date.now() } });
  await page.goto("/manager/admin/requirements");
  await expect(page.getByRole("main").getByText("需求管理")).toBeVisible();
});
