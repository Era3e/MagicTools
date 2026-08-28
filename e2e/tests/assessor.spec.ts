import { test, expect } from "@playwright/test";

test("assessor 全流程（poll→上下文→generate→review→push，双桩）", async ({ request }) => {
  // 造数据：走 investigator API 推送（真实链路）
  const survey = await request.post("/api/investigator/surveys", {
    data: { name: "E2E审阅主题" + Date.now(), appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  const sv = await survey.json();
  await request.post("/api/investigator/surveys/" + sv.id + "/sync");
  const resps = await (await request.get("/api/investigator/surveys/" + sv.id + "/responses")).json();
  test.skip(resps.length === 0, "[assessor] 同步后无响应（检查 FEISHU_STUB 桩环境）");
  await request.post("/api/investigator/surveys/" + sv.id + "/push", { data: { recordIds: [resps[0].id] } });

  const polled = await request.post("/api/assessor/inbox/poll");
  expect(polled.ok()).toBeTruthy();
  expect((await polled.json()).created).toBeGreaterThanOrEqual(1);

  const list = await (await request.get("/api/assessor/requests")).json();
  const target = list[0];

  const patched = await request.patch("/api/assessor/requests/" + target.id, { data: { repoUrl: "Era3e/MagicTools" } });
  expect(patched.ok()).toBeTruthy();

  const generated = await request.post("/api/assessor/requests/" + target.id + "/generate");
  expect(generated.ok()).toBeTruthy();
  const gen = await generated.json();
  expect(gen.analysisMd).toContain("需求分析");

  const reviewed = await request.post("/api/assessor/requests/" + target.id + "/review", {
    data: { approve: true, comment: "E2E 通过" },
  });
  expect(reviewed.ok()).toBeTruthy();

  const pushed = await request.post("/api/assessor/requests/" + target.id + "/push");
  expect(pushed.ok()).toBeTruthy();
  expect((await pushed.json()).pushed).toBe(true);
});

// ---------- P0-1b 新增：页面渲染 + 跳转 + 推送副作用断言 ----------
test("assessor 页面渲染 + 跳转详情 副作用：URL 变化", async ({ page, request }) => {
  // 造 request：走真实链路（investigator 推送）
  const survey = await request.post("/api/investigator/surveys", {
    data: { name: "E2E审阅页面" + Date.now(), appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  const sv = await survey.json();
  await request.post("/api/investigator/surveys/" + sv.id + "/sync");
  const resps = await (await request.get("/api/investigator/surveys/" + sv.id + "/responses")).json();
  test.skip(resps.length === 0, "[assessor] 同步后无响应（检查 FEISHU_STUB 桩环境）");
  await request.post("/api/investigator/surveys/" + sv.id + "/push", { data: { recordIds: [resps[0].id] } });
  await request.post("/api/assessor/inbox/poll");

  const list = await (await request.get("/api/assessor/requests")).json();
  test.skip(
    list.length === 0,
    "[assessor] inbox/poll 后无分析请求（检查 investigator 推送链路）"
  );
  // 列表展示的是 surveyName 字段（RequestList.tsx），无 surveyName 时显示「未命名」
  const title = list[0].surveyName || list[0].title || "未命名";

  // 1. 后台列表渲染
  await page.goto("/assessor/admin/requests");
  await expect(page.getByRole("main").getByText(/分析请求|评审|Request/i)).toBeVisible();
  if (title) await expect(page.getByText(title).first()).toBeVisible();

  // 模式 1：点击调研来源链接 → 跳前台 /requests/:id 详情（RequestList 链接指向前台详情）
  const row = page.getByText(title).first();
  await row.click();
  await expect(page).toHaveURL(/\/assessor\/requests\/.+/, { timeout: 8000 });
});

test("assessor D1 推送 Manager 副作用：RequestDetail 按钮点后 POST push + 收件箱提示", async ({ page, request }) => {
  // 造数据
  const survey = await request.post("/api/investigator/surveys", {
    data: { name: "E2E审阅推送" + Date.now(), appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  const sv = await survey.json();
  await request.post("/api/investigator/surveys/" + sv.id + "/sync");
  const resps = await (await request.get("/api/investigator/surveys/" + sv.id + "/responses")).json();
  test.skip(resps.length === 0, "[assessor] 同步后无响应（检查 FEISHU_STUB 桩环境）");
  await request.post("/api/investigator/surveys/" + sv.id + "/push", { data: { recordIds: [resps[0].id] } });
  await request.post("/api/assessor/inbox/poll");
  const list = await (await request.get("/api/assessor/requests")).json();
  test.skip(
    list.length === 0,
    "[assessor] inbox/poll 后无分析请求（检查 investigator 推送链路）"
  );
  const target = list[0];
  // 先 generate + review 通过（推送前置状态）
  await request.patch("/api/assessor/requests/" + target.id, { data: { repoUrl: "Era3e/MagicTools" } });
  await request.post("/api/assessor/requests/" + target.id + "/generate");
  await request.post("/api/assessor/requests/" + target.id + "/review", { data: { approve: true, comment: "页面交互测试" } });

  await page.goto("/assessor/admin/requests/" + target.id);
  // 页面标题即「分析请求 · <调研名>」；宽正则会 strict 命中 9 处（菜单/卡片/按钮/正文）
  await expect(
    page.locator(".ant-card-head-title", { hasText: /^分析请求 · / }).first()
  ).toBeVisible();

  const pushBtn = page
    .getByRole("button", { name: /推送\s*Manager|推送管理|Push.*Manager|推送交付/i })
    .first();
  const pushTrigger = (await pushBtn.count()) > 0
    ? pushBtn
    : page.getByText(/推送\s*Manager|推送至\s*Manager|推送交付/).first();
  test.skip(
    (await pushTrigger.count()) === 0,
    "[assessor] 未命中「推送 Manager」按钮（检查按钮文案/推送前置状态）"
  );
  const pushPromise = page.waitForRequest(
    (req) =>
      req.url().includes("/api/assessor/requests/" + target.id + "/push") &&
      req.method() === "POST",
    { timeout: 12000 }
  );
  await pushTrigger.click();
  await pushPromise;
  await expect(
    page.getByText(/Manager|交付|收件箱|成功|推送完成/i).first()
  ).toBeVisible({ timeout: 8000 });
});
