import { Alert, Button, Checkbox, Table, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { MtKpiRow, MtStatusTag, tokens } from "@mt/ui";

/**
 * BatchLab — 批量分配部分成功反馈演示（设计稿「批量演示 · 部分成功反馈」复刻）。
 * 流程：idle → assigning（逐行 300ms 链：行内骨架 → 成功徽标 / 失败堆栈+重试链接）
 * → resolved | partial（复合 toast）| failed（错误条）。409 冲突不自动重试仅手动。
 */

type CellState = "idle" | "pending" | "ok" | "fail";

interface DemoRow {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  status: "待分配" | "评审中";
  cell: CellState;
  errCode?: string;
  errDesc?: string;
  checked: boolean;
}

const PRIORITY_TONE = { P0: "error", P1: "warning", P2: "info" } as const;

const INITIAL_ROWS: DemoRow[] = [
  { id: "RV-2026-0101", title: "招聘漏斗转化分析", priority: "P0", status: "待分配", cell: "idle", checked: true },
  { id: "RV-2026-0102", title: "用户留存队列拆解", priority: "P1", status: "待分配", cell: "idle", checked: true },
  { id: "RV-2026-0103", title: "竞品定价策略对照", priority: "P2", status: "待分配", cell: "idle", checked: false },
  { id: "RV-2026-0104", title: "渠道素材效果归因", priority: "P1", status: "待分配", cell: "idle", checked: false },
];

type Phase = "idle" | "assigning" | "resolved" | "partial" | "failed";

export default function BatchLab() {
  const [rows, setRows] = useState<DemoRow[]>(INITIAL_ROWS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorBar, setErrorBar] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runToken = useRef(0);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const schedule = (fn: () => void, ms: number) => {
    const token = runToken.current;
    const t = setTimeout(() => {
      if (runToken.current !== token) return;
      fn();
    }, ms);
    timers.current.push(t);
  };

  const selected = rows.filter((r) => r.checked && r.cell !== "ok");
  const failCount = rows.filter((r) => r.cell === "fail").length;
  const okCount = rows.filter((r) => r.cell === "ok").length;

  const kpis = useMemo(
    () => [
      { label: "待审", value: rows.filter((r) => r.status === "待分配").length, unit: "条" },
      { label: "本批成功", value: okCount, unit: "条" },
      { label: "本批失败", value: failCount, unit: "条" },
      { label: "批次状态", value: phase === "idle" ? "—" : phase, unit: "" },
    ],
    [rows, okCount, failCount, phase]
  );

  const reset = () => {
    runToken.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRows(INITIAL_ROWS.map((r) => ({ ...r })));
    setPhase("idle");
    setErrorBar(null);
  };

  /** mode: all-ok / partial(2成2败) / all-fail */
  const runBatch = (mode: "all-ok" | "partial" | "all-fail") => {
    if (phase === "assigning") return;
    if (selected.length === 0) {
      message.info("请先勾选目标行");
      return;
    }
    runToken.current += 1;
    setErrorBar(null);
    setPhase("assigning");
    const targets = rows.filter((r) => r.checked && r.cell !== "ok");
    targets.forEach((row, i) => {
      schedule(() => {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, cell: "pending" } : r)));
      }, i * 300);
      schedule(() => {
        const fail =
          mode === "all-fail" ||
          (mode === "partial" && (i === 1 || i === (targets.length > 1 ? 1 : 0) === false ? i % 2 === 1 : true));
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? fail
                ? {
                    ...r,
                    cell: "fail",
                    status: "待分配",
                    errCode: i % 2 === 0 ? "ERR-ASSIGN-409" : "ERR-API-500",
                    errDesc: i % 2 === 0 ? "评审人负荷已满" : "服务暂时不可用",
                  }
                : { ...r, cell: "ok", status: "评审中", checked: false }
              : r
          )
        );
      }, i * 300 + 300);
    });
    schedule(() => {
      setRows((prev) => {
        const succ = prev.filter((r) => r.cell === "ok").length;
        const fail = prev.filter((r) => r.cell === "fail").length;
        if (fail === 0) {
          setPhase("resolved");
          message.success(`分配成功 已分配 ${succ}/${succ}`);
        } else if (succ === 0) {
          setPhase("failed");
          setErrorBar(`ERR-API-500 · 分配失败 ${fail}/${fail} · 服务暂时不可用`);
          message.error(`分配失败 ${fail}/${fail}`);
        } else {
          setPhase("partial");
          message.warning(`部分成功 成功 ${succ} · 失败 ${fail}`, 4);
        }
        return prev;
      });
    }, targets.length * 300 + 320);
  };

  const retryFailed = () => {
    if (failCount === 0) {
      message.info("当前无失败行");
      return;
    }
    runToken.current += 1;
    setErrorBar(null);
    setPhase("assigning");
    const failed = rows.filter((r) => r.cell === "fail");
    failed.forEach((row, i) => {
      schedule(() => {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, cell: "pending", errCode: undefined, errDesc: undefined } : r)));
      }, i * 300);
      schedule(() => {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, cell: "ok", status: "评审中", checked: false } : r)));
      }, i * 300 + 300);
    });
    schedule(() => {
      setRows((prev) => {
        const succ = prev.filter((r) => r.cell === "ok").length;
        const fail = prev.filter((r) => r.cell === "fail").length;
        if (fail === 0) {
          setPhase("resolved");
          message.success(`分配成功 已分配 ${succ}/${succ}`);
        } else {
          setPhase("partial");
          message.warning(`部分成功 成功 ${succ} · 失败 ${fail}`, 4);
        }
        return prev;
      });
    }, failed.length * 300 + 320);
  };

  return (
    <section aria-labelledby="batchlab-title" style={{ marginTop: tokens.spacing.xl }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: tokens.spacing.md, marginBottom: tokens.spacing.md, flexWrap: "wrap" }}>
        <h2 id="batchlab-title" style={{ margin: 0, fontFamily: tokens.font.display, fontSize: 22, fontWeight: 600, color: "inherit", display: "inline-flex", gap: tokens.spacing.sm, alignItems: "baseline" }}>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: tokens.dark.accent }}>04</span>
          批量演示 · 部分成功反馈
        </h2>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.dark.textFaint }}>ASSESSOR · BATCH LAB</span>
      </div>
      <MtKpiRow items={kpis} />
      {errorBar ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          style={{ marginTop: tokens.spacing.md, fontFamily: tokens.font.mono, fontSize: 12 }}
          message={errorBar}
          action={
            <Button size="small" danger onClick={retryFailed}>
              重试
            </Button>
          }
        />
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: tokens.spacing.lg, marginTop: tokens.spacing.md, alignItems: "start" }}>
        <Table<DemoRow>
          rowKey="id"
          dataSource={rows}
          pagination={false}
          size="small"
          columns={[
            {
              title: "",
              width: 40,
              render: (_: unknown, row: DemoRow) => (
                <Checkbox
                  aria-label={"选择 " + row.id}
                  checked={row.checked}
                  disabled={row.cell === "ok" || phase === "assigning"}
                  onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, checked: e.target.checked } : r)))}
                />
              ),
            },
            { title: "编号", dataIndex: "id", width: 130, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600, color: tokens.scale.ink[3] }}>{v}</span> },
            { title: "标题", dataIndex: "title" },
            { title: "优先级", dataIndex: "priority", width: 80, render: (v: keyof typeof PRIORITY_TONE) => <MtStatusTag tone={PRIORITY_TONE[v]} mono>{v}</MtStatusTag> },
            { title: "状态", dataIndex: "status", width: 90, render: (v: DemoRow["status"]) => <MtStatusTag tone={v === "评审中" ? "info" : "warning"}>{v}</MtStatusTag> },
            {
              title: "分配结果",
              width: 220,
              render: (_: unknown, row: DemoRow) => {
                if (row.cell === "pending")
                  return (
                    <span
                      aria-label="分配中"
                      style={{
                        display: "inline-block",
                        width: 48,
                        height: 22,
                        borderRadius: tokens.radiusTokens.sm,
                        background: tokens.dark.surface2,
                        backgroundImage: `linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)`,
                        backgroundSize: "48px 22px",
                        animation: "mt-shimmer 320ms linear infinite",
                      }}
                    />
                  );
                if (row.cell === "ok") return <MtStatusTag tone="success">✓ 已分配</MtStatusTag>;
                if (row.cell === "fail")
                  return (
                    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                      <MtStatusTag tone="error">✗ 分配失败</MtStatusTag>
                      <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.dark.textFaint }}>
                        {row.errCode} · {row.errDesc} ·{" "}
                        <a onClick={retryFailed} style={{ fontSize: 11, cursor: "pointer" }}>
                          重试
                        </a>
                      </span>
                    </span>
                  );
                return <span style={{ color: tokens.dark.textFaint }}>—</span>;
              },
            },
          ]}
        />
        <aside
          aria-label="导演台"
          style={{
            position: "sticky",
            top: 68,
            padding: tokens.spacing.md,
            background: tokens.dark.surface1,
            border: `1px solid ${tokens.dark.hairline}`,
            borderRadius: tokens.radiusTokens.md,
            boxShadow: tokens.shadow.darkCard,
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing.sm,
          }}
        >
          <span style={{ fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: tokens.dark.textFaint }}>导演台 · SCENARIOS</span>
          <Button disabled={phase === "assigning"} onClick={() => runBatch("all-ok")}>
            B1 全部成功
          </Button>
          <Button disabled={phase === "assigning"} onClick={() => runBatch("partial")}>
            B2 部分成功（2 成 2 败）
          </Button>
          <Button disabled={phase === "assigning"} onClick={() => runBatch("all-fail")}>
            B3 全部失败
          </Button>
          <Button disabled={phase === "assigning"} onClick={retryFailed}>
            B4 失败行重试
          </Button>
          <div aria-live="polite" style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.dark.textTertiary, minHeight: 32, borderTop: `1px solid ${tokens.dark.hairline}`, paddingTop: tokens.spacing.sm }}>
            batch.status={phase} · selected={selected.length} · ok-fail={okCount}-{failCount}
          </div>
          <Button size="small" disabled={phase === "assigning"} onClick={reset}>
            重置演示
          </Button>
          <details style={{ fontSize: 12, color: tokens.dark.textTertiary }}>
            <summary style={{ cursor: "pointer", fontFamily: tokens.font.mono, fontSize: 11 }}>规格速览</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: tokens.font.mono, fontSize: 11, margin: "8px 0 0" }}>{`idle → assigning(逐行300ms)
→ resolved | partial(复合反馈) | failed(错误条)
ERR-ASSIGN-409 不自动重试仅手动`}</pre>
          </details>
        </aside>
      </div>
      <style>{`@keyframes mt-shimmer { 0% { background-position: -48px 0; } 100% { background-position: 48px 0; } }`}</style>
    </section>
  );
}
