import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

describe("obsidian", () => {
  let app: INestApplication;
  let vaultDir: string;

  beforeAll(async () => {
    process.env.MT_LLM_STUB = "1";
    await ensureDatabase();
    await migrate();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/scholar");
    await app.init();
    vaultDir = mkdtempSync(join(tmpdir(), "scholar-vault-"));
    writeFileSync(join(vaultDir, "note1.md"), "# 第一条\n内容甲");
    mkdirSync(join(vaultDir, "sub"));
    writeFileSync(join(vaultDir, "sub", "note2.md"), "# 第二条\n内容乙");
    mkdirSync(join(vaultDir, "templates"));
    writeFileSync(join(vaultDir, "templates", "tmpl.md"), "模板");
    mkdirSync(join(vaultDir, "attachments"));
    writeFileSync(join(vaultDir, "attachments", "img.md"), "附件");
  });

  afterAll(async () => {
    rmSync(vaultDir, { recursive: true, force: true });
    await app.close();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM entries");
    await pool.query("DELETE FROM settings");
  });

  it("未配置 vault 路径时同步返回 400", async () => {
    const res = await request(app.getHttpServer()).post("/api/scholar/sync/obsidian");
    expect(res.status).toBe(400);
  });

  it("PATCH /api/scholar/settings 配置并回读 vault 路径", async () => {
    const res = await request(app.getHttpServer()).patch("/api/scholar/settings").send({ vaultPath: vaultDir });
    expect(res.status).toBe(200);
    expect(res.body.vaultPath).toBe(vaultDir);
    const got = await request(app.getHttpServer()).get("/api/scholar/settings");
    expect(got.status).toBe(200);
    expect(got.body.vaultPath).toBe(vaultDir);
  });

  it("POST /api/scholar/sync/obsidian 扫描导入并跳过模板/附件目录", async () => {
    await request(app.getHttpServer()).patch("/api/scholar/settings").send({ vaultPath: vaultDir });
    const res = await request(app.getHttpServer()).post("/api/scholar/sync/obsidian");
    expect(res.status).toBe(201);
    expect(res.body.scanned).toBe(2);
    expect(res.body.created).toBe(2);
    expect(res.body.skipped).toBe(0);
    const rows = await pool.query("SELECT source_ref, source, embedding IS NOT NULL AS has_vec FROM entries WHERE source = 'obsidian' ORDER BY source_ref");
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.map((r) => r.source_ref).sort()).toEqual(["note1.md", "sub/note2.md"]);
    for (const r of rows.rows) {
      expect(r.source).toBe("obsidian");
      expect(r.has_vec).toBe(true);
    }
  });

  it("重复同步按路径去重幂等", async () => {
    await request(app.getHttpServer()).patch("/api/scholar/settings").send({ vaultPath: vaultDir });
    const first = await request(app.getHttpServer()).post("/api/scholar/sync/obsidian");
    expect(first.body.created).toBe(2);
    const second = await request(app.getHttpServer()).post("/api/scholar/sync/obsidian");
    expect(second.status).toBe(201);
    expect(second.body.created).toBe(0);
    expect(second.body.skipped).toBe(2);
  });

  it("GET /api/scholar/meta/embedding-status 返回桩模式状态", async () => {
    const res = await request(app.getHttpServer()).get("/api/scholar/meta/embedding-status");
    expect(res.status).toBe(200);
    expect(res.body.stub).toBe(true);
    expect(res.body.model).toBe("embedding-2");
  });
});
