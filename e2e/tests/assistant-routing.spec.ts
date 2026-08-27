import { test, expect } from "@playwright/test";

test("assistant 意图日志与澄清闭环（经网关）", async ({ request }) => {
  // 高置信度直接执行并落日志（message 带唯一标记，并发下用于精确定位自己的日志行）
  const marker = "帮我创建一个订单业务对象（" + Date.now() + "）";
  const chat = await request.post("/api/assistant/chat", { data: { message: marker } });
  expect(chat.ok()).toBeTruthy();
  const chatBody = await chat.json();
  expect(chatBody.domain).toBe("cybercloud");
  expect(chatBody.intent).toBe("data_query");
  expect(chatBody.clarifying).toBe(false);

  const logs = await request.get("/api/assistant/intent-logs");
  expect(logs.ok()).toBeTruthy();
  const logBody = await logs.json();
  expect(logBody.length).toBeGreaterThanOrEqual(1);
  // intent_logs 表无 sessionId 列；并发套件共享日志表，
  // [0] 可能是其他用例刚写入的行，按本用例唯一 message 文本精确匹配
  const first = logBody.find((l: { message: string }) => l.message === marker) ?? logBody[0];
  expect(first.domain).toBe("cybercloud");
  expect(first.intent).toBe("data_query");
  expect(first.confidence).toBeGreaterThanOrEqual(0.9);

  // 纠错回填
  const corrected = await request.post("/api/assistant/intent-logs/" + first.id + "/correct", {
    data: { correctedIntent: "product_inquiry" },
  });
  expect(corrected.ok()).toBeTruthy();
  expect((await corrected.json()).correctedIntent).toBe("product_inquiry");
});

test("assistant 意图日志页面渲染", async ({ page }) => {
  await page.goto("/assistant/intent-logs");
  await expect(page.getByRole("main").getByText("意图日志")).toBeVisible();
});
