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
  await expect(page.getByRole("heading", { name: "馆藏管理" })).toBeVisible();
});

test("scholar 前台 帮助检索 副作用：公共 API 返回发布证据", async ({ page, request }) => {
  const kw = "E2E发布帮助苹果" + Date.now();
  const created = await request.post("/api/scholar/entries", {
    data: { title: kw, content: kw + "详细内容", spaceKey: "product" },
  });
  expect(created.ok()).toBeTruthy();
  const productRows = await (await request.get("/api/scholar/entries?spaceKey=product")).json();
  const createdRow = productRows.find((item: { title: string }) => item.title === kw);
  expect(createdRow).toBeTruthy();

  const current = await request.get("/api/scholar/public/version/current");
  const publicEntries = current.ok() ? await (await request.get("/api/scholar/public/entries")).json() : [];
  const version = await request.post("/api/scholar/spaces/product/versions", {
    data: { version: "scholar-e2e-" + Date.now(), sourceRevision: "scholar-e2e" },
  });
  expect(version.ok()).toBeTruthy();
  const entryIds = [...new Set([...publicEntries.map((item: { id: string }) => item.id), createdRow.id])];
  const published = await request.post("/api/scholar/versions/" + (await version.json()).id + "/publish", {
    data: {
      entryIds,
      deploymentRef: "scholar-e2e-product",
      publishedBy: "e2e-scholar",
    },
  });
  const publishedBody = await published.json();
  expect(published.ok(), JSON.stringify(publishedBody)).toBeTruthy();

  await page.goto("/scholar/search");
  await expect(page.getByPlaceholder("输入任务或问题，例如：如何核对引用")).toBeVisible();

  const input = page.getByPlaceholder("输入任务或问题，例如：如何核对引用");
  await input.fill(kw);
  const apiPromise = page.waitForRequest(
    (req) => req.url().includes("/api/scholar/public/search") && req.method() === "POST",
    { timeout: 10000 },
  );
  await input.press("Enter");
  await apiPromise;
  await expect(page.getByText(kw).first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/chunk \d+ · \d+-\d+/).first()).toBeVisible();
});

test("scholar 后台 圈定书签按钮 副作用：点击后 assistantScope 开关变化", async ({ page, request }) => {
  const title = "E2E圈定条目" + Date.now();
  const res = await request.post("/api/scholar/entries", {
    data: { title, content: "圈定测试", assistantScope: false },
  });
  const entry = await res.json();

  await page.goto("/scholar/admin/entries");
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 12000 });

  const row = page.getByText(title).first().locator("xpath=ancestor::*[contains(@class, 'ant-table-row') or contains(@class, 'ant-card') or self::li or self::article]").first();
  const trigger = row.getByRole("button", { name: /圈定|书签|scope|Pin|收藏/i }).first();
  await expect(trigger).toBeVisible({ timeout: 8000 });
  const patchPromise = page.waitForRequest(
    (req) => req.url().includes("/api/scholar/entries/" + entry.id) && req.method() === "PATCH",
    { timeout: 10000 },
  );
  await trigger.click();
  const patchReq = await patchPromise;
  const body = (patchReq.postDataJSON && patchReq.postDataJSON()) as { assistantScope?: boolean } | null;
  if (body) expect(body.assistantScope).toBe(true);
});
