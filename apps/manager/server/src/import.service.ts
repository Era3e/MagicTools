import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { pool } from "./db";
import { type CandidateBundle, parseCandidateBundle, stableHash } from "./import-schemas";
import { createRequirement } from "./requirement.repo";
import { z } from "zod";

@Injectable()
export class ImportService {
  async preview(input: unknown) {
    const bundle = parseCandidateBundle(input);
    const fingerprint = stableHash(bundle);
    const result = await pool.query(
      "INSERT INTO manager_import_batches(fingerprint,payload) VALUES($1,$2) ON CONFLICT(fingerprint) DO UPDATE SET fingerprint=EXCLUDED.fingerprint RETURNING id",
      [fingerprint, JSON.stringify(bundle)]
    );
    return this.get(result.rows[0].id as string);
  }

  async get(id: string) {
    const result = await pool.query("SELECT * FROM manager_import_batches WHERE id=$1", [id]);
    if (!result.rowCount) throw new NotFoundException("导入批次不存在");
    const batch = result.rows[0];
    const bundle = batch.payload as CandidateBundle;
    const existing = await pool.query("SELECT candidate_id,candidate_hash FROM manager_import_links WHERE repository=$1 AND candidate_id=ANY($2::text[])",
      [bundle.repository, bundle.records.map((r) => r.candidate_id)]);
    const links = new Map(existing.rows.map((row) => [row.candidate_id as string, row.candidate_hash as string]));
    const candidates = bundle.records.map((row) => ({ ...row,
      disposition: !links.has(row.candidate_id) ? "new" : links.get(row.candidate_id) === stableHash(row) ? "duplicate" : "conflict",
    }));
    const baseline = bundle.records.filter((row) => row.record_kind === "baseline").length;
    return {
      id: batch.id as string, revision: Number(batch.revision), status: batch.status as string,
      repository: bundle.repository, sourceCommit: bundle.snapshot_commit,
      counts: { baseline, planned: bundle.records.length - baseline, new: candidates.filter((r) => r.disposition === "new").length,
        duplicate: candidates.filter((r) => r.disposition === "duplicate").length, conflict: candidates.filter((r) => r.disposition === "conflict").length },
      candidates,
      result: batch.result as Record<string, unknown> | null,
    };
  }

  async remainingPreview(id: string) {
    const rows = await pool.query("SELECT payload FROM manager_import_batches WHERE id=$1", [id]);
    if (!rows.rowCount) throw new NotFoundException("导入批次不存在");
    const bundle = rows.rows[0].payload as CandidateBundle;
    const imported = await pool.query("SELECT candidate_id FROM manager_import_links WHERE repository=$1", [bundle.repository]);
    const ids = new Set(imported.rows.map((row) => row.candidate_id as string));
    const records = bundle.records.filter((row) => !ids.has(row.candidate_id));
    if (!records.length) throw new BadRequestException("本批次没有尚未导入的候选，冲突项需人工处理");
    return this.preview({ ...bundle, records });
  }

  async confirm(id: string, input: unknown) {
    const parsed = z.object({ expectedRevision: z.number().int().positive(),
      candidateIds: z.array(z.string()).min(1).max(200) }).strict().safeParse(input);
    if (!parsed.success) throw new BadRequestException("请提交批次修订号及选中的候选编号");
    const selected = [...new Set(parsed.data.candidateIds)].sort();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query("SELECT * FROM manager_import_batches WHERE id=$1 FOR UPDATE", [id]);
      if (!locked.rowCount) throw new NotFoundException("导入批次不存在");
      const batch = locked.rows[0];
      if (batch.status === "confirmed") {
        const result = batch.result as { candidateIds: string[] };
        if (JSON.stringify(result.candidateIds) !== JSON.stringify(selected)) throw new ConflictException("批次已确认，请通过剩余候选预览创建新批次");
        await client.query("COMMIT");
        return result;
      }
      if (Number(batch.revision) !== parsed.data.expectedRevision) throw new ConflictException("批次修订已变化，请重新预览");
      const bundle = batch.payload as CandidateBundle;
      const candidates = bundle.records.filter((row) => selected.includes(row.candidate_id));
      if (candidates.length !== selected.length) throw new BadRequestException("选中的候选不属于本批次");
      const created = { baseline: 0, planned: 0 };
      const targets: Array<{ candidateId: string; kind: string; id: string; reused: boolean }> = [];
      // 所有批次按相同编号顺序领取，避免交叠批次形成反向锁顺序。
      for (const row of candidates) {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [bundle.repository + "#" + row.candidate_id]);
        const existing = await client.query("SELECT * FROM manager_import_links WHERE repository=$1 AND candidate_id=$2",
          [bundle.repository, row.candidate_id]);
        const fingerprint = stableHash(row);
        if (existing.rowCount) {
          const link = existing.rows[0];
          if (link.candidate_hash !== fingerprint) throw new ConflictException("候选已存在不同内容，保留原记录，请人工处理：" + row.candidate_id);
          targets.push({ candidateId: row.candidate_id, kind: row.record_kind, id: link.requirement_id ?? link.capability_id, reused: true });
          continue;
        }
        let targetId: string;
        if (row.record_kind === "baseline") {
          const result = await client.query(
            "INSERT INTO capabilities(project,title,description,repository,source_ref,source_commit,candidate_payload) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
            [row.project, row.title, row.description, bundle.repository, row.candidate_id, bundle.snapshot_commit, JSON.stringify(row)]);
          targetId = result.rows[0].id as string;
          created.baseline += 1;
        } else {
          const requirement = await createRequirement({ title: row.title, description: row.description, priority: row.priority,
            source: "audit_proposal", sourceRef: bundle.repository + "#" + row.candidate_id,
            sourcePayload: { ...row, repository: bundle.repository }, labels: [row.project, "待确认规划"], project: row.project,
            acceptanceCriteria: row.acceptance_criteria, evidenceRefs: row.evidence, dependencyRefs: row.depends_on,
          }, client);
          targetId = requirement.id;
          created.planned += 1;
        }
        await client.query("INSERT INTO manager_import_links(repository,candidate_id,candidate_hash,record_kind,requirement_id,capability_id) VALUES($1,$2,$3,$4,$5,$6)",
          [bundle.repository, row.candidate_id, fingerprint, row.record_kind, row.record_kind === "planned" ? targetId : null, row.record_kind === "baseline" ? targetId : null]);
        targets.push({ candidateId: row.candidate_id, kind: row.record_kind, id: targetId, reused: false });
      }
      const result = { batchId: id, candidateIds: selected, created, targets };
      await client.query("UPDATE manager_import_batches SET status='confirmed',revision=revision+1,result=$2,confirmed_at=now() WHERE id=$1", [id, JSON.stringify(result)]);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async capabilities() {
    const rows = await pool.query("SELECT * FROM capabilities ORDER BY created_at DESC");
    return rows.rows.map((r) => ({ id: r.id as string, project: r.project as string, title: r.title as string,
      description: r.description as string, repository: r.repository as string, sourceRef: r.source_ref as string,
      sourceCommit: r.source_commit as string, candidatePayload: r.candidate_payload as Record<string, unknown>,
      implementationState: r.implementation_state as string, acceptanceState: r.acceptance_state as string,
      deploymentState: r.deployment_state as string,
    }));
  }
}
