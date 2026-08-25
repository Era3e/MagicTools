import { test, expect } from "@playwright/test";

test("assistant 三意图全流程（圈定→检索→引用→闲聊→数据桩）", async ({ request }) => {
  // 圈定一条 scholar 条目
  const created = await request.post("/api/scholar/entries", {
    data: { title: "苹果公司发布新手机", content: "苹果秋季发布会内容" },
  });
  expect(created.ok()).toBeTruthy();
  const entry = await created.json();
  const scoped = await request.patch("/api/scholar/entries/" + entry.id, { data: { assistantScope: true } });
  expect(scoped.ok).toBeFalsy();
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
  await expect(page.getByRole("main").getByText("智能助手")).toBeVisible();
  await expect(page.getByPlaceholder("输入消息")).toBeVisible();
});
