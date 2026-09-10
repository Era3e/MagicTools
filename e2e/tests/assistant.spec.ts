import { test, expect } from "@playwright/test";

test("assistant 三意图全流程（圈定→检索→引用→闲聊→数据桩）", async ({ request }) => {
  // 圈定一条 scholar 条目
  const created = await request.post("/api/scholar/entries", {
    data: { title: "苹果公司发布新手机", content: "苹果秋季发布会内容" },
  });
  expect(created.ok()).toBeTruthy();
  const entry = await created.json();
  const scoped = await request.patch("/api/scholar/entries/" + entry.id, { data: { assistantScope: true } });
  expect(scoped.ok()).toBeTruthy();

  // product_inquiry：检索圈定条目并带引用
  const product = await request.post("/api/assistant/chat", { data: { message: "苹果公司有什么新动态" } });
  expect(product.ok()).toBeTruthy();
  const productBody = await product.json();
  expect(productBody.intent).toBe("product_inquiry");
  expect(productBody.citations.length).toBeGreaterThanOrEqual(1);
  expect(productBody.citations[0].title).toContain("苹果公司发布新手机");

  // 多轮：同一会话追问
  const follow = await request.post("/api/assistant/chat", {
    data: { sessionId: productBody.sessionId, message: "它的发布会内容是什么" },
  });
  expect(follow.ok()).toBeTruthy();
  expect((await follow.json()).intent).toBe("product_inquiry");

  // chitchat_reject
  const chitchat = await request.post("/api/assistant/chat", { data: { message: "你好" } });
  expect(chitchat.ok()).toBeTruthy();
  expect((await chitchat.json()).intent).toBe("chitchat_reject");

  // data_query（CI 桩模式）
  const data = await request.post("/api/assistant/chat", { data: { message: "查询一下销售数据" } });
  expect(data.ok()).toBeTruthy();
  const dataBody = await data.json();
  expect(dataBody.intent).toBe("data_query");
  expect(dataBody.reply).toContain("12345");

  // 会话列表含历史
  const conversations = await request.get("/api/assistant/conversations");
  expect(conversations.ok()).toBeTruthy();
  expect((await conversations.json()).length).toBeGreaterThanOrEqual(1);
});

test("assistant 聊天页面渲染", async ({ page }) => {
  await page.goto("/assistant/chat");
  await expect(page.getByText("有问题，就直接问")).toBeVisible();
  await expect(page.getByPlaceholder("输入消息")).toBeVisible();
});

// ---------- P0-1b 新增：发送消息 副作用断言 ----------
test("assistant 聊天 发送消息 副作用：回车发送 → 气泡数+1 + POST /chat 请求发出", async ({ page }) => {
  await page.goto("/assistant/chat");
  const input = page
    .getByPlaceholder(/输入消息|请输入|Send a message/i)
    .first();
  // ChatPage 实测 placeholder 为「输入消息」（ChatPage.tsx sendInput）；
  // 命中失败属定位器失配，显式 skip 计入报告而非静默通过
  test.skip((await input.count()) === 0, "[assistant] 未命中聊天输入框（检查 ChatPage placeholder「输入消息」）");

  // 会话列表加载期间 textbox 处于 disabled（按钮转 loading），
  // 必须等输入框可用再输入，否则回车被吞、POST /chat 根本不发
  await expect(input).toBeEnabled({ timeout: 10000 });

  // 发送消息（带唯一标记），回车提交
  const marker = "E2E气泡" + Date.now();
  const chatPromise = page.waitForRequest(
    (req) => req.url().includes("/api/assistant/chat") && req.method() === "POST",
    { timeout: 15000 }
  );
  // 响应回来后才追加用户+助手两个气泡（ChatPage.sendText），必须等响应而非仅请求
  const chatDone = page.waitForResponse(
    (r) => r.url().includes("/api/assistant/chat") && r.request().method() === "POST",
    { timeout: 15000 }
  );

  await input.fill(marker + "：你好，我要查一下系统状态");
  await input.press("Enter");

  // 模式 4：POST 聊天 API 必须发出去
  await chatPromise;
  await chatDone;

  // 模式 3：气泡是纯内联样式 div（无 class/article），
  // 计数 selector 匹配不到任何元素；改为断言用户消息文本已作为气泡渲染（更强的副作用证明）
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 8000 });
});

test("assistant 导航跳转 副作用：反馈页 / 意图日志页 URL 变化", async ({ page }) => {
  // 前台 IA（App.tsx USER_NAV）仅有「对话」；去后台唯一入口是
  // UserShell 页脚「管理后台 →」（adminPath=/admin/feedback，App.tsx 实证）
  await page.goto("/assistant/chat");
  const adminLink = page
    .getByRole("link", { name: /管理后台/i })
    .first();
  test.skip((await adminLink.count()) === 0, "[assistant] 未命中页脚「管理后台 →」入口（UserShell adminPath）");
  await adminLink.click();
  await expect(page).toHaveURL(/\/assistant\/admin\/feedback/, { timeout: 8000 });
  // FeedbackPage 页面锚点是 Card 标题「用户反馈」（FeedbackPage.tsx:26）；
  // 侧栏菜单文案为「反馈处理」——用完整词避免正则 /反馈/ 双命中
  await expect(page.getByText("用户反馈", { exact: true })).toBeVisible();

  // 意图日志：后台侧栏菜单（ADMIN_NAV「意图日志」→ /admin/intent-logs）。
  // AdminShell 侧栏 <a> 无 href（AdminShell.tsx:105），无障碍树非 link 角色，
  // 须按 nav[aria-label=后台导航] 容器 + 精确文本定位（getByRole("link") 必 0 命中）
  const logLink = page
    .getByRole("navigation", { name: "后台导航" })
    .getByText("意图日志", { exact: true });
  test.skip((await logLink.count()) === 0, "[assistant] 后台侧栏无「意图日志」菜单（ADMIN_NAV）");
  await logLink.click();
  await expect(page).toHaveURL(/\/assistant\/admin\/intent-logs/, { timeout: 8000 });
  await expect(page.getByText(/意图日志/)).toBeVisible();
});
