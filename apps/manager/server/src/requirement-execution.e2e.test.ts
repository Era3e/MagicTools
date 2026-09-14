// @database-integration: required by test:db
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { migrate, pool } from "./db";
import { randomBytes, randomUUID } from "node:crypto";

let app: INestApplication;
const approvalToken = randomBytes(32).toString("hex");
const previousToken = process.env.MANAGER_APPROVAL_TOKEN;
const previousActor = process.env.MANAGER_APPROVAL_ACTOR;

beforeAll(async () => {
  process.env.MANAGER_APPROVAL_TOKEN = approvalToken;
  process.env.MANAGER_APPROVAL_ACTOR = "execution-test-owner";
  await migrate();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/manager");
  await app.init();
}, 20000);

afterAll(async () => {
  if (app) await app.close();
  await pool.end();
  if (previousToken === undefined) delete process.env.MANAGER_APPROVAL_TOKEN; else process.env.MANAGER_APPROVAL_TOKEN = previousToken;
  if (previousActor === undefined) delete process.env.MANAGER_APPROVAL_ACTOR; else process.env.MANAGER_APPROVAL_ACTOR = previousActor;
});

function executionContract() {
  return {
    repository: "https://github.com/era3e/magictools",
    allowedPaths: ["apps/manager/server/src"],
    acceptanceCommands: [["pnpm", "test:manager:integration"]],
    maxDurationMinutes: 60,
    maxAttempts: 2,
    budgetCurrency: "CNY",
    budgetAmountCents: 5000,
  };
}

async function importPlannedDependency(candidateId: string) {
  const commit = "7b6fa7bb71be01245cbbe8bed849373a4c1897c2";
  const repository = "https://github.com/Era3e/MagicTools";
  const path = "apps/manager/server/src/requirement.repo.ts";
  const bundle = {
    schema_version: "magictools-requirement-candidates/0.1",
    repository,
    snapshot_commit: commit,
    records: [{
      candidate_id: candidateId, record_kind: "planned", project: "manager",
      title: "前置需求-" + candidateId, description: "先完成的前置能力",
      source: "audit_proposal", source_commit: commit, priority: "P2",
      review_status: "unreviewed", automation_eligible: false,
      evidence: [{ path, line: 1, commit, url: `${repository}/blob/${commit}/${path}#L1` }],
      acceptance_criteria: ["前置能力可用"], depends_on: [],
    }],
  };
  const preview = await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(bundle).expect(201);
  const confirmed = await request(app.getHttpServer()).post(`/api/manager/import-batches/${preview.body.id}/confirm`)
    .send({ expectedRevision: preview.body.revision, candidateIds: [candidateId] }).expect(201);
  return confirmed.body.targets[0].id as string;
}

