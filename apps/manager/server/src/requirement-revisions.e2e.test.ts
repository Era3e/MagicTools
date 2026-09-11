import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";
import { randomBytes } from "node:crypto";

let app: INestApplication;
const approvalToken = randomBytes(32).toString("hex");
const previousToken = process.env.MANAGER_APPROVAL_TOKEN;
const previousActor = process.env.MANAGER_APPROVAL_ACTOR;
beforeAll(async () => {
  process.env.MANAGER_APPROVAL_TOKEN = approvalToken;
  process.env.MANAGER_APPROVAL_ACTOR = "test-owner";
  await ensureDatabase();
  await migrate();
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix("api/manager");
  await app.init();
}, 20000);
afterAll(async () => {
  if (app) await app.close(); await pool.end();
  if (previousToken === undefined) delete process.env.MANAGER_APPROVAL_TOKEN; else process.env.MANAGER_APPROVAL_TOKEN = previousToken;
  if (previousActor === undefined) delete process.env.MANAGER_APPROVAL_ACTOR; else process.env.MANAGER_APPROVAL_ACTOR = previousActor;
});

async function createComplete() {
  return request(app.getHttpServer()).post("/api/manager/requirements").send({
    title: "可审批需求", description: "明确的用户目标", project: "manager", scope: "仅需求详情页",
    risk: "low", acceptanceCriteria: ["展示正确结果"],
  }).expect(201);
}

