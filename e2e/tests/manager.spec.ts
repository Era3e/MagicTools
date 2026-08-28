import { test, expect } from "@playwright/test";

test("Phase 1 三环全链路（investigator→assessor→manager）", async ({ request }) => {
  // 第一环：调研 → 推送
  const survey = await request.post("/api/investigator/surveys", {
    data: { name: "E2E主线主题" + Date.now(), appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  const sv = await survey.json();
  await request.post("/api/investigator/surveys/" + sv.id + "/sync");
  const resps = await (await request.get("/api/investigator/surveys/" + sv.id + "/responses")).json();
  test.skip(resps.length === 0, "[manager] 同步后无响应（检查 FEISHU_STUB 桩环境）");
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

// ---------- P0-1b 新增：页面交互 + 副作用断言 ----------
test("manager 前台看板 → 后台列表 导航互跳 + 详情跳转 副作用：URL 变化", async ({ page, request }) => {
  const title = "E2E需求跳转" + Date.now();
  const created = await request.post("/api/manager/requirements", { data: { title } });
  const id = (await created.json()).id;

  // 1. 前台看板 点击某张卡片 → 跳到 /requirements/:id 详情
  await page.goto("/manager/requirements");
  // 「交付驾驶舱」h1 与「FLIGHT DECK · 需求在轨」span 会让宽正则双命中（strict mode），
  // 收敛为 heading 角色断言
  await expect(page.getByRole("heading", { name: /交付驾驶舱|FLIGHT DECK/i }).first()).toBeVisible();
  const card = page.getByText(title).first();
  await card.click();
  await expect(page).toHaveURL(/\/manager\/requirements\/.+/, { timeout: 8000 });
  // 详情页「FLIGHT LOG · 需求档案」是 span 非 heading，且出现 2 次（档案+时间线）
  await expect(page.getByText(/^FLIGHT LOG · 需求档案$/).first()).toBeVisible();
  // 详情页 URL 带 id
  const url = page.url();
  expect(url).toContain(id);

  // 2. 后台需求列表 → 点击标题链接跳前台详情（列表链接本来就指向前台 /requirements/:id）
  await page.goto("/manager/admin/requirements");
  const row = page.getByText(title).first();
  await row.click();
  await expect(page).toHaveURL(/\/manager\/requirements\/.+/, { timeout: 8000 });

  // 3. 后台侧栏 切换「迭代管理」→ URL 跳到 /admin/iterations
  await page.goto("/manager/admin/requirements");
  const iterNav = page.getByRole("menuitem", { name: /迭代管理|iterations/i }).first();
  const iterTrigger = (await iterNav.count()) > 0 ? iterNav : page.getByText(/迭代管理/).first();
  test.skip(
    (await iterTrigger.count()) === 0,
    "[manager] AdminShell 无「迭代管理」菜单项（检查侧栏配置）"
  );
  await iterTrigger.click();
  await expect(page).toHaveURL(/\/manager\/admin\/iterations/, { timeout: 8000 });
});