describe("需求执行门禁", () => {
  it("未批准且缺少执行契约时返回阻塞原因", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements").send({
      title: "执行门禁需求",
      description: "描述用户目标",
      project: "manager",
      scope: "仅需求服务",
      risk: "low",
      acceptanceCriteria: ["门禁原因可查询"],
    }).expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/manager/requirements/${created.body.id}/execution-eligibility`)
      .expect(200);

    expect(response.body).toMatchObject({
      requirementId: created.body.id,
      contractReady: false,
      dependenciesReady: true,
      automationPolicy: "manual",
    });
    expect(response.body.blockers).toEqual(expect.arrayContaining(["当前内容未批准", "缺少执行契约"]));
    expect(response.body.dependencies).toEqual([]);
  });

  it("执行契约进入内容修订，修改预算使旧批准失效", async () => {
    const contract = executionContract();
    const created = await request(app.getHttpServer()).post("/api/manager/requirements").send({
      title: "带执行契约的需求",
      description: "描述用户目标",
      project: "manager",
      scope: "仅需求服务",
      risk: "low",
      acceptanceCriteria: ["执行契约绑定批准版本"],
      executionContract: contract,
    }).expect(201);
    expect(created.body.executionContract).toEqual(contract);

    const approved = await request(app.getHttpServer())
      .post(`/api/manager/requirements/${created.body.id}/approve-revision`)
      .set("x-manager-approval-token", approvalToken)
      .send({ expectedRevision: created.body.revision, expectedContentRevision: created.body.contentRevision })
      .expect(200);
    expect(approved.body.approvalStatus).toBe("approved");

    const edited = await request(app.getHttpServer())
      .patch(`/api/manager/requirements/${created.body.id}`)
      .send({ executionContract: { ...contract, budgetAmountCents: 6000 }, expectedRevision: approved.body.revision })
      .expect(200);
    expect(edited.body.executionContract).toMatchObject({ budgetAmountCents: 6000 });
    expect(edited.body.contentRevision).toBe(created.body.contentRevision + 1);
    expect(edited.body.approvalStatus).toBe("outdated");
  });

  it("已完成导入依赖视为就绪并返回定位信息", async () => {
    const dependencyRef = "DEP-" + randomUUID();
    const dependencyId = await importPlannedDependency(dependencyRef);
    let revision = 1;
    for (const status of ["designing", "todo", "developing", "testing", "accepting", "done"]) {
      const updated = await request(app.getHttpServer()).patch(`/api/manager/requirements/${dependencyId}`)
        .send({ status, expectedRevision: revision }).expect(200);
      revision = updated.body.revision;
    }

    const created = await request(app.getHttpServer()).post("/api/manager/requirements").send({
      title: "依赖已完成的需求",
      description: "描述用户目标",
      project: "manager",
      scope: "仅需求服务",
      risk: "low",
      acceptanceCriteria: ["依赖状态可判定"],
      dependencyRefs: [dependencyRef],
      executionContract: executionContract(),
    }).expect(201);
    await request(app.getHttpServer())
      .post(`/api/manager/requirements/${created.body.id}/approve-revision`)
      .set("x-manager-approval-token", approvalToken)
      .send({ expectedRevision: created.body.revision, expectedContentRevision: created.body.contentRevision })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/manager/requirements/${created.body.id}/execution-eligibility`)
      .expect(200);
    expect(response.body).toMatchObject({
      contractReady: true,
      dependenciesReady: true,
      automationPolicy: "manual",
    });
    expect(response.body.dependencies).toEqual([{
      ref: dependencyRef, state: "done", requirementId: dependencyId, capabilityId: null,
    }]);
  });

  it("缺失依赖不能进入自动执行并返回总门禁结果", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements").send({
      title: "依赖缺失的需求",
      description: "描述用户目标",
      project: "manager",
      scope: "仅需求服务",
      risk: "low",
      acceptanceCriteria: ["缺失依赖被阻塞"],
      dependencyRefs: ["DEP-MISSING"],
      executionContract: executionContract(),
    }).expect(201);
    await request(app.getHttpServer())
      .post(`/api/manager/requirements/${created.body.id}/approve-revision`)
      .set("x-manager-approval-token", approvalToken)
      .send({ expectedRevision: created.body.revision, expectedContentRevision: created.body.contentRevision })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/manager/requirements/${created.body.id}/execution-eligibility`)
      .expect(200);
    expect(response.body).toMatchObject({ eligible: false, contractReady: true, dependenciesReady: false });
    expect(response.body.dependencies).toEqual([{ ref: "DEP-MISSING", state: "missing", requirementId: null, capabilityId: null }]);
    expect(response.body.blockers).toEqual(expect.arrayContaining(["依赖未就绪：DEP-MISSING"]));
  });

  it("拒绝路径穿越和未受控验收命令", async () => {
    const base = {
      title: "非法执行契约", description: "描述用户目标", project: "manager", scope: "仅需求服务",
      risk: "low", acceptanceCriteria: ["非法契约被拒绝"],
    };
    await request(app.getHttpServer()).post("/api/manager/requirements").send({
      ...base, executionContract: { ...executionContract(), allowedPaths: ["../outside"] },
    }).expect(400);
    await request(app.getHttpServer()).post("/api/manager/requirements").send({
      ...base, executionContract: { ...executionContract(), acceptanceCommands: [["powershell", "-Command", "dir"]] },
    }).expect(400);
    await request(app.getHttpServer()).post("/api/manager/requirements").send({
      ...base, executionContract: { ...executionContract(), acceptanceCommands: [["node", "-e", "process.exit(1)"]] },
    }).expect(400);
    await request(app.getHttpServer()).post("/api/manager/requirements").send({
      ...base, executionContract: { ...executionContract(), acceptanceCommands: [["pnpm", "--dir", "../outside", "test"]] },
    }).expect(400);
  });

  it("执行仓库大小写和git后缀归一化为候选导入身份", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements").send({
      title: "仓库归一化需求", description: "描述用户目标", project: "manager", scope: "仅需求服务",
      risk: "low", acceptanceCriteria: ["仓库身份一致"],
      executionContract: { ...executionContract(), repository: "https://GitHub.com/Era3e/MagicTools.git/" },
    }).expect(201);
    expect(created.body.executionContract.repository).toBe("https://github.com/era3e/magictools");
  });
});
