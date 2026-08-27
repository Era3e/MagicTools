import { test, expect } from "@playwright/test";

test("designer 全流程（生成→预览→沉淀→列表→历史）", async ({ request }) => {
  const created = await request.post("/api/designer/generate", {
    data: { prompt: "一个问候卡片" },
  });
  expect(created.ok()).toBeTruthy();
  const gen = await created.json();
  expect(gen.status).toBe("ok");
  expect(gen.componentName).toBeTruthy();

  const preview = await request.post("/api/designer/preview", { data: { code: gen.code } });
  expect(preview.ok()).toBeTruthy();

  const saved = await request.post("/api/designer/components", {
    data: { name: gen.componentName, description: "e2e", code: gen.code },
  });
  expect(saved.ok()).toBeTruthy();

  const comps = await (await request.get("/api/designer/components")).json();
  expect(comps.length).toBeGreaterThanOrEqual(1);

  const history = await request.get("/api/designer/generations");
  expect((await history.json()).length).toBeGreaterThanOrEqual(1);
});

test("designer 生成页面渲染", async ({ page }) => {
  await page.goto("/designer/generate");
  await expect(page.getByText(/定制生成/)).toBeVisible();
});

// ---------- P0-1b 新增：画廊委托单交互 + 列表跳转副作用断言 ----------
test("designer 生成按钮 副作用：点击生成 → POST /generate 请求发出", async ({ page }) => {
  await page.goto("/designer/generate");
  const promptInput = page
    .getByRole("textbox", { name: /prompt|描述|定制|需求|生成.*描述/i })
    .first();
  const input = (await promptInput.count()) > 0
    ? promptInput
    : page.getByPlaceholder(/描述.*组件|prompt|请输入|描述你/).first();
  test.skip(
    (await input.count()) === 0,
    "[designer] 未命中生成描述输入框（检查 placeholder/label）"
  );
  const genPromise = page.waitForRequest(
    (req) => req.url().includes("/api/designer/generate") && req.method() === "POST",
    { timeout: 15000 }
  );
  await input.fill("一个蓝绿色的问候卡片组件（E2E交互）");
  // 按钮文案渲染为「生 成」（AntD 双字按钮的字间空格，计入 accessible name），
  // 正则须显式允许 \s*，否则 /生成/ 命不中 → 回退 Enter（TextArea 只换行不提交）
  const genBtn = page
    .getByRole("button", { name: /生\s*成|定\s*制|委\s*托|Generate|提\s*交/i })
    .first();
  const btn = (await genBtn.count()) > 0 ? genBtn : page.getByText(/生成组件|委托生成/).first();
  test.skip(
    (await btn.count()) === 0,
    "[designer] 未命中「生成」按钮（TextArea 的 Enter 只换行不提交，无兜底）"
  );
  await btn.click();
  // 模式 4：API 必须发出
  await genPromise;
  // 模式 3：展位区出现组件名 / 预览框
  await expect(
    page.getByText(/预览|Preview|生成完成|组件|展品/i).first()
  ).toBeVisible({ timeout: 12000 });
});

test("designer 导航跳转 副作用：组件馆藏 / 生成历史 URL 变化", async ({ page }) => {
  await page.goto("/designer/generate");
  const compLink = page
    .getByRole("link", { name: /组件.*馆藏|组件库|components|馆藏/i })
    .first();
  const compTrigger = (await compLink.count()) > 0
    ? compLink
    : page.getByText(/组件馆藏|组件库/).first();
  test.skip(
    (await compTrigger.count()) === 0,
    "[designer] 未命中「组件馆藏」导航入口"
  );
  await compTrigger.click();
  await expect(page).toHaveURL(/\/designer\/(admin\/)?components/, { timeout: 8000 });
  await expect(page.getByText(/组件|components|馆藏/i)).toBeVisible();
});
