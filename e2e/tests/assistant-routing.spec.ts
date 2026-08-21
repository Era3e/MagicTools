import { test, expect } from "@playwright/test";

test("assistant 意图日志与澄清闭环（经网关）", async ({ request }) => {
  // 高置信度直接执行并落日志
  const chat = await request.post("/api/assistant/chat", { data: { message: "帮我创建一个订单业务对象" } });
  expect(chat.ok()).toBeTruthy();
  const chatBody = await chat.json();
  expect(chatBody.domain).toBe("cybercloud");
  expect(chatBody.intent).toBe("data_query");
  expect(chatBody.clarifying).toBe(false);

  const logs = await request.get("/api/assistant/intent-logs");
  expect(logs.ok()).toBeTruthy();
  const logBody = await logs.json();
  expect(logBody.length).toBeGreaterThanOrEqual(1);
  const first = logBody[0];
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
