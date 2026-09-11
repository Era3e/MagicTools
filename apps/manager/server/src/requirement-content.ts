export type RequirementRisk = "unassessed" | "low" | "medium" | "high";

export interface RequirementContent {
  title: string;
  description: string;
  project: string;
  scope: string;
  risk: RequirementRisk;
  acceptanceCriteria: string[];
  dependencyRefs: string[];
  evidenceRefs: Array<Record<string, unknown>>;
}

export const CONTENT_FIELDS = ["title", "description", "project", "scope", "risk", "acceptanceCriteria", "dependencyRefs", "evidenceRefs"] as const;

export function getApprovalReadiness(content: RequirementContent) {
  const missing: string[] = [];
  if (!content.description.trim()) missing.push("需求描述");
  if (!content.project.trim()) missing.push("所属项目");
  if (!content.scope.trim()) missing.push("实施范围");
  if (!Array.isArray(content.acceptanceCriteria) || !content.acceptanceCriteria.length ||
      content.acceptanceCriteria.some((criterion) => typeof criterion !== "string" || !criterion.trim())) missing.push("验收条件");
  if (content.risk === "unassessed") missing.push("风险等级");
  return { ready: missing.length === 0, missing };
}
