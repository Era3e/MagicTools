import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const candidateId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/);
const evidenceSchema = z.object({
  path: z.string().min(1).max(500), line: z.number().int().positive().max(1_000_000),
  commit: sha, url: z.string().url().max(1500),
}).passthrough();

const candidateSchema = z.object({
  candidate_id: candidateId,
  record_kind: z.enum(["baseline", "planned"]),
  project: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20000),
  source: z.enum(["repo_reverse", "audit_proposal"]),
  source_commit: sha,
  review_status: z.literal("unreviewed"),
  automation_eligible: z.literal(false),
  priority: z.enum(["P0", "P1", "P2"]).default("P2"),
  evidence: z.array(evidenceSchema).min(1).max(20),
  acceptance_criteria: z.array(z.string().min(1).max(2000)).max(50).default([]),
  verification_gaps: z.array(z.string().min(1).max(2000)).max(50).default([]),
  depends_on: z.array(candidateId).max(100).default([]),
}).passthrough();

const bundleSchema = z.object({
  schema_version: z.literal("magictools-requirement-candidates/0.1"),
  repository: z.string().regex(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/),
  snapshot_commit: sha,
  records: z.array(candidateSchema).min(1).max(200),
});

export type Candidate = z.infer<typeof candidateSchema>;
export type CandidateBundle = z.infer<typeof bundleSchema>;

export function stableHash(value: unknown): string {
  function ordered(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(ordered);
    if (input && typeof input === "object") return Object.fromEntries(
      Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])
    );
    return input;
  }
  return createHash("sha256").update(JSON.stringify(ordered(value))).digest("hex");
}

export function parseCandidateBundle(input: unknown): CandidateBundle {
  if (Buffer.byteLength(JSON.stringify(input) ?? "", "utf8") > 90 * 1024) {
    throw new BadRequestException("候选文件不得超过 90 KiB，请拆分批次");
  }
  const parsed = bundleSchema.safeParse(input);
  if (!parsed.success) throw new BadRequestException("候选格式非法，请使用待确认且未授权自动开发的候选包");
  const bundle = parsed.data;
  bundle.repository = bundle.repository.replace(/\/$/, "").replace(/\.git$/i, "").toLowerCase();
  const ids = new Set<string>();
  for (const row of bundle.records) {
    if (ids.has(row.candidate_id)) throw new BadRequestException("候选编号重复：" + row.candidate_id);
    ids.add(row.candidate_id);
    if (row.source_commit !== bundle.snapshot_commit ||
        row.source !== (row.record_kind === "baseline" ? "repo_reverse" : "audit_proposal")) {
      throw new BadRequestException("候选来源或提交与批次不一致");
    }
    for (const e of row.evidence) {
      const segments = e.path.split("/");
      if (segments.some((p) => !p || p === "." || p === "..") || /[\\:#?\u0000-\u001f]/.test(e.path)) {
        throw new BadRequestException("证据文件路径非法");
      }
      const expected = bundle.repository + "/blob/" + bundle.snapshot_commit + "/" + e.path + "#L" + e.line;
      let decoded: string;
      try {
        const url = new URL(e.url);
        if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.search) {
          throw new Error("invalid source");
        }
        const parts = url.pathname.split("/");
        parts[1] = (parts[1] ?? "").toLowerCase();
        parts[2] = (parts[2] ?? "").toLowerCase();
        decoded = decodeURI(url.origin + parts.join("/") + url.hash);
      } catch { throw new BadRequestException("证据链接编码或来源非法"); }
      if (e.commit !== bundle.snapshot_commit || decoded !== expected) {
        throw new BadRequestException("证据链接必须指向同一仓库、提交、文件和行号");
      }
      e.url = bundle.repository + "/blob/" + bundle.snapshot_commit + "/" + encodeURI(e.path) + "#L" + e.line;
    }
  }
  bundle.records.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
  return bundle;
}
