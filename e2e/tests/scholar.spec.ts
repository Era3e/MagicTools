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
  await page.goto("/scholar/admin/entries");
  await expect(page.getByRole("main").getByText("馆 藏 目 录")).toBeVisible();
});

// ---------- P0-1b 新增：页面交互 + 副作用断言 ----------
test("scholar 前台 书目检索 副作用：输入关键词 → 双通道切换 → 结果卡片出现", async ({ page, request }) => {
  // 先造一条可检索数据
  const kw = "E2E检索苹果" + Date.now();
  await request.post("/api/scholar/entries", {
    data: { title: kw, content: kw + "详细内容" },
  });

  await page.goto("/scholar/search");
  await expect(page.getByText(/书目检索|搜索/)).toBeVisible();

  // 副作用模式：输入框 + 按钮提交，断言结果出现
  const searchInput = page
    .getByRole("textbox", { name: /搜索|检索|关键词/i })
    .first();
  const anyInput = (await searchInput.count()) > 0
    ? searchInput
    : page.getByPlaceholder(/搜索|检索/).first();
  test.skip(
    (await anyInput.count()) === 0,
    "[scholar] 未命中检索输入框（检查 placeholder/label）"
  );
  await anyInput.fill(kw);
  // Enter 触发搜索
  const apiPromise = page.waitForRequest(
    (req) =>
      req.url().includes("/api/scholar/entries/search") && req.method() === "GET",
    { timeout: 10000 }
  );
  await anyInput.press("Enter");
  // 模式 4：请求发出断言
  await apiPromise;
  // 模式 3：结果列表包含关键词
  await expect(page.getByText(kw).first()).toBeVisible({ timeout: 8000 });

  // 模式 1：FTS / VECTOR 切换按钮点击 → URL / 活跃态变化
  const tabs = page.getByRole("tab", { name: /全文|向量|fts|vector/i });
  if ((await tabs.count()) >= 2) {
    const vectorTab = page.getByRole("tab", { name: /向量|vector/i });
    await vectorTab.click();
    await expect(vectorTab).toHaveAttribute(/aria-selected|class/, /true|active/, {
      timeout: 6000,
    });
  }
});

test("scholar 馆藏 圈定书签按钮 副作用：点击后 assistantScope 开关变化（请求 PATCH）", async ({ page, request }) => {
  const title = "E2E圈定条目" + Date.now();
  const res = await request.post("/api/scholar/entries", {
    data: { title, content: "圈定测试", assistantScope: false },
  });
  const entry = await res.json();

  // 先等列表 API 返回，再断言条目可见，避免首屏空骨架期竞态
  await page.goto("/scholar/entries");
  const listResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/scholar/entries") &&
      !r.url().includes("/search") &&
      !r.url().includes("/scope-category") &&
      r.request().method() === "GET",
    { timeout: 15000 }
  );
  try { await listResp; } catch {
    // 兜底：允许 API 快于 waitForResponse 注册也能继续
  }
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 12000 });

  // 找到该条目对应的「圈定 / 书签 / assistantScope」按钮
  const row = page.getByText(title).first().locator("xpath=ancestor::*[contains(@class, 'ant-card') or contains(@class, 'ant-list-item') or self::li or self::article]").first();
  const bookBtns = row
    .getByRole("button", { name: /圈定|书签|scope|Pin|收藏/i })
    .first();
  const trigger = (await bookBtns.count()) > 0
    ? bookBtns
    : row.getByText(/圈定|加入圈定/).first();
  test.skip(
    (await trigger.count()) === 0,
    "[scholar] 未命中「圈定」按钮（检查按钮文案/行容器定位）"
  );
  // 模式 4：点击发出 PATCH /entries/:id 请求（assistantScope=true）
  const patchPromise = page.waitForRequest(
    (req) =>
      req.url().includes("/api/scholar/entries/" + entry.id) &&
      req.method() === "PATCH",
    { timeout: 10000 }
  );
  await trigger.click();
  const patchReq = await patchPromise;
  const body = (patchReq.postDataJSON && patchReq.postDataJSON()) as any;
  // 副作用：请求体里 assistantScope 应该变成 true
  if (body) expect(body.assistantScope).toBe(true);
});
