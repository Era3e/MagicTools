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
  await page.getByText(company).first().click();
  await expect(page.getByText("前端工程师")).toBeVisible();
});
