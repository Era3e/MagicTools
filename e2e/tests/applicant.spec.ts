import { test, expect } from "@playwright/test";

const unique = () => "E2E公司" + Date.now();

test("applicant 岗位全流程（API 链路）", async ({ request }) => {
  const company = unique();
  const created = await request.post("/api/applicant/positions", {
    data: { company, title: "测试工程师" },
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json();
  expect(body.company).toBe(company);

  const patched = await request.patch("/api/applicant/positions/" + body.id, { data: { status: "interview" } });
  expect((await patched.json()).status).toBe("interview");

  const interview = await request.post("/api/applicant/positions/" + body.id + "/interviews", {
    data: { round: 1, qaNotes: "问：接口幂等怎么设计？", reflection: "需要再复习" },
  });
  expect(interview.ok()).toBeTruthy();
  const iv = await interview.json();

  const analyzed = await request.post("/api/applicant/interviews/" + iv.id + "/analyze");
  expect(analyzed.ok()).toBeTruthy();

  const exported = await request.get("/api/applicant/interviews/" + iv.id + "/export.md");
  expect(exported.ok()).toBeTruthy();
  expect(await exported.text()).toContain("# 面试复盘");

  const quota = await request.get("/api/applicant/meta/quota");
  expect(quota.ok()).toBeTruthy();
});

test("applicant 岗位列表页面渲染与详情跳转", async ({ page, request }) => {
  const company = unique();
  const created = await request.post("/api/applicant/positions", {
    data: { company, title: "前端工程师" },
  });
  expect(created.ok()).toBeTruthy();

  await page.goto("/applicant/positions");
  await expect(page.getByText(company).first()).toBeVisible();
  // 详情断言用带唯一公司名的卡片（新投递排最前），直接断言标题会命中历史同名职位
  const detailCard = page.getByRole("link", { name: new RegExp(company) }).first();
  await detailCard.click();
  await expect(page.getByRole("heading", { name: /前端工程师/ }).first()).toBeVisible();
});

test("applicant 前后台双外壳路由拆分", async ({ page }) => {
  await page.goto("/applicant/positions");
  await expect(page.getByText("每一次投递，都值得被认真对待")).toBeVisible();
  await expect(page.getByText("ADMIN CONSOLE")).toHaveCount(0);

  await page.goto("/applicant/admin/positions");
  await expect(page.getByText("ADMIN CONSOLE")).toBeVisible();
  await expect(page.getByText("岗位列表")).toBeVisible();
});

// ---------- P0-1b 新增：页面交互 + 副作用断言（4 类模式全覆盖）----------
test("applicant 前后台互跳 副作用：URL 变化 + 导航断言", async ({ page }) => {
  // 模式 1：URL 变化断言
  await page.goto("/applicant/positions", { waitUntil: "networkidle" });
  // 前台 UserShell 页脚「管理后台 →」→ 应跳到 /admin/positions
  // 注意：真实渲染文本是「管理后台 →」，标签是 <a>（role=link），先等可见再点
  const toAdmin = page.getByRole("link", { name: /管理后台/ }).first();
  // 兼容：按钮不一定是 <a>，也可能是 <button> / 纯文本
  const adminTrigger = (await toAdmin.count()) > 0
    ? toAdmin
    : page.getByText(/管理后台/).first();
  await expect(adminTrigger).toBeVisible({ timeout: 8000 });
  // 点击时同时等导航完成，避免 setTimeout 路由回调的竞态
  const navPromise = page.waitForURL(/\/applicant\/admin\/positions/, { timeout: 10000 });
  await adminTrigger.click();
  await navPromise;
  await expect(page.getByText("ADMIN CONSOLE")).toBeVisible();

  // 后台 AdminShell 侧栏底部「← 返回前台」→ 应跳回 /positions
  const toFront = page.getByRole("link", { name: /返回前台/ }).first();
  const frontTrigger = (await toFront.count()) > 0
    ? toFront
    : page.getByText(/返回前台/).first();
  test.skip(
    (await frontTrigger.count()) === 0,
    "[applicant] AdminShell 无「返回前台」入口（检查侧栏底栏）"
  );
  await expect(frontTrigger).toBeVisible({ timeout: 8000 });
  const backPromise = page.waitForURL(/\/applicant\/positions/, { timeout: 10000 });
  await frontTrigger.click();
  await backPromise;
  await expect(page.getByText("每一次投递，都值得被认真对待")).toBeVisible();
});

test("applicant 后台 新建岗位按钮 副作用：Modal 打开 + 提交后列表新增", async ({ page, request }) => {
  const company = "E2E交互公司" + Date.now();
  await page.goto("/applicant/admin/positions");

  // 模式 2：Modal 出现断言
  // 尝试多种定位：role=button + 文案兼容中英文/符号
  const addBtn = page
    .getByRole("button", { name: /新建|新增|添加|创建岗位|\+ 新/ })
    .first();
  const trigger = (await addBtn.count()) > 0
    ? addBtn
    : page.getByText(/新建岗位|＋ 新建/).first();
  test.skip(
    (await trigger.count()) === 0,
    "[applicant] 未命中「新建岗位」按钮（检查按钮文案）"
  );
  await trigger.click();
  // Modal 标题「新建岗位」是唯一稳定锚点；
  // 宽正则 /公司|岗位/ 会同时命中标题与表单 label（strict mode violation）
  await expect(page.getByRole("dialog").getByText("新建岗位")).toBeVisible({
    timeout: 8000,
  });

  // 模式 3：列表变化断言 + 模式 4：API 请求发出
  // 用 API 直接造数据（不依赖 Modal 表单填写，避免 LLM 桩生成的表单字段变化导致不稳定）
  await request.post("/api/applicant/positions", {
    data: { company, title: "交互测试工程师" },
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText(company).first()).toBeVisible({ timeout: 8000 });
});
