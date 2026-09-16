// @database-integration: required by test:db
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { AppModule } from "./app.module";
import { ExecutionNotificationsService } from "./execution-notifications.service";
import { migrate, pool } from "./db";

let app: INestApplication;
const ownerToken = randomBytes(32).toString("hex");
const executorToken = randomBytes(32).toString("hex");
const mergeToken = randomBytes(32).toString("hex");
const previousOwnerToken = process.env.MANAGER_APPROVAL_TOKEN;
const previousExecutorToken = process.env.MANAGER_EXECUTOR_TOKEN;
const previousMergeToken = process.env.MANAGER_MERGE_TOKEN;

beforeAll(async () => {
  process.env.MANAGER_APPROVAL_TOKEN = ownerToken;
  process.env.MANAGER_EXECUTOR_TOKEN = executorToken;
  process.env.MANAGER_MERGE_TOKEN = mergeToken;
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
  if (previousMergeToken === undefined) delete process.env.MANAGER_MERGE_TOKEN; else process.env.MANAGER_MERGE_TOKEN = previousMergeToken;
});

function contract(maxAttempts = 1) {
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

async function createReadyRequirement(title: string, maxAttempts = 1) {
  const created = await request(app.getHttpServer()).post("/api/manager/requirements").send({
    title,
    description: "验证执行进度通知",
    project: "manager",
    scope: "执行进度与通知",
    risk: "low",
    acceptanceCriteria: ["执行结果可追踪"],
    executionContract: contract(maxAttempts),
  }).expect(201);
  const todo = await request(app.getHttpServer()).patch(`/api/manager/requirements/${created.body.id}`)
    .send({ status: "todo", expectedRevision: created.body.revision }).expect(200);
  await request(app.getHttpServer()).post(`/api/manager/requirements/${created.body.id}/approve-revision`)
    .set("x-manager-approval-token", ownerToken)
    .send({ expectedRevision: todo.body.revision, expectedContentRevision: todo.body.contentRevision, reason: "ready" }).expect(200);
  return created.body.id as string;
}

async function queue(requirementId: string) {
  return (await request(app.getHttpServer()).post(`/api/manager/requirements/${requirementId}/execution-jobs`)
    .set("x-manager-approval-token", ownerToken).expect(201)).body;
}

async function claim(executorId: string) {
  return (await request(app.getHttpServer()).post("/api/manager/execution-jobs/claim")
    .set("x-manager-executor-token", executorToken)
    .send({ executorId, leaseMilliseconds: 30000 }).expect(200)).body;
}

function successResult(jobId: string, runId: string) {
  return {
    status: "succeeded",
    jobId,
    runId,
    candidateSha: "b".repeat(40),
    baseSha: "a".repeat(40),
    changedPaths: ["apps/manager/server/src/execution-jobs.repo.ts"],
    acceptance: [{ status: "success", exitCode: 0, durationMs: 1000 }],
    prNumber: 97,
    prUrl: "https://github.com/Era3e/MagicTools/pull/97",
    branch: "auto/req-demo/r1",
    evidence: { schema: "magictools-executor-evidence/1", path: "evidence/evidence.json", sha256: "c".repeat(64) },
  };
}

describe("执行进度、待验收与通知", () => {
  it("执行成功推进待验收，并同事务写入稳定通知", async () => {
    const requirementId = await createReadyRequirement("执行成功通知");
    const job = await queue(requirementId);
    const claimed = await claim("executor-success");
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.id}/complete`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimed.runToken)
      .send({ result: { ...successResult(job.id, claimed.runId), acceptance: [{ status: "failed", exitCode: 1, durationMs: 10 }] } }).expect(400);
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.id}/complete`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimed.runToken)
      .send({ result: successResult(job.id, randomUUID()) }).expect(409);
    const completed = await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.id}/complete`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimed.runToken)
      .send({ result: successResult(job.id, claimed.runId) }).expect(200);
    expect(completed.body).toMatchObject({ status: "succeeded" });

    const detail = await request(app.getHttpServer()).get(`/api/manager/requirements/${requirementId}`).expect(200);
    expect(detail.body).toMatchObject({
      status: "accepting",
      branch: "auto/req-demo/r1",
      prUrl: "https://github.com/Era3e/MagicTools/pull/97",
      prState: "open",
      deploymentState: "not-started",
    });
    expect(detail.body.timeline.at(-1)).toMatchObject({ from: "todo", to: "accepting", note: "自动执行完成，等待人工验收" });

    const notifications = await request(app.getHttpServer()).get("/api/manager/execution-notifications").expect(200);
    const notification = notifications.body.items.find((item: { id: string }) => item.id === `execution:${claimed.runId}:succeeded`);
    expect(notification).toMatchObject({ status: "pending", event: "execution.notification" });
    expect(notification.payload).toMatchObject({ kind: "succeeded", requirementId, candidateSha: "b".repeat(40) });
  });

  it("通知按outbox租约投递，重复调度不会重复外发", async () => {
    await pool.query("DELETE FROM outbox WHERE event='execution.notification'");
    const requirementId = await createReadyRequirement("通知去重");
    const job = await queue(requirementId);
    const claimed = await claim("executor-dispatch");
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.id}/complete`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimed.runToken)
      .send({ result: successResult(job.id, claimed.runId) }).expect(200);

    const previousWebhookUrl = process.env.MANAGER_NOTIFICATION_WEBHOOK_URL;
    const previousWebhookToken = process.env.MANAGER_NOTIFICATION_WEBHOOK_TOKEN;
    process.env.MANAGER_NOTIFICATION_WEBHOOK_URL = "https://example.com/notify";
    process.env.MANAGER_NOTIFICATION_WEBHOOK_TOKEN = "test-token";
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    const service = app.get(ExecutionNotificationsService);
    const first = await service.dispatchOnce({ fetchImpl });
    const second = await service.dispatchOnce({ fetchImpl });
    process.env.MANAGER_NOTIFICATION_WEBHOOK_URL = previousWebhookUrl;
    process.env.MANAGER_NOTIFICATION_WEBHOOK_TOKEN = previousWebhookToken;
    expect(first).toEqual({ configured: true, dispatched: 1 });
    expect(second).toEqual({ configured: true, dispatched: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(fetchImpl).mock.calls[0][1]?.body as string)).toMatchObject({ eventId: `execution:${claimed.runId}:succeeded` });
  });

  it("终态失败写入失败原因通知，重试中间态不打扰", async () => {
    const requirementId = await createReadyRequirement("失败通知", 2);
    const job = await queue(requirementId);
    const first = await claim("executor-fail-first");
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.id}/fail`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", first.runToken)
      .send({ error: "first acceptance failed" }).expect(200);
    let notifications = await request(app.getHttpServer()).get("/api/manager/execution-notifications").expect(200);
    expect(notifications.body.items.some((item: { id: string }) => item.id === `execution:${first.runId}:failed`)).toBe(false);

    const second = await claim("executor-fail-second");
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.id}/fail`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", second.runToken)
      .send({ error: "final acceptance failed" }).expect(200);
    notifications = await request(app.getHttpServer()).get("/api/manager/execution-notifications").expect(200);
    const notification = notifications.body.items.find((item: { id: string }) => item.id === `execution:${second.runId}:failed`);
    expect(notification).toMatchObject({ status: "pending" });
    expect(notification.payload).toMatchObject({ kind: "failed", error: "final acceptance failed", attempt: 2, maxAttempts: 2 });
  });

  it("部署状态独立记录，成功部署不能替代人工验收", async () => {
    const requirementId = await createReadyRequirement("部署状态独立");
    const job = await queue(requirementId);
    const claimed = await claim("executor-deploy");
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.id}/complete`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimed.runToken)
      .send({ result: successResult(job.id, claimed.runId) }).expect(200);
    const current = await request(app.getHttpServer()).get(`/api/manager/requirements/${requirementId}`).expect(200);

    await request(app.getHttpServer()).post(`/api/manager/requirements/${requirementId}/deployment-status`)
      .set("x-manager-approval-token", ownerToken)
      .send({ state: "succeeded", releaseId: "release-1", expectedRevision: current.body.revision }).expect(400, /PR 合并前/);

    await pool.query("UPDATE requirements SET pr_state='merged' WHERE id=$1", [requirementId]);
    const updated = await request(app.getHttpServer()).post(`/api/manager/requirements/${requirementId}/deployment-status`)
      .set("x-manager-approval-token", ownerToken)
      .send({ state: "succeeded", releaseId: "release-1", url: "https://example.com/run/1", expectedRevision: current.body.revision }).expect(200);
    expect(updated.body).toMatchObject({ deploymentState: "succeeded", status: "accepting", deploymentRef: "release-1" });
  });

  it("条件合并只授权当前批准修订下的成功候选", async () => {
    const requirementId = await createReadyRequirement("条件合并授权");
    const job = await queue(requirementId);
    const claimed = await claim("executor-merge-auth");
    await request(app.getHttpServer()).post(`/api/manager/execution-jobs/${job.id}/complete`)
      .set("x-manager-executor-token", executorToken)
      .set("x-manager-run-token", claimed.runToken)
      .send({ result: successResult(job.id, claimed.runId) }).expect(200);

    await request(app.getHttpServer()).get(`/api/manager/execution-jobs/${job.id}/merge-authorization`)
      .set("x-manager-merge-token", "wrong-token").expect(403);

    const authorization = await request(app.getHttpServer()).get(`/api/manager/execution-jobs/${job.id}/merge-authorization`)
      .set("x-manager-merge-token", mergeToken).expect(200);
    expect(authorization.body).toMatchObject({
      eligible: true,
      blockers: [],
      candidate: {
        jobId: job.id,
        requirementId,
        contentRevision: 1,
        repository: "https://github.com/era3e/magictools",
        allowedPaths: ["apps/manager/server/src"],
        candidateSha: "b".repeat(40),
        baseSha: "a".repeat(40),
        changedPaths: ["apps/manager/server/src/execution-jobs.repo.ts"],
        prNumber: 97,
      },
    });

    const candidates = await request(app.getHttpServer()).get("/api/manager/execution-jobs/merge-candidates")
      .set("x-manager-merge-token", mergeToken).expect(200);
    expect(candidates.body.some((item: { candidate?: { jobId?: string } }) => item.candidate?.jobId === job.id)).toBe(true);

    const current = await request(app.getHttpServer()).get(`/api/manager/requirements/${requirementId}`).expect(200);
    await request(app.getHttpServer()).patch(`/api/manager/requirements/${requirementId}`)
      .send({ scope: "条件合并后内容变化", expectedRevision: current.body.revision }).expect(200);
    const stale = await request(app.getHttpServer()).get(`/api/manager/execution-jobs/${job.id}/merge-authorization`)
      .set("x-manager-merge-token", mergeToken).expect(200);
    expect(stale.body).toMatchObject({ eligible: false });
    expect(stale.body.blockers).toEqual(expect.arrayContaining(["执行契约对应内容修订已变化"]));
  });
});
