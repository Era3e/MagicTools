import { test, expect } from "@playwright/test";

test("assistant 三新意图全流程（动作/排查/反馈）", async ({ request }) => {
  // process_execution（CI 用 ACTION_STUB 桩回执）
  const action = await request.post("/api/assistant/chat", { data: { message: "帮我创建一个需求：支持导出功能" } });
  expect(action.ok()).toBeTruthy();
  const actionBody = await action.json();
  expect(actionBody.intent).toBe("process_execution");
  expect(actionBody.actionResult.ok).toBe(true);

  // trouble_shooting：返回状态概览与建议
  const trouble = await request.post("/api/assistant/chat", { data: { message: "系统报错了怎么排查" } });
  expect(trouble.ok()).toBeTruthy();
  const troubleBody = await trouble.json();
  expect(troubleBody.intent).toBe("trouble_shooting");
  expect(troubleBody.reply).toContain("建议");

  // complaint_feedback：落库可查
  const feedback = await request.post("/api/assistant/chat", { data: { message: "我要投诉，功能不好用" } });
  expect(feedback.ok()).toBeTruthy();
  const feedbackBody = await feedback.json();
  expect(feedbackBody.intent).toBe("complaint_feedback");
  expect(feedbackBody.reply).toContain("收到");

  const list = await request.get("/api/assistant/feedback");
  expect(list.ok()).toBeTruthy();
  expect((await list.json()).length).toBeGreaterThanOrEqual(1);
});

test("assistant 反馈页面渲染", async ({ page }) => {
  await page.goto("/assistant/feedback");
  await expect(page.getByText("用户反馈")).toBeVisible();
});
