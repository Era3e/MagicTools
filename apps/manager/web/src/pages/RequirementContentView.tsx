import { Space } from "antd";
import { tokens } from "@mt/ui";
import type { Requirement, RequirementContent, RequirementRisk } from "../api";

export const RISK_LABELS: Record<RequirementRisk, string> = { unassessed: "尚未评估", low: "低", medium: "中", high: "高" };
export const CONTENT_LABELS: Record<string, string> = {
  title: "标题", description: "描述", project: "所属项目", scope: "实施范围", risk: "风险",
  acceptanceCriteria: "验收条件", dependencyRefs: "前置候选", evidenceRefs: "来源证据",
};
export function contentFromRequirement(item: Requirement): RequirementContent {
  return { title: item.title, description: item.description, project: item.project ?? "", scope: item.scope ?? "",
    risk: item.risk ?? "unassessed", acceptanceCriteria: [...item.acceptanceCriteria ?? []],
    dependencyRefs: [...item.dependencyRefs ?? []], evidenceRefs: [...item.evidenceRefs ?? []] };
}

export default function RequirementContentView({ content }: { content: RequirementContent }) {
  return <div style={{ overflowWrap: "anywhere" }}>
    <h4>{content.title}</h4>
    <p style={{ whiteSpace: "pre-wrap" }}>{content.description || "尚未填写描述"}</p>
    <p>所属项目：{content.project || "尚未填写"} · 风险：{RISK_LABELS[content.risk]}</p>
    <h5>实施范围</h5><p style={{ whiteSpace: "pre-wrap" }}>{content.scope || "尚未填写"}</p>
    <h5>验收条件</h5>
    {content.acceptanceCriteria.length ? <ul>{content.acceptanceCriteria.map((value, i) => <li key={i}>{value}</li>)}</ul> : <p>尚未填写</p>}
    {content.dependencyRefs.length ? <p>前置候选：{content.dependencyRefs.join("、")}（执行前仍需核验依赖）</p> : null}
    <Space direction="vertical" size={tokens.spacing.xs}>{content.evidenceRefs.map((ref, i) =>
      <a key={i} href={ref.url} target="_blank" rel="noreferrer">{ref.path}:{ref.line}</a>)}</Space>
  </div>;
}
