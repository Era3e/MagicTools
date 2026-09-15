// @database-integration: required by test:db
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

describe("P19 public hybrid search", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.MT_LLM_STUB = "1";
    process.env.SCHOLAR_ADMIN_AUTH = "disabled";
    await ensureDatabase();
    await migrate();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/scholar");
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE entry_entities,relations,entities,entry_publications,entry_requirement_links,
      revision_requirement_links,entry_chunks,entry_revisions,entries,product_versions,knowledge_space_members,knowledge_spaces CASCADE`);
    await pool.query(`INSERT INTO knowledge_spaces (key,name,kind,visibility) VALUES
      ('development','开发知识空间','development','private'),
      ('product','产品帮助空间','product','public') ON CONFLICT DO NOTHING`);
  });

  async function createProduct(body: Record<string, unknown>) {
    const res = await request(app.getHttpServer()).post("/api/scholar/entries").send({ spaceKey: "product", ...body });
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  async function publish(entryId: string, version: string) {
    const created = await request(app.getHttpServer())
      .post("/api/scholar/spaces/product/versions")
      .send({ version, sourceRevision: "commit-" + version });
    expect(created.status).toBe(201);
    const published = await request(app.getHttpServer())
      .post("/api/scholar/versions/" + created.body.id + "/publish")
      .send({ entryIds: [entryId], deploymentRef: "registry@sha256:" + version, publishedBy: "root" });
    expect(published.status).toBe(201);
    return created.body as { id: string };
  }

  async function search(q: string) {
    const res = await request(app.getHttpServer()).post("/api/scholar/public/search").send({ q, limit: 5 });
    expect(res.status).toBe(200);
    return res.body as {
      candidates: Array<{
        title: string; content: string; chunkNo: number; charStart: number; charEnd: number;
        revisionId: string; revisionNo: number; productVersion: string; requirementLinks: Array<{ requirementId: string }>;
      }>;
    };
  }

  it("长文档后半段分块可召回并携带修订/版本/需求证据", async () => {
    const content = "前置说明。".repeat(220) + "唯一回退预案在文档末尾：先保存数据库回执";
    const entry = await createProduct({
      title: "发布与回退手册",
      content,
      sourceRevision: "commit-p19-long",
      requirementId: "REQ-P19-LONG",
    });
    await publish(entry.id, "10.0.0");
    const body = await search("回退预案");
    expect(body.candidates).toHaveLength(1);
    const hit = body.candidates[0];
    expect(hit.title).toBe("发布与回退手册");
    expect(hit.chunkNo).toBeGreaterThan(1);
    expect(hit.charStart).toBeGreaterThan(0);
    expect(hit.charEnd).toBeGreaterThan(hit.charStart);
    expect(hit.content).toContain("唯一回退预案");
    expect(hit.revisionNo).toBe(1);
    expect(hit.productVersion).toBe("10.0.0");
    expect(hit.requirementLinks).toEqual([expect.objectContaining({ requirementId: "REQ-P19-LONG" })]);

    // 等价于迁移前存量的“分块向量 NULL”状态：FTS 仍可定位证据，且不会复制
    // 文档级向量导致所有 chunk 相似度完全相同。
    await pool.query("UPDATE entry_chunks SET embedding=NULL WHERE revision_id=$1", [hit.revisionId]);
    const legacy = await search("回退预案");
    expect(legacy.candidates).toHaveLength(1);
    expect(legacy.candidates[0].chunkNo).toBe(hit.chunkNo);
    expect(legacy.candidates[0].content).toContain("唯一回退预案");
  });

  it("无关向量近邻被门槛过滤，不生成候选", async () => {
    const entry = await createProduct({ title: "Unrelated ZZZ Manual", content: "zzz xxx unrelated content" });
    await publish(entry.id, "10.1.0");
    expect((await search("qqq www target")).candidates).toEqual([]);
  });

  it("开发私有内容不能进入公共混合检索", async () => {
    const product = await createProduct({ title: "Public Empty", content: "公开基础说明" });
    await publish(product.id, "10.2.0");
    await request(app.getHttpServer()).post("/api/scholar/entries").send({
      title: "内部部署密钥",
      content: "private deployment secret",
      spaceKey: "development",
    });
    expect((await search("private deployment secret")).candidates).toEqual([]);
  });

  it("发布后编辑不影响检索快照，草稿词不能被召回", async () => {
    const entry = await createProduct({ title: "发布手册", content: "第一版发布步骤：检查回执" });
    await publish(entry.id, "10.3.0");
    const edited = await request(app.getHttpServer()).patch("/api/scholar/entries/" + entry.id).send({
      content: "第二版草稿暗号：unpublished-draft-token",
      sourceRevision: "commit-p19-draft",
    });
    expect(edited.status).toBe(200);
    expect((await search("unpublished-draft-token")).candidates).toEqual([]);
    const old = await search("第一版发布步骤");
    expect(old.candidates).toHaveLength(1);
    expect(old.candidates[0].content).toContain("第一版发布步骤");
    expect(old.candidates[0].revisionNo).toBe(1);
  });
});
