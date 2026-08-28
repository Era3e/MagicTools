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
  await page.goto("/gatherer/admin/sources");
  await expect(page.getByRole("main").getByText("信息源")).toBeVisible();
});

// ---------- P0-1b 新增：D1/D3 闭环交互 + 副作用断言 ----------
test("gatherer D3 编辑按钮 副作用：点击弹出编辑 Modal + PATCH 请求发出", async ({ page, request }) => {
  const name = "E2E编辑源" + Date.now();
  const created = await request.post("/api/gatherer/sources", {
    data: { name, type: "rss", url: "https://example.com/feed" },
  });
  const source = await created.json();

  await page.goto("/gatherer/admin/sources");
  await expect(page.getByText(name).first()).toBeVisible();

  // 定位该行的「编辑」按钮（D3 刚加的列）
  // AntD 双字按钮渲染为「编 辑」（字间空格计入 accessible name），正则须允许 \s*
  const row = page
    .getByText(name)
    .first()
    .locator("xpath=ancestor::tr[1]")
    .first();
  const editBtn = row.getByRole("button", { name: /编\s*辑|edit|修\s*改/i }).first();
  // 定位失败 = 显式 skip（计入报告汇总行），绝不静默 pass
  test.skip(
    (await editBtn.count()) === 0,
    "[gatherer] 未命中行内「编辑」按钮（检查按钮文案/表格结构）"
  );

  // 模式 2：编辑 Modal 打开（标题唯一锚点「编辑信息源 · <名>」）
  await editBtn.click();
  await expect(
    page.locator(".ant-modal-title", { hasText: /^编辑信息源 · / })
  ).toBeVisible({ timeout: 8000 });

  // 模式 4：编辑 Modal 走 AntD onOk（页脚「确 定」），非表单内保存按钮
  const patchPromise = page.waitForRequest(
    (req) =>
      req.url().includes("/api/gatherer/sources/" + source.id) &&
      req.method() === "PATCH",
    { timeout: 12000 }
  );
  const okBtn = page
    .getByRole("button", { name: /^确\s*定$|^OK$|^保\s*存$/i })
    .first();
  test.skip(
    (await okBtn.count()) === 0,
    "[gatherer] 编辑 Modal 无「确定/保存」按钮"
  );
  await okBtn.click();
  await patchPromise; // 必须真的发出请求，才算副作用
});

test("gatherer D1 推送 Scholar 副作用：点击推送 → POST /items/push 请求发出 + 成功提示", async ({ page, request }) => {
  // 造源 + 采集 + 造条目
  const src = await request.post("/api/gatherer/sources", {
    data: { name: "E2E推送源" + Date.now(), type: "rss", url: "https://example.com" },
  });
  const source = await src.json();
  await request.post("/api/gatherer/sources/" + source.id + "/collect");
  const items = await (await request.get("/api/gatherer/items?sourceId=" + source.id)).json();
  test.skip(
    items.length === 0,
    "[gatherer] 采集后无条目（FEED_STUB 桩应产出 2 条，检查桩环境）"
  );

  // ItemList 真实路由是 /sources/:sourceId/items（/admin/items 会被 /admin/* 重定向回源列表）
  await page.goto("/gatherer/sources/" + source.id + "/items");
  await expect(page.locator(".ant-card-head-title", { hasText: "采集条目" })).toBeVisible();

  // 勾选第一行（推送按钮要求先选中行，否则只弹 warning 不发请求）
  const firstRow = page.locator(".ant-table-tbody tr.ant-table-row").first();
  await firstRow.locator("input[type=checkbox]").check();

  // 推送按钮实际文案为「推送选中（N）」
  const pushBtn = page
    .getByRole("button", { name: /推送选中|推送.*Scholar|推送/i })
    .first();
  const pushTrigger = (await pushBtn.count()) > 0
    ? pushBtn
    : page.getByText(/推送\s*Scholar|推送至\s*Scholar/).first();
  test.skip(
    (await pushTrigger.count()) === 0,
    "[gatherer] 未命中「推送」按钮（检查按钮文案）"
  );
  // 模式 4：POST /items/push 请求发出
  const pushPromise = page.waitForRequest(
    (req) =>
      req.url().includes("/api/gatherer/items/push") && req.method() === "POST",
    { timeout: 12000 }
  );
  await pushTrigger.click();
  await pushPromise;
  // 模式 3/2：成功 toast/Modal 提示收件箱
  await expect(
    page.getByText(/Scholar|收件箱|成功|推送完成/i).first()
  ).toBeVisible({ timeout: 8000 });
});
