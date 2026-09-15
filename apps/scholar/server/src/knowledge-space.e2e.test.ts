// @database-integration: required by test:db
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

describe("knowledge spaces", () => {
  let app: INestApplication;

  beforeAll(async () => {
    try {
      process.env.MT_LLM_STUB = "1";
      await ensureDatabase();
      await migrate();
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = moduleRef.createNestApplication();
      app.setGlobalPrefix("api/scholar");
      await app.init();
    } catch (error) {
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE entry_entities,relations,entities,entry_publications,entry_requirement_links,
      revision_requirement_links,entry_revisions,entries,product_versions,knowledge_space_members,knowledge_spaces CASCADE`);
    await pool.query(`INSERT INTO knowledge_spaces (key,name,kind,visibility) VALUES
      ('development','开发知识空间','development','private'),
      ('product','产品帮助空间','product','public')
      ON CONFLICT (key) DO NOTHING`);
  });

  async function createEntry(body: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post("/api/scholar/entries")
      .set("x-gateway-user", "root")
      .set("x-gateway-role", "admin")
      .send(body);
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  it("公共入口只返回当前产品版本中已发布的内容", async () => {
    await createEntry({ title: "内部部署密钥处理", content: "internal deployment secret", spaceKey: "development" });
    const product = await createEntry({
      title: "如何创建需求",
      content: "进入需求管理后点击新建需求",
      spaceKey: "product",
      sourceRevision: "commit-p18",
      sourceUrl: "https://example.com/commit-p18",
      requirementId: "REQ-P18",
      requirementUrl: "https://example.com/req-p18",
    });
    const version = await request(app.getHttpServer())
      .post("/api/scholar/spaces/product/versions")
      .set("x-gateway-role", "admin")
      .send({ version: "1.0.0", sourceRevision: "commit-p18" });
    expect(version.status).toBe(201);
    const published = await request(app.getHttpServer())
      .post("/api/scholar/versions/" + version.body.id + "/publish")
      .set("x-gateway-role", "admin")
      .send({ entryIds: [product.id], deploymentRef: "registry@sha256:p18", publishedBy: "root" });
    expect(published.status).toBe(201);

    const current = await request(app.getHttpServer()).get("/api/scholar/public/version/current");
    expect(current.status).toBe(200);
    expect(current.body.version).toBe("1.0.0");
    expect(current.body.deploymentRef).toBe("registry@sha256:p18");

    const list = await request(app.getHttpServer()).get("/api/scholar/public/entries");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe("如何创建需求");
    expect(list.body[0].requirementLinks[0]).toMatchObject({ requirementId: "REQ-P18" });

    const leak = await request(app.getHttpServer()).get("/api/scholar/public/entries/search?q=internal&mode=fts");
    expect(leak.status).toBe(200);
    expect(leak.body).toEqual([]);
  });

  it("发布后编辑生成新修订且公共入口仍返回发布修订", async () => {
    const product = await createEntry({ title: "用户帮助第一版", content: "第一版内容", spaceKey: "product" });
    const version = await request(app.getHttpServer())
      .post("/api/scholar/spaces/product/versions")
      .set("x-gateway-role", "admin")
      .send({ version: "1.1.0", sourceRevision: "commit-base" });
    await request(app.getHttpServer())
      .post("/api/scholar/versions/" + version.body.id + "/publish")
      .set("x-gateway-role", "admin")
      .send({ entryIds: [product.id], deploymentRef: "registry@sha256:base" });

    const rollup = await request(app.getHttpServer())
      .post("/api/scholar/spaces/product/versions")
      .set("x-gateway-role", "admin")
      .send({ version: "1.2.0", sourceRevision: "commit-rollup" });
    const rolledUp = await request(app.getHttpServer())
      .post("/api/scholar/versions/" + rollup.body.id + "/publish")
      .set("x-gateway-role", "admin")
      .send({ entryIds: [product.id], deploymentRef: "registry@sha256:rollup" });
    expect(rolledUp.status).toBe(201);
    expect((await request(app.getHttpServer()).get("/api/scholar/public/version/current")).body.version).toBe("1.2.0");

    const edited = await request(app.getHttpServer())
      .patch("/api/scholar/entries/" + product.id)
      .set("x-gateway-role", "admin")
      .send({ title: "用户帮助第二版", content: "未发布草稿", sourceRevision: "commit-next" });
    expect(edited.status).toBe(200);
    expect(edited.body.status).toBe("published");
    expect(edited.body.revisionNo).toBe(2);

    const publicEntry = await request(app.getHttpServer()).get("/api/scholar/public/entries/" + product.id);
    expect(publicEntry.status).toBe(200);
    expect(publicEntry.body.title).toBe("用户帮助第一版");
    expect(publicEntry.body.content).toBe("第一版内容");
    expect(publicEntry.body.revisionNo).toBe(1);
  });

  it("普通用户访问产品空间时只能看到已发布条目", async () => {
    await createEntry({ title: "产品草稿", content: "尚未发布的产品草稿", spaceKey: "product" });
    const product = await createEntry({ title: "已发布帮助", content: "已发布内容", spaceKey: "product" });
    const version = await request(app.getHttpServer())
      .post("/api/scholar/spaces/product/versions")
      .set("x-gateway-role", "admin")
      .send({ version: "3.1.0", sourceRevision: "commit-public-space" });
    await request(app.getHttpServer())
      .post("/api/scholar/versions/" + version.body.id + "/publish")
      .set("x-gateway-role", "admin")
      .send({ entryIds: [product.id], deploymentRef: "registry@sha256:space", publishedBy: "root" });

    const list = await request(app.getHttpServer())
      .get("/api/scholar/spaces/product/entries")
      .set("x-gateway-user", "alice")
      .set("x-gateway-role", "user");
    expect(list.status).toBe(200);
    expect(list.body.map((item: { title: string }) => item.title)).toContain("已发布帮助");
    expect(list.body.map((item: { title: string }) => item.title)).not.toContain("产品草稿");

    const edited = await request(app.getHttpServer())
      .patch("/api/scholar/entries/" + product.id)
      .set("x-gateway-role", "admin")
      .send({ title: "已发布帮助修订草稿" });
    expect(edited.status).toBe(200);
    const snapshotList = await request(app.getHttpServer())
      .get("/api/scholar/spaces/product/entries")
      .set("x-gateway-user", "alice")
      .set("x-gateway-role", "user");
    expect(snapshotList.status).toBe(200);
    expect(snapshotList.body.map((item: { title: string }) => item.title)).toContain("已发布帮助");
    expect(snapshotList.body.map((item: { title: string }) => item.title)).not.toContain("已发布帮助修订草稿");
  });

  it("发布后的需求证据来自发布修订快照，后续关联不改变公共内容", async () => {
    const product = await createEntry({
      title: "证据快照", content: "证据内容", spaceKey: "product",
      requirementId: "REQ-BASE", requirementUrl: "https://example.com/req-base",
    });
    const version = await request(app.getHttpServer())
      .post("/api/scholar/spaces/product/versions")
      .set("x-gateway-role", "admin")
      .send({ version: "4.0.0", sourceRevision: "commit-evidence" });
    await request(app.getHttpServer())
      .post("/api/scholar/versions/" + version.body.id + "/publish")
      .set("x-gateway-role", "admin")
      .send({ entryIds: [product.id], deploymentRef: "registry@sha256:evidence", publishedBy: "root" });

    const linked = await request(app.getHttpServer())
      .post("/api/scholar/entries/" + product.id + "/requirement-links")
      .set("x-gateway-role", "admin")
      .send({ requirementId: "REQ-LATER", requirementUrl: "https://example.com/req-later", source: "manual" });
    expect(linked.status).toBe(201);

    const publicEntry = await request(app.getHttpServer()).get("/api/scholar/public/entries/" + product.id);
    expect(publicEntry.status).toBe(200);
    expect(publicEntry.body.requirementLinks).toEqual([
      { requirementId: "REQ-BASE", requirementUrl: "https://example.com/req-base", source: "manual" },
    ]);

    const nextVersion = await request(app.getHttpServer())
      .post("/api/scholar/spaces/product/versions")
      .set("x-gateway-role", "admin")
      .send({ version: "4.1.0", sourceRevision: "commit-evidence-next" });
    await request(app.getHttpServer())
      .post("/api/scholar/versions/" + nextVersion.body.id + "/publish")
      .set("x-gateway-role", "admin")
      .send({ entryIds: [product.id], deploymentRef: "registry@sha256:evidence-next", publishedBy: "root" });
    const republishedEntry = await request(app.getHttpServer()).get("/api/scholar/public/entries/" + product.id);
    expect(republishedEntry.status).toBe(200);
    expect(republishedEntry.body.requirementLinks.map((item: { requirementId: string }) => item.requirementId)).toEqual([
      "REQ-BASE",
      "REQ-LATER",
    ]);
  });

  it("来源与需求元数据更新生成不可变修订并真实落库", async () => {
    const entry = await createEntry({ title: "元数据修订", content: "内容", spaceKey: "development" });
    const updated = await request(app.getHttpServer())
      .patch("/api/scholar/entries/" + entry.id)
      .set("x-gateway-role", "admin")
      .send({
        sourceRevision: "commit-metadata",
        sourceUrl: "https://example.com/commit-metadata",
        requirementId: "REQ-METADATA",
        requirementUrl: "https://example.com/req-metadata",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.revisionNo).toBe(2);
    expect(updated.body.sourceRevision).toBe("commit-metadata");
    const revision = await pool.query(
      "SELECT source_revision,source_url,requirement_id,requirement_url FROM entry_revisions WHERE entry_id=$1 AND revision_no=2",
      [entry.id]
    );
    expect(revision.rows[0]).toMatchObject({
      source_revision: "commit-metadata",
      source_url: "https://example.com/commit-metadata",
      requirement_id: "REQ-METADATA",
      requirement_url: "https://example.com/req-metadata",
    });
    const unchangedSpace = await request(app.getHttpServer())
      .patch("/api/scholar/entries/" + entry.id)
      .set("x-gateway-role", "admin")
      .send({ spaceKey: "development" });
    expect(unchangedSpace.status).toBe(200);
    expect(unchangedSpace.body.revisionNo).toBe(2);
  });

  it("拒绝创建第二个产品帮助空间", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/scholar/spaces")
      .set("x-gateway-user", "root")
      .set("x-gateway-role", "admin")
      .send({ key: "another-product", name: "第二个产品空间", kind: "product", visibility: "public" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("只允许一个产品帮助空间");
  });

  it("成员撤权、下架和删除会清理可见性与索引", async () => {
    await request(app.getHttpServer())
      .post("/api/scholar/spaces")
      .set("x-gateway-user", "root")
      .set("x-gateway-role", "admin")
      .send({ key: "backend", name: "后端开发", kind: "development", visibility: "private" });
    await request(app.getHttpServer())
      .put("/api/scholar/spaces/backend/members")
      .set("x-gateway-role", "admin")
      .send({ userId: "bob", role: "viewer" });
    await pool.query(
      `INSERT INTO entries (source,title,content,space_id)
       SELECT 'manual','后端内部实现','内部条目',id FROM knowledge_spaces WHERE key='backend'`
    );
    const memberList = await request(app.getHttpServer())
      .get("/api/scholar/spaces")
      .set("x-gateway-user", "bob")
      .set("x-gateway-role", "user");
    expect(memberList.body.map((item: { key: string }) => item.key)).toContain("backend");
    const memberEntries = await request(app.getHttpServer())
      .get("/api/scholar/spaces/backend/entries")
      .set("x-gateway-user", "bob")
      .set("x-gateway-role", "user");
    expect(memberEntries.status).toBe(200);
    expect(memberEntries.body.map((item: { title: string }) => item.title)).toContain("后端内部实现");

    await request(app.getHttpServer())
      .delete("/api/scholar/spaces/backend/members/bob")
      .set("x-gateway-role", "admin");
    const revokedList = await request(app.getHttpServer())
      .get("/api/scholar/spaces")
      .set("x-gateway-user", "bob")
      .set("x-gateway-role", "user");
    expect(revokedList.body.map((item: { key: string }) => item.key)).not.toContain("backend");
    const revokedEntries = await request(app.getHttpServer())
      .get("/api/scholar/spaces/backend/entries")
      .set("x-gateway-user", "bob")
      .set("x-gateway-role", "user");
    expect(revokedEntries.status).toBe(403);

    const product = await createEntry({ title: "将被下架", content: "下架内容", spaceKey: "product" });
    const version = await request(app.getHttpServer())
      .post("/api/scholar/spaces/product/versions")
      .set("x-gateway-role", "admin")
      .send({ version: "2.0.0", sourceRevision: "commit-offline" });
    await request(app.getHttpServer())
      .post("/api/scholar/versions/" + version.body.id + "/publish")
      .set("x-gateway-role", "admin")
      .send({ entryIds: [product.id], deploymentRef: "registry@sha256:offline" });
    const entityId = await pool.query("INSERT INTO entities (name,type) VALUES ('下架实体','concept') RETURNING id");
    await pool.query("INSERT INTO entry_entities (entry_id,entity_id) VALUES ($1,$2)", [product.id, entityId.rows[0].id]);

    const offline = await request(app.getHttpServer())
      .post("/api/scholar/entries/" + product.id + "/unpublish")
      .set("x-gateway-role", "admin");
    expect(offline.status).toBe(201);
    const cleaned = await pool.query(
      "SELECT embedding IS NULL AS no_vector,status FROM entries WHERE id=$1", [product.id]
    );
    expect(cleaned.rows[0]).toEqual({ no_vector: true, status: "draft" });
    expect((await pool.query("SELECT count(*)::int AS n FROM entry_publications WHERE entry_id=$1", [product.id])).rows[0].n).toBe(0);
    expect((await pool.query("SELECT count(*)::int AS n FROM entry_entities WHERE entry_id=$1", [product.id])).rows[0].n).toBe(0);
    expect((await request(app.getHttpServer()).get("/api/scholar/public/entries/" + product.id)).status).toBe(404);

    const removed = await request(app.getHttpServer())
      .delete("/api/scholar/entries/" + product.id)
      .set("x-gateway-role", "admin");
    expect(removed.status).toBe(200);
    expect((await pool.query("SELECT count(*)::int AS n FROM entries WHERE id=$1", [product.id])).rows[0].n).toBe(0);
  });

  it("未携带管理员身份时管理入口返回 403", async () => {
    const previous = process.env.SCHOLAR_ADMIN_AUTH;
    delete process.env.SCHOLAR_ADMIN_AUTH;
    try {
      const res = await request(app.getHttpServer()).get("/api/scholar/entries");
      expect(res.status).toBe(403);
      const spaces = await request(app.getHttpServer()).post("/api/scholar/spaces");
      expect(spaces.status).toBe(403);
    } finally {
      process.env.SCHOLAR_ADMIN_AUTH = previous ?? "disabled";
    }
  });
});
