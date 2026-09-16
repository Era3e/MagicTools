// @database-integration: required by test:db
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { AppModule } from "./app.module";
import { migrate, pool } from "./db";

let app: INestApplication;
const ownerToken = randomBytes(32).toString("hex");
const executorToken = randomBytes(32).toString("hex");
const previousOwnerToken = process.env.MANAGER_APPROVAL_TOKEN;
const previousExecutorToken = process.env.MANAGER_EXECUTOR_TOKEN;

beforeAll(async () => {
  process.env.MANAGER_APPROVAL_TOKEN = ownerToken;
  process.env.MANAGER_EXECUTOR_TOKEN = executorToken;
  await migrate();
  await pool.query("TRUNCATE execution_runs, execution_jobs");
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/manager");
  await app.init();
}, 20000);

afterAll(async () => {
  if (app) await app.close();
  await pool.end();
  if (previousOwnerToken === undefined) delete process.env.MANAGER_APPROVAL_TOKEN; else process.env.MANAGER_APPROVAL_TOKEN = previousOwnerToken;
  if (previousExecutorToken === undefined) delete process.env.MANAGER_EXECUTOR_TOKEN; else process.env.MANAGER_EXECUTOR_TOKEN = previousExecutorToken;
});

function contract(maxAttempts = 2) {
  return {
    repository: "https://github.com/era3e/magictools",
    allowedPaths: ["apps/manager/server/src"],
    acceptanceCommands: [["pnpm", "test:manager:integration"]],
    maxDurationMinutes: 5,
    maxAttempts,
    budgetCurrency: "CNY",
    budgetAmountCents: 5000,
  };
}

async function createReadyRequirement(title: string, maxAttempts = 2) {
  const created = await request(app.getHttpServer()).post("/api/manager/requirements").send({
    title,
    description: "描述自动执行目标",
    project: "manager",
    scope: "仅任务队列可靠性",
    risk: "low",
    acceptanceCriteria: ["任务租约可靠"],
    executionContract: contract(maxAttempts),
  }).expect(201);
  const todo = await request(app.getHttpServer()).patch(`/api/manager/requirements/${created.body.id}`)
    .send({ status: "todo", expectedRevision: created.body.revision }).expect(200);
  await request(app.getHttpServer()).post(`/api/manager/requirements/${created.body.id}/approve-revision`)
    .set("x-manager-approval-token", ownerToken)
    .send({ expectedRevision: todo.body.revision, expectedContentRevision: todo.body.contentRevision }).expect(200);
  return created.body.id as string;
}

async function queue(requirementId: string) {
  return request(app.getHttpServer()).post(`/api/manager/requirements/${requirementId}/execution-jobs`)
    .set("x-manager-approval-token", ownerToken).expect(201);
}

async function claim(executorId = "executor-a") {
  return request(app.getHttpServer()).post("/api/manager/execution-jobs/claim")
    .set("x-manager-executor-token", executorToken)
    .send({ executorId, leaseMilliseconds: 30000 }).expect(200);
}

function successfulResult(jobId: string, runId: string, evidence: string) {
  return {
    status: "succeeded" as const,
    jobId,
    runId,
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    changedPaths: ["apps/manager/server/src/execution-jobs.repo.ts"],
    acceptance: [{ status: "success" as const, exitCode: 0, durationMs: 100 }],
    prNumber: 96,
    prUrl: "https://github.com/Era3e/MagicTools/pull/96",
    branch: "auto/req-test/r1",
    evidence: { schema: "magictools-executor-evidence/1", path: "evidence/evidence.json", sha256: "c".repeat(64), marker: evidence },
  };
}

