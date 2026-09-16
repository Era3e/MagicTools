// @database-integration: required by test:db
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { AppModule } from "./app.module";
import { migrate, pool } from "./db";
import { secretRefSchema } from "./resources.service";

let app: INestApplication;
const ownerToken = randomBytes(32).toString("hex");
const previousToken = process.env.MANAGER_APPROVAL_TOKEN;

beforeAll(async () => {
  process.env.MANAGER_APPROVAL_TOKEN = ownerToken;
  await migrate();
  await pool.query("TRUNCATE operations_resource_checks, operations_secret_refs, operations_resources CASCADE");
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/manager");
  await app.init();
}, 20000);

afterAll(async () => {
  if (app) await app.close();
  await pool.end();
  if (previousToken === undefined) delete process.env.MANAGER_APPROVAL_TOKEN; else process.env.MANAGER_APPROVAL_TOKEN = previousToken;
});

function resourceInput() {
  return {
    name: "production-postgres",
    kind: "database",
    environment: "production",
    owner: "platform-ops",
    provider: "self-hosted",
    region: "aliyun-shanghai",
    monthlyBudgetCents: 128000,
    backupReference: "backup-store://magictools/current",
    runbookUrl: "https://github.com/Era3e/MagicTools/blob/main/docs/features/backup-recovery.md",
    notes: "八业务库主实例",
    secretRefs: [{
      name: "BACKUP_KEY",
      source: "file",
      reference: "file:/etc/magictools/backup/private.key",
      required: true,
    }],
  };
}

describe("资源、密钥引用与运行面板", () => {
  it("资源写入需要审批凭证，且只接受密钥引用不接受秘密值", async () => {
    await request(app.getHttpServer()).post("/api/manager/resources")
      .send(resourceInput()).expect(403);

    await request(app.getHttpServer()).post("/api/manager/resources")
      .set("x-manager-approval-token", ownerToken)
      .send({ ...resourceInput(), name: "production-postgres", secretRefs: [{ ...resourceInput().secretRefs[0], value: "literal-secret" }] })
      .expect(400);

    await request(app.getHttpServer()).post("/api/manager/resources")
      .set("x-manager-approval-token", ownerToken)
      .send({
        ...resourceInput(),
        name: "production-registry",
        secretRefs: [{ name: "REGISTRY_KEY", source: "env", reference: "file:/etc/magictools/registry.key", required: true }],
      })
      .expect(400);
    expect(secretRefSchema.safeParse({
      name: "REGISTRY_KEY", source: "env", reference: "file:/etc/magictools/registry.key", required: true,
    }).success).toBe(false);
    expect(secretRefSchema.safeParse({
      name: "REGISTRY_KEY", source: "env", reference: "env:REGISTRY_KEY", required: true,
    }).success).toBe(true);

    const created = await request(app.getHttpServer()).post("/api/manager/resources")
      .set("x-manager-approval-token", ownerToken)
      .send(resourceInput()).expect(201);
    expect(created.body).toMatchObject({
      name: "production-postgres",
      kind: "database",
      environment: "production",
      owner: "platform-ops",
      monthlyBudgetCents: 128000,
      backupReference: "backup-store://magictools/current",
      runbookUrl: "https://github.com/Era3e/MagicTools/blob/main/docs/features/backup-recovery.md",
      status: "unknown",
      secretRefs: [{ name: "BACKUP_KEY", source: "file", reference: "file:/etc/magictools/backup/private.key", required: true }],
    });
  });

  it("blocked 与 waiting 检查分别计数，不合并成失败或跳过", async () => {
    const listed = await request(app.getHttpServer()).get("/api/manager/resources").expect(200);
    const id = listed.body.items[0].id;
    await request(app.getHttpServer()).post(`/api/manager/resources/${id}/checks`)
      .set("x-manager-approval-token", ownerToken)
      .send({ name: "remote-host", outcome: "waiting" }).expect(400, /可行动原因/);
    await request(app.getHttpServer()).post(`/api/manager/resources/${id}/checks`)
      .set("x-manager-approval-token", ownerToken)
      .send({ name: "backup-key", outcome: "blocked", detail: "生产密钥文件未配置，无法发起真实备份验证" }).expect(201);
    await request(app.getHttpServer()).post(`/api/manager/resources/${id}/checks`)
      .set("x-manager-approval-token", ownerToken)
      .send({ name: "remote-host", outcome: "waiting", detail: "等待独立备份机 SSH 凭证和主机初始化" }).expect(201);
    await request(app.getHttpServer()).post(`/api/manager/resources/${id}/checks`)
      .set("x-manager-approval-token", ownerToken)
      .send({ name: "local-restore", outcome: "passed", detail: "", evidenceUrl: "https://github.com/Era3e/MagicTools/actions/runs/1" }).expect(201);

    const summary = await request(app.getHttpServer()).get("/api/manager/resources").expect(200);
    expect(summary.body.summary).toMatchObject({
      total: 1,
      monthlyBudgetCents: 128000,
      statusCounts: { blocked: 1, waiting: 0, failed: 0, unknown: 0, operational: 0 },
      checkCounts: { blocked: 1, waiting: 1, passed: 1, failed: 0 },
      secretRefCount: 1,
    });
    expect(summary.body.items[0]).toMatchObject({ status: "blocked" });
    expect(summary.body.items[0].latestChecks).toHaveLength(3);
    expect(summary.body.items[0].revision).toBe(4);
  });

  it("同名检查按最新结果计数，runbook 可从告警直达处理手册", async () => {
    const listed = await request(app.getHttpServer()).get("/api/manager/resources").expect(200);
    const id = listed.body.items[0].id;
    await request(app.getHttpServer()).post(`/api/manager/resources/${id}/checks`)
      .set("x-manager-approval-token", ownerToken)
      .send({ name: "remote-host", outcome: "passed", detail: "", evidenceUrl: "https://github.com/Era3e/MagicTools/actions/runs/2" }).expect(201);

    const summary = await request(app.getHttpServer()).get("/api/manager/resources").expect(200);
    expect(summary.body.summary.checkCounts).toEqual({ passed: 2, failed: 0, blocked: 1, waiting: 0 });
    const remote = summary.body.items[0].latestChecks.find((check: { name: string }) => check.name === "remote-host");
    expect(remote).toMatchObject({ outcome: "passed", evidenceUrl: "https://github.com/Era3e/MagicTools/actions/runs/2" });
    expect(summary.body.items[0].runbookUrl).toMatch(/^https:\/\//);
  });
});
