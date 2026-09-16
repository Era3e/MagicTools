import { pool } from "./db";
import type { PoolClient } from "pg";

export const RESOURCE_KINDS = ["host", "database", "registry", "domain", "external-api", "deployment"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export const RESOURCE_ENVIRONMENTS = ["development", "staging", "production"] as const;
export type ResourceEnvironment = (typeof RESOURCE_ENVIRONMENTS)[number];
export const SECRET_REF_SOURCES = ["env", "file", "external"] as const;
export type SecretRefSource = (typeof SECRET_REF_SOURCES)[number];
export const RESOURCE_CHECK_OUTCOMES = ["passed", "failed", "blocked", "waiting"] as const;
export type ResourceCheckOutcome = (typeof RESOURCE_CHECK_OUTCOMES)[number];

export interface SecretRefView {
  id: string;
  name: string;
  source: SecretRefSource;
  reference: string;
  required: boolean;
}

export interface ResourceCheckView {
  id: string;
  name: string;
  outcome: ResourceCheckOutcome;
  detail: string;
  evidenceUrl: string;
  checkedAt: string;
}

export interface ResourceView {
  id: string;
  name: string;
  kind: ResourceKind;
  environment: ResourceEnvironment;
  owner: string;
  provider: string;
  region: string;
  budgetCurrency: "CNY";
  monthlyBudgetCents: number;
  backupReference: string;
  runbookUrl: string;
  notes: string;
  revision: number;
  status: "operational" | "failed" | "blocked" | "waiting" | "unknown";
  checkCounts: Record<ResourceCheckOutcome, number>;
  secretRefs: SecretRefView[];
  latestChecks: ResourceCheckView[];
  createdAt: string;
  updatedAt: string;
}

export interface ResourceSummary {
  total: number;
  monthlyBudgetCents: number;
  statusCounts: Record<ResourceView["status"], number>;
  checkCounts: Record<ResourceCheckOutcome, number>;
  secretRefCount: number;
}

export interface CreateResourceInput {
  name: string;
  kind: ResourceKind;
  environment: ResourceEnvironment;
  owner: string;
  provider: string;
  region: string;
  monthlyBudgetCents: number;
  backupReference: string;
  runbookUrl: string;
  notes: string;
  secretRefs: Array<Omit<SecretRefView, "id">>;
}

export interface CreateResourceCheckInput {
  name: string;
  outcome: ResourceCheckOutcome;
  detail: string;
  evidenceUrl: string;
}

interface ResourceRow {
  id: string;
  name: string;
  kind: ResourceKind;
  environment: ResourceEnvironment;
  owner: string;
  provider: string;
  region: string;
  monthly_budget_cents: number;
  backup_reference: string;
  runbook_url: string;
  notes: string;
  revision: number;
  created_at: Date | string;
  updated_at: Date | string;
}

function emptyCheckCounts(): Record<ResourceCheckOutcome, number> {
  return { passed: 0, failed: 0, blocked: 0, waiting: 0 };
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

export async function listResources(): Promise<{ items: ResourceView[]; summary: ResourceSummary }> {
  const resources = await pool.query("SELECT * FROM operations_resources ORDER BY environment, name");
  if (!resources.rowCount) return { items: [], summary: emptySummary() };
  const ids = resources.rows.map((row) => (row as ResourceRow).id);
  const refs = await pool.query("SELECT * FROM operations_secret_refs WHERE resource_id=ANY($1::uuid[]) ORDER BY name", [ids]);
  const checks = await pool.query(
    `SELECT DISTINCT ON (resource_id, name) *
     FROM operations_resource_checks
     WHERE resource_id=ANY($1::uuid[])
     ORDER BY resource_id, name, checked_at DESC, id DESC`,
    [ids]
  );

  const refsByResource = new Map<string, SecretRefView[]>();
  for (const row of refs.rows as Array<Record<string, unknown>>) {
    const list = refsByResource.get(row.resource_id as string) ?? [];
    list.push({
      id: row.id as string,
      name: row.name as string,
      source: row.source as SecretRefSource,
      reference: row.reference as string,
      required: Boolean(row.required),
    });
    refsByResource.set(row.resource_id as string, list);
  }
  const checksByResource = new Map<string, ResourceCheckView[]>();
  for (const row of checks.rows as Array<Record<string, unknown>>) {
    const list = checksByResource.get(row.resource_id as string) ?? [];
    list.push({
      id: row.id as string,
      name: row.name as string,
      outcome: row.outcome as ResourceCheckOutcome,
      detail: (row.detail as string) ?? "",
      evidenceUrl: (row.evidence_url as string) ?? "",
      checkedAt: iso(row.checked_at as Date | string),
    });
    checksByResource.set(row.resource_id as string, list);
  }

  const items = (resources.rows as ResourceRow[]).map((row) => {
    const latestChecks = (checksByResource.get(row.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    const checkCounts = emptyCheckCounts();
    for (const check of latestChecks) checkCounts[check.outcome] += 1;
    return mapResource(row, latestChecks, checkCounts, refsByResource.get(row.id) ?? []);
  });
  return { items, summary: summarize(items) };
}

export async function createResource(input: CreateResourceInput): Promise<ResourceView> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO operations_resources
        (name,kind,environment,owner,provider,region,monthly_budget_cents,backup_reference,runbook_url,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [input.name, input.kind, input.environment, input.owner, input.provider, input.region,
        input.monthlyBudgetCents, input.backupReference, input.runbookUrl, input.notes]
    );
    const row = inserted.rows[0] as ResourceRow;
    await insertSecretRefs(client, row.id, input.secretRefs);
    await client.query("COMMIT");
    const all = await listResources();
    return all.items.find((item) => item.id === row.id)!;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createResourceCheck(resourceId: string, input: CreateResourceCheckInput): Promise<ResourceView | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id FROM operations_resources WHERE id=$1 FOR UPDATE", [resourceId]);
    if (!found.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `INSERT INTO operations_resource_checks (resource_id,name,outcome,detail,evidence_url,checked_at)
       VALUES ($1,$2,$3,$4,$5,now())`,
      [resourceId, input.name, input.outcome, input.detail, input.evidenceUrl]
    );
    await client.query(
      "UPDATE operations_resources SET revision=revision+1, updated_at=now() WHERE id=$1",
      [resourceId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  const all = await listResources();
  return all.items.find((item) => item.id === resourceId) ?? null;
}

async function insertSecretRefs(client: Pick<PoolClient, "query">, resourceId: string, refs: Array<Omit<SecretRefView, "id">>) {
  for (const ref of refs) {
    await client.query(
      `INSERT INTO operations_secret_refs (resource_id,name,source,reference,required)
       VALUES ($1,$2,$3,$4,$5)`,
      [resourceId, ref.name, ref.source, ref.reference, ref.required]
    );
  }
}

function mapResource(row: ResourceRow, latestChecks: ResourceCheckView[], checkCounts: Record<ResourceCheckOutcome, number>, secretRefs: SecretRefView[]): ResourceView {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    environment: row.environment,
    owner: row.owner,
    provider: row.provider,
    region: row.region,
    budgetCurrency: "CNY",
    monthlyBudgetCents: Number(row.monthly_budget_cents),
    backupReference: row.backup_reference,
    runbookUrl: row.runbook_url,
    notes: row.notes,
    revision: Number(row.revision),
    status: deriveStatus(checkCounts),
    checkCounts,
    secretRefs,
    latestChecks,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function deriveStatus(counts: Record<ResourceCheckOutcome, number>): ResourceView["status"] {
  if (counts.blocked) return "blocked";
  if (counts.failed) return "failed";
  if (counts.waiting) return "waiting";
  return counts.passed ? "operational" : "unknown";
}

function summarize(items: ResourceView[]): ResourceSummary {
  const summary = emptySummary();
  for (const item of items) {
    summary.total += 1;
    summary.monthlyBudgetCents += item.monthlyBudgetCents;
    summary.statusCounts[item.status] += 1;
    summary.secretRefCount += item.secretRefs.length;
    for (const outcome of RESOURCE_CHECK_OUTCOMES) summary.checkCounts[outcome] += item.checkCounts[outcome];
  }
  return summary;
}

function emptySummary(): ResourceSummary {
  return {
    total: 0,
    monthlyBudgetCents: 0,
    statusCounts: { operational: 0, failed: 0, blocked: 0, waiting: 0, unknown: 0 },
    checkCounts: emptyCheckCounts(),
    secretRefCount: 0,
  };
}
