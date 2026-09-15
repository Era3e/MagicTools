import { test, expect } from "@playwright/test";
import {
  ASSISTANT_SAMPLE_QUESTION,
  MANAGER_SAMPLE_TITLE,
  SCHOLAR_SAMPLE_TITLE,
  seedBusinessSamples,
} from "../fixtures/business-samples";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  await seedBusinessSamples(request);
});

test("P14 样板键盘导航：Manager 卡片 Enter 进入详情", async ({ page }) => {
  await page.goto("/manager/requirements");
  const card = page.getByRole("link", { name: new RegExp(MANAGER_SAMPLE_TITLE) }).first();
  await card.focus();
  await expect(card).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/发布看板、对话与帮助目录三类真实页面样板/).first()).toBeVisible();
});

test("P14 样板键盘导航：Assistant 会话 Enter 装载长对话", async ({ page }) => {
  await page.goto("/assistant/chat");
  const session = page.getByRole("button", { name: new RegExp(ASSISTANT_SAMPLE_QUESTION) }).first();
  await session.focus();
  await expect(session).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(SCHOLAR_SAMPLE_TITLE).first()).toBeVisible();
});

test("P14 样板键盘导航：Scholar 检索框保留帮助条目", async ({ page }) => {
  await page.goto("/scholar/entries");
  const search = page.getByPlaceholder("搜索任务，例如：简历、需求、引用");
  await search.focus();
  await search.pressSequentially("用户帮助");
  await expect(page.getByText(SCHOLAR_SAMPLE_TITLE).first()).toBeVisible();
});
