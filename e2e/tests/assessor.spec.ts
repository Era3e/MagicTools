import { test, expect } from "@playwright/test";

test("assessor 全流程（poll→上下文→generate→review→push，双桩）", async ({ request }) => {
  // 造数据：走 investigator API 推送（真实链路）
  const survey = await request.post("/api/investigator/surveys", {
    data: { name: "E2E审阅主题" + Date.now(), appToken: "appX", tableId: "tblX", answerFields: ["回答"] },
  });
  const sv = await survey.json();
  await request.post("/api/investigator/surveys/" + sv.id + "/sync");
  const resps = await (await request.get("/api/investigator/surveys/" + sv.id + "/responses")).json();
  await request.post("/api/investigator/surveys/" + sv.id + "/push", { data: { recordIds: [resps[0].id] } });

  const polled = await request.post("/api/assessor/inbox/poll");
  expect(polled.ok()).toBeTruthy();
  expect((await polled.json()).created).toBeGreaterThanOrEqual(1);

  const list = await (await request.get("/api/assessor/requests")).json();
  const target = list[0];

  const patched = await request.patch("/api/assessor/requests/" + target.id, { data: { repoUrl: "Era3e/MagicTools" } });
  expect(patched.ok()).toBeTruthy();

  const generated = await request.post("/api/assessor/requests/" + target.id + "/generate");
  expect(generated.ok()).toBeTruthy();
  const gen = await generated.json();
  expect(gen.analysisMd).toContain("需求分析");

  const reviewed = await request.post("/api/assessor/requests/" + target.id + "/review", {
    data: { approve: true, comment: "E2E 通过" },
  });
  expect(reviewed.ok()).toBeTruthy();

  const pushed = await request.post("/api/assessor/requests/" + target.id + "/push");
  expect(pushed.ok()).toBeTruthy();
  expect((await pushed.json()).pushed).toBe(true);
});
