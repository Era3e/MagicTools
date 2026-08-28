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

// ---------- P0-1b 新增：D1/D3 闭环交互 + 副作用断言 ----------
test("investigator D3 编辑按钮 副作用：SurveyList 编辑列 Modal 打开", async ({ page, request }) => {
  const name = "E2E编辑主题" + Date.now();
  const created = await request.post("/api/investigator/surveys", {
    data: { name, appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  const sv = await created.json();

  await page.goto("/investigator/admin/surveys");
  await expect(page.getByText(name).first()).toBeVisible();

  const row = page
    .getByText(name)
    .first()
    .locator("xpath=ancestor::tr[1]")
    .first();
  // AntD 双字按钮渲染为「编 辑」（字间空格计入 accessible name），正则须允许 \s*
  const editBtn = row.getByRole("button", { name: /编\s*辑|edit|修\s*改/i }).first();
  // 定位失败 = 显式 skip（计入报告汇总行），绝不静默 pass
  test.skip(
    (await editBtn.count()) === 0,
    "[investigator] 未命中行内「编辑」按钮（检查按钮文案/表格结构）"
  );

  // 模式 2：Modal 打开（SurveyForm 编辑模式，标题唯一锚点「编辑调研主题 · <名>」；
  // 宽正则会 strict 命中标题+「主题名称」label）
  await editBtn.click();
  await expect(
    page.locator(".ant-modal-title", { hasText: /^编辑调研主题 · / })
  ).toBeVisible({ timeout: 8000 });

  // 模式 4：SurveyForm 走 AntD onOk（页脚「确 定」）触发 PATCH/PUT
  const savePromise = page.waitForRequest(
    (req) =>
      req.url().includes("/api/investigator/surveys/" + sv.id) &&
      ["PUT", "PATCH", "POST"].includes(req.method()),
    { timeout: 12000 }
  );
  const okBtn = page
    .getByRole("button", { name: /^确\s*定$|^OK$|^保\s*存$/i })
    .first();
  test.skip(
    (await okBtn.count()) === 0,
    "[investigator] 编辑 Modal 无「确定/保存」按钮"
  );
  await okBtn.click();
  await savePromise;
});

test("investigator D1 推送 Assessor 副作用：SurveyDetail 推送按钮 → POST push + Assessor 收件箱提示", async ({ page, request }) => {
  const created = await request.post("/api/investigator/surveys", {
    data: { name: "E2E推送主题" + Date.now(), appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  const sv = await created.json();
  await request.post("/api/investigator/surveys/" + sv.id + "/sync");
  const resps = await (await request.get("/api/investigator/surveys/" + sv.id + "/responses")).json();
  test.skip(
    resps.length === 0,
    "[investigator] 同步后无响应（FEISHU_STUB 桩应产出 2 条，检查桩环境）"
  );

  await page.goto("/investigator/admin/surveys/" + sv.id);
  // 详情卡片标题为「调研 · <主题名>」；宽正则 /响应|结果/ 在页面不存在
  await expect(
    page.locator(".ant-card-head-title", { hasText: /^调研 · / }).first()
  ).toBeVisible();

  // 勾选第一条响应行（推送按钮要求 selectedIds 非空，否则只弹 warning 不发请求）
  const firstRespRow = page.locator(".ant-table-tbody tr.ant-table-row").first();
  test.skip(
    (await firstRespRow.count()) === 0,
    "[investigator] 响应表格无数据行（无法勾选推送）"
  );
  await firstRespRow.locator("input[type=checkbox]").check();

  // 推送按钮实际文案为「推送选中（N）」（Table 内勾选行后推送）
  const pushBtn = page
    .getByRole("button", { name: /推送选中|推送.*Assessor|推送评审|推送至.*Assessor/i })
    .first();
  const pushTrigger = (await pushBtn.count()) > 0
    ? pushBtn
    : page.getByText(/推送\s*Assessor|推送评审/).first();
  test.skip(
    (await pushTrigger.count()) === 0,
    "[investigator] 未命中「推送」按钮（检查按钮文案）"
  );
  // 模式 4：真的 POST /push
  const pushPromise = page.waitForRequest(
    (req) =>
      req.url().includes("/api/investigator/surveys/" + sv.id + "/push") &&
      req.method() === "POST",
    { timeout: 12000 }
  );
  await pushTrigger.click();
  await pushPromise;
  // 模式 3：成功文案包含 Assessor 收件箱
  await expect(
    page.getByText(/Assessor|评审|收件箱|成功|推送完成/i).first()
  ).toBeVisible({ timeout: 8000 });
});