describe("自动执行任务租约", () => {
  it("未批准需求不能排队，合格需求排队后策略生效", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements").send({
      title: "未批准自动执行需求",
      description: "描述用户目标",
      project: "manager",
      scope: "仅需求服务",
      risk: "low",
      acceptanceCriteria: ["未批准不能执行"],
      executionContract: contract(),
    }).expect(201);
    const blocked = await request(app.getHttpServer()).post(`/api/manager/requirements/${created.body.id}/execution-jobs`)
      .set("x-manager-approval-token", ownerToken).expect(400);
    expect(blocked.body.blockers).toEqual(expect.arrayContaining(["当前内容未批准", "需求状态不是待开发"]));

    const requirementId = await createReadyRequirement("合格自动执行需求");
    const job = await queue(requirementId);
    expect(job.body).toMatchObject({ requirementId, status: "queued", attempts: 0, maxAttempts: 2 });
    expect(job.body.contract).toEqual(contract());
    expect(job.body.runs).toEqual([]);
    const eligibility = await request(app.getHttpServer()).get(`/api/manager/requirements/${requirementId}/execution-eligibility`).expect(200);
    expect(eligibility.body).toMatchObject({ eligible: true, automationPolicy: "owner-token" });
    const claimed = (await claim("executor-first")).body;
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${claimed.jobId}/complete`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimed.runToken)
      .send({ result: successfulResult(claimed.jobId, claimed.runId, "first-job-closed") }).expect(200);
  });

  it("同修订只能排队一次且并发领取只创建一个活动run", async () => {
    const requirementId = await createReadyRequirement("唯一活动执行需求");
    const first = await queue(requirementId);
    const duplicated = await request(app.getHttpServer()).post(`/api/manager/requirements/${requirementId}/execution-jobs`)
      .set("x-manager-approval-token", ownerToken).expect(409);
    expect(duplicated.body.message).toBe("该需求修订已有活动执行任务");

    const claims = await Promise.all([claim("executor-a"), claim("executor-b")]);
    const claimed = claims.filter((response) => response.body.jobId);
    expect(claimed).toHaveLength(1);
    const claimedBody = claimed[0].body;
    expect(claimedBody.jobId).toBe(first.body.id);
    expect(claimedBody.attempt).toBe(1);
    expect(claimedBody.runToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(claimedBody.requirement).toMatchObject({
      title: "唯一活动执行需求",
      description: "描述自动执行目标",
      scope: "仅任务队列可靠性",
      acceptanceCriteria: ["任务租约可靠"],
    });
    const detail = await request(app.getHttpServer()).get(`/api/manager/execution-jobs/${first.body.id}`).expect(200);
    expect(detail.body).toMatchObject({ status: "running", attempts: 1 });
    expect(detail.body.runs).toHaveLength(1);
    expect(detail.body.runs[0]).not.toHaveProperty("runTokenHash");
    expect(JSON.stringify(detail.body)).not.toContain(claimedBody.runToken);

    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${first.body.id}/complete`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimedBody.runToken)
      .send({ result: successfulResult(claimedBody.jobId, claimedBody.runId, "stub-not-run") }).expect(200);
  });

  it("过期租约不能心跳或成功回写，恢复后按上限重试并终结", async () => {
    const requirementId = await createReadyRequirement("过期租约恢复需求");
    const job = await queue(requirementId);
    const claimed = (await claim("executor-crashed")).body;
    await pool.query("UPDATE execution_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [claimed.runId]);

    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.body.id}/heartbeat`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimed.runToken)
      .send({ extensionMilliseconds: 30000 }).expect(409);
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.body.id}/complete`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimed.runToken)
      .send({ result: { forged: true } }).expect(400);

    const recovered = await request(app.getHttpServer()).post("/api/manager/execution-jobs/recover")
      .set("x-manager-executor-token", executorToken).expect(200);
    expect(recovered.body).toContainEqual({ jobId: job.body.id, runId: claimed.runId, outcome: "retry" });
    const afterRecovery = await request(app.getHttpServer()).get(`/api/manager/execution-jobs/${job.body.id}`).expect(200);
    expect(afterRecovery.body).toMatchObject({ status: "retry", attempts: 1 });
    expect(afterRecovery.body.runs[0]).toMatchObject({ status: "expired", error: "lease expired" });

    const second = (await claim("executor-retry")).body;
    expect(second).toMatchObject({ jobId: job.body.id, attempt: 2 });
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.body.id}/fail`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", second.runToken)
      .send({ error: "acceptance failed" }).expect(200);
    const failed = await request(app.getHttpServer()).get(`/api/manager/execution-jobs/${job.body.id}`).expect(200);
    expect(failed.body).toMatchObject({ status: "failed", attempts: 2 });
    const exhausted = await claim("executor-third");
    expect(exhausted.body).toEqual({ claimed: false });
  });

  it("内容修订在领取前发生变化时旧任务被隔离", async () => {
    const requirementId = await createReadyRequirement("修订变化隔离需求");
    const job = await queue(requirementId);
    await request(app.getHttpServer()).patch(`/api/manager/requirements/${requirementId}`)
      .send({ description: "内容已经变化" }).expect(200);
    const claimed = await claim("executor-stale");
    expect(claimed.body).toEqual({ claimed: false });
    const detail = await request(app.getHttpServer()).get(`/api/manager/execution-jobs/${job.body.id}`).expect(200);
    expect(detail.body).toMatchObject({ status: "failed", attempts: 0 });
    expect(detail.body.cancellationReason).toBe("requirement state changed before claim");
  });

  it("owner可以取消运行中的任务并使run进入cancelled", async () => {
    const requirementId = await createReadyRequirement("主动取消执行需求", 3);
    const job = await queue(requirementId);
    const claimed = (await claim("executor-cancel")).body;
    const cancelled = await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.body.id}/cancel`)
      .set("x-manager-approval-token", ownerToken)
      .send({ reason: "需求需要修改" }).expect(200);
    expect(cancelled.body).toMatchObject({ status: "cancelled", cancellationReason: "需求需要修改" });
    expect(cancelled.body.runs[0]).toMatchObject({ id: claimed.runId, status: "cancelled" });
  });

  it("执行器凭证缺失或错误时拒绝领取", async () => {
    await request(app.getHttpServer()).post("/api/manager/execution-jobs/claim")
      .send({ executorId: "executor-unauthorized", leaseMilliseconds: 30000 }).expect(403);
    await request(app.getHttpServer()).post("/api/manager/execution-jobs/claim")
      .set("x-manager-executor-token", "wrong-token")
      .send({ executorId: "executor-unauthorized", leaseMilliseconds: 30000 }).expect(403);
  });
});
