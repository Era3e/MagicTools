// @database-integration: required by test:db
import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

let app: INestApplication;
const commit = "7b6fa7bb71be01245cbbe8bed849373a4c1897c2";

function bundle() {
  const marker = randomUUID();
  const evidence = [{ path: "apps/manager/server/src/requirement.service.ts", line: 1, commit,
    url: `https://github.com/Era3e/MagicTools/blob/${commit}/apps/manager/server/src/requirement.service.ts#L1` }];
  return { schema_version: "magictools-requirement-candidates/0.1", repository: "https://github.com/Era3e/MagicTools", snapshot_commit: commit,
    records: [
      { candidate_id: `BASE-${marker}`, record_kind: "baseline", project: "manager", title: `已有能力-${marker}`,
        description: "源码观察，未核验验收和部署", source: "repo_reverse", source_commit: commit,
        review_status: "unreviewed", automation_eligible: false, evidence, verification_gaps: ["核验产品规则"] },
      { candidate_id: `PLAN-${marker}`, record_kind: "planned", project: "manager", title: `规划需求-${marker}`,
        description: "需要进一步实现", source: "audit_proposal", source_commit: commit, priority: "P1",
        review_status: "unreviewed", automation_eligible: false, evidence, acceptance_criteria: ["验证通过"], depends_on: [] },
    ] };
}

beforeAll(async () => {
  await ensureDatabase();
  await migrate();
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix("api/manager");
  await app.init();
}, 20000);

afterAll(async () => {
  if (app) await app.close();
  await pool.end();
});

