import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test("manager 长范围文本在手机详情中换行", async ({ page, request }) => {
  const created = await request.post("/api/manager/requirements", { data: {
    title: "E2E长范围-" + randomUUID(), scope: "接口标识符：" + "ManagerRequirementApprovalContentRevision".repeat(5),
  } });
  expect(created.ok()).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/manager/requirements/${(await created.json()).id}`);
  await expect(page.getByRole("button", { name: "编辑需求内容" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

for (const width of [1440, 390]) {
  test(`manager 内容审批与历史闭环 ${width}px`, async ({ page, request }) => {
    const token = process.env.MANAGER_APPROVAL_TOKEN;
    // 缺少测试凭证必须失败；CI 在启动服务前生成一次性凭证，无鉴权旁路。
    expect(Boolean(token), "需要为服务端和测试进程配置相同的临时审批凭证").toBe(true);
    await page.setViewportSize({ width, height: 900 });
    const created = await request.post("/api/manager/requirements", { data: {
      title: "E2E内容审批-" + randomUUID(), description: "让需求修改与批准绑定明确版本", project: "manager",
      acceptanceCriteria: ["修改后旧批准失效"],
    } });
    expect(created.ok()).toBe(true);
    const item = await created.json();
    const endpoint = `/api/manager/requirements/${item.id}`;
    await page.goto(`/manager/requirements/${item.id}`);
    await expect(page.getByRole("button", { name: "批准本版内容" })).toBeDisabled();
    await page.getByRole("button", { name: "编辑需求内容" }).click();
    await page.getByLabel("实施范围", { exact: true }).fill("仅调整管理者需求详情页");
    // AntD 的只读 combobox 被选中值覆盖；点击用户实际可见的选中值打开菜单。
    await page.getByRole("dialog").getByText("尚未评估", { exact: true }).click();
    await page.getByText("低", { exact: true }).click();
    const saved = page.waitForResponse((res) => res.url().endsWith(endpoint) && res.request().method() === "PATCH");
    await page.getByRole("button", { name: "保存内容" }).click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("内容修订 2", { exact: true })).toBeVisible();

    async function decide(action: "approve" | "revoke") {
      await page.getByRole("button", { name: action === "approve" ? "批准本版内容" : "撤销批准", exact: true }).click();
      await page.getByLabel("审批凭证", { exact: true }).fill(token!);
      await page.getByLabel("审批说明", { exact: true }).fill(action === "approve" ? "确认本版范围与验收条件" : "重新核对排期");
      const response = page.waitForResponse((res) => res.url().endsWith(endpoint + (action === "approve" ? "/approve-revision" : "/revoke-approval")));
      await page.getByRole("button", { name: action === "approve" ? "确认批准" : "确认撤销", exact: true }).click();
      expect((await response).ok()).toBe(true);
      await expect(page.getByLabel("审批凭证", { exact: true })).toHaveCount(0);
    }
    await decide("approve");
    await expect(page.getByText("本版内容已批准", { exact: true })).toBeVisible();
    // 模拟另一窗口修改同一条需求，内容审批必须失效。
    const current = await (await request.get(endpoint)).json();
    const changed = await request.patch(endpoint, { data: { scope: "增加手机宽度下的历史查看", expectedRevision: current.revision } });
    expect(changed.ok()).toBe(true);
    expect((await changed.json()).approvalStatus).toBe("outdated");
    await page.reload();
    await expect(page.getByText("内容已变化，需重新审批", { exact: true })).toBeVisible();
    await decide("approve");
    await expect(page.getByText("本版内容已批准", { exact: true })).toBeVisible();
    await decide("revoke");
    await expect(page.getByText("本版内容待批准", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "查看版本与审批记录" }).click();
    await expect(page.getByRole("region", { name: "内容版本对比" })).toBeVisible();
    await expect(page.getByText("仅调整管理者需求详情页", { exact: true })).toBeVisible();
    await expect(page.getByText("增加手机宽度下的历史查看", { exact: true })).toBeVisible();
    await expect(page.getByText("重新核对排期", { exact: true })).toBeVisible();
    await expect(page.getByText("第 3 版 · 撤销批准", { exact: true })).toBeVisible();
    const overflow = await page.getByRole("dialog").evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(overflow).toBe(false);
    const history = await (await request.get(endpoint + "/approvals")).json();
    expect(history.items.map((event: { decision: string }) => event.decision)).toEqual(["revoked", "approved", "approved"]);
    const final = await (await request.get(endpoint)).json();
    expect(final.automationPolicy).toBe("manual");
    expect(final.status).toBe("waiting");
  });
}