describe("需求内容修订", () => {
  it("超出数据库整数范围的历史游标返回参数错误", async () => {
    const created = await createComplete();
    for (const endpoint of ["revisions", "approvals"]) {
      await request(app.getHttpServer()).get(`/api/manager/requirements/${created.body.id}/${endpoint}?before=2147483648`).expect(400);
    }
  });

  it("存量或旧导入留下的空白验收条件不能获准", async () => {
    const created = await createComplete();
    // 模拟旧导入器允许的已落库内容；审批入口必须独立校验，不能只信创建入口。
    await pool.query("UPDATE requirements SET acceptance_criteria=$2 WHERE id=$1", [created.body.id, JSON.stringify(["   "])]);
    const prefix = `/api/manager/requirements/${created.body.id}`;
    const current = await request(app.getHttpServer()).get(prefix).expect(200);
    expect(current.body.approvalReadiness).toMatchObject({ ready: false, missing: ["验收条件"] });
    await request(app.getHttpServer()).post(prefix + "/approve-revision").set("x-manager-approval-token", approvalToken)
      .send({ expectedRevision: current.body.revision, expectedContentRevision: current.body.contentRevision }).expect(400);
  });

  it("内容改变使批准过期，旧版审批请求不能批准新内容，恢复旧文字也需要重审", async () => {
    const created = await createComplete();
    const prefix = `/api/manager/requirements/${created.body.id}`;
    const approveInput = { expectedRevision: 1, expectedContentRevision: 1 };
    const approved = await request(app.getHttpServer()).post(prefix + "/approve-revision")
      .set("x-manager-approval-token", approvalToken).send(approveInput).expect(200);
    const metadata = await request(app.getHttpServer()).patch(prefix).send({ branch: "feat-owner", priority: "P0", expectedRevision: approved.body.revision }).expect(200);
    expect(metadata.body.approvalStatus).toBe("approved");
    const edited = await request(app.getHttpServer()).patch(prefix).send({ scope: "扩大的实施范围", expectedRevision: metadata.body.revision }).expect(200);
    expect(edited.body).toMatchObject({ contentRevision: 2, approvedContentRevision: 1, approvalStatus: "outdated" });
    await request(app.getHttpServer()).post(prefix + "/approve-revision")
      .set("x-manager-approval-token", approvalToken).send(approveInput).expect(409);
    const reverted = await request(app.getHttpServer()).patch(prefix).send({ scope: created.body.scope, expectedRevision: edited.body.revision }).expect(200);
    expect(reverted.body).toMatchObject({ contentRevision: 3, approvedContentRevision: 1, approvalStatus: "outdated" });
    const history = await request(app.getHttpServer()).get(prefix + "/revisions").expect(200);
    expect(history.body.items.find((r: { contentRevision: number }) => r.contentRevision === 1).content.scope).toBe(created.body.scope);
  });

  it("审批与内容编辑并发时不会让新内容继承旧批准", async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const created = await createComplete();
      const prefix = `/api/manager/requirements/${created.body.id}`;
      const results = await Promise.all([
        request(app.getHttpServer()).post(prefix + "/approve-revision").set("x-manager-approval-token", approvalToken)
          .send({ expectedRevision: 1, expectedContentRevision: 1 }),
        request(app.getHttpServer()).patch(prefix).send({ description: "并发新内容" }),
      ]);
      expect(results[1].status).toBe(200);
      expect([200, 409]).toContain(results[0].status);
      const current = await request(app.getHttpServer()).get(prefix).expect(200);
      expect(current.body.contentRevision).toBe(2);
      expect(current.body.approvalStatus).not.toBe("approved");
      expect(current.body.approvedContentRevision).not.toBe(2);
    }
  });

  it("并发重放同一批准只产生一条审批事件", async () => {
    const created = await createComplete();
    const prefix = `/api/manager/requirements/${created.body.id}`;
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(app.getHttpServer()).post(prefix + "/approve-revision")
      .set("x-manager-approval-token", approvalToken).send({ expectedRevision: 1, expectedContentRevision: 1 })));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(new Set(responses.map((r) => r.body.revision)).size).toBe(1);
    const history = await request(app.getHttpServer()).get(prefix + "/approvals").expect(200);
    expect(history.body.items).toHaveLength(1);
  });

  it("凭证未配置、错误或内容缺失时不产生批准，客户端不能指定审批人或批准版本", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements").send({ title: "尚未完善" }).expect(201);
    const prefix = `/api/manager/requirements/${created.body.id}`;
    const input = { expectedRevision: 1, expectedContentRevision: 1 };
    await request(app.getHttpServer()).post(prefix + "/approve-revision").set("x-manager-approval-token", "wrong").send(input).expect(403);
    delete process.env.MANAGER_APPROVAL_TOKEN;
    try {
      await request(app.getHttpServer()).post(prefix + "/approve-revision").set("x-manager-approval-token", approvalToken).send(input).expect(503);
    } finally { process.env.MANAGER_APPROVAL_TOKEN = approvalToken; }
    await request(app.getHttpServer()).post(prefix + "/approve-revision").set("x-manager-approval-token", approvalToken).send(input).expect(400);
    await request(app.getHttpServer()).post(prefix + "/approve-revision").set("x-manager-approval-token", approvalToken).send({ ...input, actorId: "forged" }).expect(400);
    await request(app.getHttpServer()).patch(prefix).send({ approvedContentRevision: 1 }).expect(400);
    const history = await request(app.getHttpServer()).get(prefix + "/approvals").expect(200);
    expect(history.body.items).toEqual([]);
    const policy = await request(app.getHttpServer()).get("/api/manager/meta/approval-policy").expect(200);
    expect(policy.body).toMatchObject({ configured: true, actorId: "test-owner", automatedExecutionEnabled: false });
    expect(JSON.stringify(policy.body)).not.toContain(approvalToken);
  });

  it("修订可向前分页，重复保存相同内容不产生新内容修订", async () => {
    const created = await createComplete();
    const prefix = `/api/manager/requirements/${created.body.id}`;
    for (const description of ["V2", "V3", "V4", "V4"]) {
      await request(app.getHttpServer()).patch(prefix).send({ description }).expect(200);
    }
    const first = await request(app.getHttpServer()).get(prefix + "/revisions?limit=2").expect(200);
    expect(first.body.items.map((r: { contentRevision: number }) => r.contentRevision)).toEqual([4, 3]);
    expect(first.body.nextBefore).toBe(3);
    const second = await request(app.getHttpServer()).get(prefix + "/revisions?limit=2&before=3").expect(200);
    expect(second.body.items.map((r: { contentRevision: number }) => r.contentRevision)).toEqual([2, 1]);
    expect(second.body.nextBefore).toBeNull();
    expect(second.body.total).toBe(4);
  });

  it("可撤销批准，重复撤销不新增审计，也不能用旧请求重新批准", async () => {
    const created = await createComplete();
    const prefix = `/api/manager/requirements/${created.body.id}`;
    const original = { expectedRevision: created.body.revision, expectedContentRevision: 1 };
    const approved = await request(app.getHttpServer()).post(prefix + "/approve-revision")
      .set("x-manager-approval-token", approvalToken).send(original).expect(200);
    const revoke = { expectedRevision: approved.body.revision, expectedContentRevision: 1, reason: "重新确认范围" };
    const revoked = await request(app.getHttpServer()).post(prefix + "/revoke-approval")
      .set("x-manager-approval-token", approvalToken).send(revoke).expect(200);
    expect(revoked.body).toMatchObject({ approvalStatus: "unapproved", approvedContentRevision: null });
    const repeated = await request(app.getHttpServer()).post(prefix + "/revoke-approval")
      .set("x-manager-approval-token", approvalToken).send(revoke).expect(200);
    expect(repeated.body.revision).toBe(revoked.body.revision);
    await request(app.getHttpServer()).post(prefix + "/approve-revision")
      .set("x-manager-approval-token", approvalToken).send(original).expect(409);
    const audit = await request(app.getHttpServer()).get(prefix + "/approvals").expect(200);
    expect(audit.body.items.map((r: { decision: string }) => r.decision)).toEqual(["revoked", "approved"]);
  });

  it("审批必须验证凭证，并绑定用户看到的内容修订", async () => {
    const created = await createComplete();
    const url = `/api/manager/requirements/${created.body.id}/approve-revision`;
    const input = { expectedRevision: created.body.revision, expectedContentRevision: created.body.contentRevision };
    await request(app.getHttpServer()).post(url).send(input).expect(403);
    const approved = await request(app.getHttpServer()).post(url).set("x-manager-approval-token", approvalToken).send(input).expect(200);
    expect(approved.body).toMatchObject({ contentRevision: 1, approvedContentRevision: 1, approvalStatus: "approved",
      status: "waiting", automationPolicy: "manual" });
    const audit = await request(app.getHttpServer()).get(`/api/manager/requirements/${created.body.id}/approvals`).expect(200);
    expect(audit.body.items).toHaveLength(1);
    expect(audit.body.items[0]).toMatchObject({ contentRevision: 1, decision: "approved", actorId: "test-owner", authMethod: "owner-token" });
    expect(JSON.stringify(audit.body)).not.toContain(approvalToken);
  });

  it("范围和验收条件进入内容修订，状态与PR等操作字段不产生额外内容修订", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements")
      .send({ title: "完整实施内容", description: "需求目标" }).expect(201);
    const content = { project: "manager", scope: "只调整需求管理", risk: "low",
      acceptanceCriteria: ["保留旧数据"], dependencyRefs: ["P01"] };
    const edited = await request(app.getHttpServer()).patch(`/api/manager/requirements/${created.body.id}`)
      .send({ ...content, expectedRevision: created.body.revision }).expect(200);
    const metadata = await request(app.getHttpServer()).patch(`/api/manager/requirements/${created.body.id}`)
      .send({ status: "designing", priority: "P1", branch: "feat-manager-example", expectedRevision: edited.body.revision }).expect(200);
    expect(metadata.body.revision).toBe(3);
    expect(metadata.body.contentRevision).toBe(2);
    const history = await request(app.getHttpServer()).get(`/api/manager/requirements/${created.body.id}/revisions`).expect(200);
    expect(history.body.total).toBe(2);
    expect(history.body.items[0].content).toMatchObject(content);
    expect(history.body.items[0].changedFields).toEqual(expect.arrayContaining(["scope", "risk", "acceptanceCriteria"]));
  });

  it("编辑需求后能读取完整新旧内容，旧修订不会被覆盖", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements")
      .send({ title: "内容历史", description: "第一版内容" }).expect(201);
    const changed = await request(app.getHttpServer()).patch(`/api/manager/requirements/${created.body.id}`)
      .send({ description: "第二版内容", expectedRevision: created.body.revision }).expect(200);
    const history = await request(app.getHttpServer()).get(`/api/manager/requirements/${created.body.id}/revisions`).expect(200);
    expect(changed.body.contentRevision).toBe(2);
    expect(history.body.items.map((r: { contentRevision: number; content: { description: string } }) =>
      [r.contentRevision, r.content.description])).toEqual([[2, "第二版内容"], [1, "第一版内容"]]);
    expect(history.body.total).toBe(2);
  });
});