describe("需求候选导入", () => {
  it("GitHub 仓库和链接的大小写变化不形成新批次或重复目标", async () => {
    const input = bundle();
    const first = await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(input).expect(201);
    await request(app.getHttpServer()).post(`/api/manager/import-batches/${first.body.id}/confirm`)
      .send({ expectedRevision: 1, candidateIds: input.records.map((r) => r.candidate_id) }).expect(201);
    const lower = structuredClone(input);
    lower.repository = lower.repository.toLowerCase();
    for (const row of lower.records) row.evidence = row.evidence.map((e) => ({ ...e, url: e.url.replace("Era3e/MagicTools", "era3e/magictools") }));
    const next = await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(lower).expect(201);
    expect(next.body.id).toBe(first.body.id);
    expect(next.body.counts.new).toBe(0);
  });

  it("部分确认后可以为未选候选生成新批次，不改变原确认回执", async () => {
    const input = bundle();
    const preview = await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(input).expect(201);
    const first = await request(app.getHttpServer()).post(`/api/manager/import-batches/${preview.body.id}/confirm`)
      .send({ expectedRevision: 1, candidateIds: [input.records[0].candidate_id] }).expect(201);
    const remaining = await request(app.getHttpServer()).post(`/api/manager/import-batches/${preview.body.id}/remaining-preview`).expect(201);
    expect(remaining.body.id).not.toBe(preview.body.id);
    expect(remaining.body.candidates.map((r: { candidate_id: string }) => r.candidate_id)).toEqual([input.records[1].candidate_id]);
    await request(app.getHttpServer()).post(`/api/manager/import-batches/${remaining.body.id}/confirm`)
      .send({ expectedRevision: 1, candidateIds: [input.records[1].candidate_id] }).expect(201);
    const repeated = await request(app.getHttpServer()).post(`/api/manager/import-batches/${preview.body.id}/confirm`)
      .send({ expectedRevision: 1, candidateIds: [input.records[0].candidate_id] }).expect(201);
    expect(repeated.body).toEqual(first.body);
  });

  it("重复预览和确认返回相同批次与记录，保留之后的人工修改", async () => {
    const input = bundle();
    const first = await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(input).expect(201);
    const second = await request(app.getHttpServer()).post("/api/manager/import-batches/preview")
      .send({ ...input, records: [...input.records].reverse() }).expect(201);
    expect(second.body.id).toBe(first.body.id);
    const body = { expectedRevision: 1, candidateIds: input.records.map((r) => r.candidate_id) };
    const confirmed = await request(app.getHttpServer()).post(`/api/manager/import-batches/${first.body.id}/confirm`).send(body).expect(201);
    const target = confirmed.body.targets.find((r: { kind: string }) => r.kind === "planned");
    await request(app.getHttpServer()).patch("/api/manager/requirements/" + target.id)
      .send({ description: "人工补充，不能被导入覆盖", expectedRevision: 1 }).expect(200);
    const repeated = await request(app.getHttpServer()).post(`/api/manager/import-batches/${first.body.id}/confirm`).send(body).expect(201);
    expect(repeated.body).toEqual(confirmed.body);
    const saved = await request(app.getHttpServer()).get("/api/manager/requirements/" + target.id).expect(200);
    expect(saved.body.description).toBe("人工补充，不能被导入覆盖");
  });

  it("交叠批次并发确认只创建一组共享目标", async () => {
    const input = bundle();
    const extra = { ...input.records[1], candidate_id: "EXTRA-" + randomUUID(), title: "追加候选-" + randomUUID() };
    const other = { ...input, records: [...input.records, extra] };
    const previews = await Promise.all([input, other].map((payload) =>
      request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(payload).expect(201)));
    const confirmed = await Promise.all(previews.map((p, i) =>
      request(app.getHttpServer()).post(`/api/manager/import-batches/${p.body.id}/confirm`)
        .send({ expectedRevision: 1, candidateIds: [input, other][i].records.map((r) => r.candidate_id) }).expect(201)));
    for (const row of input.records) {
      expect(confirmed[0].body.targets.find((t: { candidateId: string }) => t.candidateId === row.candidate_id).id)
        .toBe(confirmed[1].body.targets.find((t: { candidateId: string }) => t.candidateId === row.candidate_id).id);
    }
    expect(confirmed.reduce((n, r) => n + r.body.created.baseline + r.body.created.planned, 0)).toBe(3);
  });

  it("发现已有不同内容时整批回滚，前面新建的需求不能留下", async () => {
    const input = bundle();
    const first = await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(input).expect(201);
    await request(app.getHttpServer()).post(`/api/manager/import-batches/${first.body.id}/confirm`)
      .send({ expectedRevision: 1, candidateIds: input.records.map((r) => r.candidate_id) }).expect(201);
    const extra = { ...input.records[1], candidate_id: "AAA-" + randomUUID(), title: "不能残留-" + randomUUID() };
    const changed = { ...input, records: [extra, { ...input.records[0], description: "冲突的新正文" }, input.records[1]] };
    const preview = await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(changed).expect(201);
    expect(preview.body.counts).toMatchObject({ new: 1, conflict: 1, duplicate: 1 });
    await request(app.getHttpServer()).post(`/api/manager/import-batches/${preview.body.id}/confirm`)
      .send({ expectedRevision: 1, candidateIds: changed.records.map((r) => r.candidate_id) }).expect(409);
    const list = await request(app.getHttpServer()).get("/api/manager/requirements").expect(200);
    expect(list.body.some((r: { title: string }) => r.title === extra.title)).toBe(false);
    const batch = await request(app.getHttpServer()).get(`/api/manager/import-batches/${preview.body.id}`).expect(200);
    expect(batch.body.status).toBe("previewed");
  });

  it("拒绝不同仓库的证据和自动开发许可", async () => {
    const input = bundle();
    input.records[0].evidence[0].url = "https://example.com/untrusted";
    await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(input).expect(400);
    const automatic = bundle();
    automatic.records[1].automation_eligible = true;
    await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(automatic).expect(400);
  });

  it("确认后把能力基线与规划需求分别保存，并保留证据与人工开发策略", async () => {
    const input = bundle();
    const preview = await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(input).expect(201);
    const confirmed = await request(app.getHttpServer()).post(`/api/manager/import-batches/${preview.body.id}/confirm`)
      .send({ expectedRevision: preview.body.revision, candidateIds: input.records.map((r) => r.candidate_id) }).expect(201);
    expect(confirmed.body.created).toEqual({ baseline: 1, planned: 1 });
    const capabilities = await request(app.getHttpServer()).get("/api/manager/capabilities").expect(200);
    expect(capabilities.body.find((r: { title: string }) => r.title === input.records[0].title)).toMatchObject({
      implementationState: "observed_in_code", acceptanceState: "not_verified", deploymentState: "unknown",
    });
    const list = await request(app.getHttpServer()).get("/api/manager/requirements").expect(200);
    const requirement = list.body.find((r: { title: string }) => r.title === input.records[1].title);
    expect(requirement).toMatchObject({ status: "waiting", automationPolicy: "manual", project: "manager",
      source: "audit_proposal", acceptanceCriteria: ["验证通过"], evidenceRefs: input.records[1].evidence.map((e) => ({
        ...e, url: e.url.replace("Era3e/MagicTools", "era3e/magictools"),
      })) });
    expect(list.body.some((r: { title: string }) => r.title === input.records[0].title)).toBe(false);
  });

  it("预览显示两类候选，且不创建正式需求", async () => {
    const input = bundle();
    const preview = await request(app.getHttpServer()).post("/api/manager/import-batches/preview").send(input).expect(201);
    expect(preview.body.status).toBe("previewed");
    expect(preview.body.counts).toMatchObject({ baseline: 1, planned: 1, new: 2 });
    const list = await request(app.getHttpServer()).get("/api/manager/requirements").expect(200);
    expect(list.body.some((row: { title: string }) => row.title === input.records[1].title)).toBe(false);
  });
});
