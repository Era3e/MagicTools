import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test("Manager 候选从预览到能力基线与规划证据", async ({ page, request }, testInfo) => {
  const marker = randomUUID();
  const commit = "7b6fa7bb71be01245cbbe8bed849373a4c1897c2";
  const baselineTitle = "E2E 能力基线 " + marker;
  const planTitle = "E2E 规划证据 " + marker;
  const common = { project: "manager", description: "浏览器验收候选", source_commit: commit,
    review_status: "unreviewed", automation_eligible: false,
    evidence: [{ path: "apps/manager/server/src/requirement.service.ts", line: 1, commit,
      url: `https://github.com/Era3e/MagicTools/blob/${commit}/apps/manager/server/src/requirement.service.ts#L1` }] };
  const bundle = { schema_version: "magictools-requirement-candidates/0.1", repository: "https://github.com/Era3e/MagicTools", snapshot_commit: commit,
    records: [
      { ...common, candidate_id: "E2E-BASE-" + marker, record_kind: "baseline", source: "repo_reverse", title: baselineTitle,
        verification_gaps: ["尚未核验部署"] },
      { ...common, candidate_id: "E2E-PLAN-" + marker, record_kind: "planned", source: "audit_proposal", title: planTitle,
        priority: "P1", acceptance_criteria: ["来源证据可追溯"], depends_on: [] },
    ] };
  await page.goto("/manager/admin/requirements");
  await page.getByRole("button", { name: "导入候选" }).click();
  await page.getByRole("textbox", { name: "候选 JSON" }).fill(JSON.stringify(bundle));
  await page.getByRole("button", { name: "预览候选" }).click();
  await expect(page.getByRole("cell", { name: baselineTitle, exact: true })).toBeVisible();
  const before = await (await request.get("/api/manager/requirements")).json();
  expect(before.some((r: { title: string }) => r.title === planTitle)).toBe(false);
  const completed = page.waitForResponse((response) => response.url().endsWith("/confirm") && response.request().method() === "POST");
  await page.getByRole("button", { name: "确认导入选中项" }).click();
  const response = await completed;
  expect(response.status()).toBe(201);
  const result = await response.json();
  await testInfo.attach("candidate-import-result", { body: JSON.stringify(result), contentType: "application/json" });
  await expect(page.getByText("导入完成：能力基线 1 条，规划需求 1 条")).toBeVisible();
  await page.locator(".ant-modal-close").click();
  await expect(page.locator(".ant-modal")).toHaveCount(0);
  await page.getByRole("button", { name: "查看能力基线" }).click();
  await expect(page.getByRole("cell", { name: baselineTitle, exact: true })).toBeVisible();
  const requirements = await (await request.get("/api/manager/requirements")).json();
  expect(requirements.some((r: { title: string }) => r.title === baselineTitle)).toBe(false);
  const planned = requirements.find((r: { title: string }) => r.title === planTitle);
  expect(planned).toMatchObject({ status: "waiting", automationPolicy: "manual", acceptanceCriteria: ["来源证据可追溯"] });
  await page.goto("/manager/requirements/" + planned.id);
  await expect(page.getByRole("heading", { name: "验收与实现证据" })).toBeVisible();
  await expect(page.getByText("来源证据可追溯", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "apps/manager/server/src/requirement.service.ts:1" }))
    .toHaveAttribute("href", `https://github.com/era3e/magictools/blob/${commit}/apps/manager/server/src/requirement.service.ts#L1`);
});
