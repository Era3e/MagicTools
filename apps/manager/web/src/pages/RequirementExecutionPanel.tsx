import { Alert, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { MtStatusTag, tokens, useTheme } from "@mt/ui";
import { api, type ExecutionJob, type Requirement } from "../api";

const JOB_TONE = {
  queued: "neutral", running: "info", retry: "warning", succeeded: "success", failed: "error", cancelled: "neutral",
} as const;

const RUN_TONE = {
  running: "info", succeeded: "success", failed: "error", expired: "warning", cancelled: "neutral",
} as const;

export default function RequirementExecutionPanel({ item }: { item: Requirement }) {
  const theme = useTheme();
  const [jobs, setJobs] = useState<ExecutionJob[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setJobs(null); setError("");
    api.listExecutionJobs(item.id).then((value) => { if (active) setJobs(value); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : String(err)); });
    return () => { active = false; };
  }, [item.id, item.updatedAt]);

  const border = theme.border ?? tokens.color.border;
  const panel = theme.panel ?? theme.background;
  const muted = theme.muted;
  const latest = jobs?.[0];

  return <section aria-labelledby="requirement-execution-title" style={{
    border: "1px solid " + border, background: panel, padding: tokens.spacing.md, marginBottom: tokens.spacing.md,
  }}>
    <div style={{ display: "flex", gap: tokens.spacing.sm, alignItems: "center", flexWrap: "wrap", marginBottom: tokens.spacing.sm }}>
      <h3 id="requirement-execution-title" style={{ margin: 0 }}>执行进度与待验收</h3>
      <MtStatusTag tone="info" mono>PR 状态：{item.prState ?? "unknown"}</MtStatusTag>
      <MtStatusTag tone={item.deploymentState === "succeeded" ? "success" : item.deploymentState === "failed" ? "error" : "neutral"} mono>
        部署状态：{item.deploymentState ?? "not-started"}
      </MtStatusTag>
      {item.deploymentUrl ? <a href={item.deploymentUrl} target="_blank" rel="noreferrer">部署回执</a> : null}
    </div>
    <p style={{ color: muted, marginTop: 0 }}>执行成功只代表候选通过契约验收，产品验收仍需人工确认；PR 合并与部署状态分别记录。</p>
    {error ? <Alert type="error" showIcon message={"执行任务读取失败：" + error} /> : null}
    {!error && !jobs ? <Skeleton active paragraph={{ rows: 3 }} /> : null}
    {!error && jobs && !jobs.length ? (
      <Alert type="info" showIcon message="暂无自动执行任务" description="该需求尚未通过 owner 凭证排队自动执行。" />
    ) : null}
    {latest ? <div style={{ display: "grid", gap: tokens.spacing.sm }}>
      <div style={{ border: "1px solid " + border, padding: tokens.spacing.sm }}>
        <div style={{ display: "flex", gap: tokens.spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
          <MtStatusTag tone={JOB_TONE[latest.status]} mono>job {latest.status}</MtStatusTag>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: muted }}>
            尝试 {latest.attempts}/{latest.maxAttempts} · 内容修订 r{latest.contentRevision}
          </span>
          {latest.finishedAt ? <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: muted }}>
            完成 {new Date(latest.finishedAt).toLocaleString()}
          </span> : null}
        </div>
        {latest.cancellationReason ? <p style={{ marginBottom: 0 }}>取消原因：{latest.cancellationReason}</p> : null}
      </div>
      {latest.runs.map((run) => {
        const result = run.result;
        return <article key={run.id} style={{ border: "1px solid " + border, padding: tokens.spacing.sm }}>
          <div style={{ display: "flex", gap: tokens.spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
            <MtStatusTag tone={RUN_TONE[run.status]} mono>run #{run.attempt} {run.status}</MtStatusTag>
            <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: muted }}>{run.executorId}</span>
            <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: muted }}>
              心跳 {new Date(run.heartbeatAt).toLocaleString()}
            </span>
          </div>
          {run.error ? <Alert type={run.status === "expired" ? "warning" : "error"} showIcon message={run.error} style={{ marginTop: tokens.spacing.sm }} /> : null}
          {result?.candidateSha ? <div style={{ marginTop: tokens.spacing.sm, fontFamily: tokens.font.mono, fontSize: 12, overflowWrap: "anywhere" }}>
            <div>candidate {result.candidateSha}</div>
            <div>base {result.baseSha}</div>
            {result.branch ? <div>branch {result.branch}</div> : null}
          </div> : null}
          {result?.prUrl ? <p style={{ marginBottom: 0 }}>
            <a href={result.prUrl} target="_blank" rel="noreferrer">打开候选 PR / 预览入口</a>
          </p> : null}
          {result?.acceptance?.length ? <div style={{ marginTop: tokens.spacing.sm }}>
            <strong>独立验收</strong>
            <ul style={{ margin: `${tokens.spacing.xs} 0 0`, paddingLeft: 20 }}>
              {result.acceptance.map((entry, index) => <li key={index} style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                {entry.status} · exit {entry.exitCode} · {entry.durationMs}ms
              </li>)}
            </ul>
          </div> : null}
          {result?.evidence ? <div style={{ marginTop: tokens.spacing.sm, fontFamily: tokens.font.mono, fontSize: 12, color: muted, overflowWrap: "anywhere" }}>
            <div>evidence {result.evidence.path}</div>
            <div>sha256 {result.evidence.sha256}</div>
          </div> : null}
        </article>;
      })}
    </div> : null}
  </section>;
}
