import { Button, Table, message } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MtKpiRow, MtStatusTag, tokens } from "@mt/ui";

/**
 * FailLab — 采集源自动暂停失败演示（设计稿「失败演示 · 采集源自动暂停」复刻）。
 * 状态机：running --失败--> failing(count+1) --count>=3--> paused(自动)；成功归零；paused --手动启用--> recovering(1s) --> running。
 * 演示数据与真实源列表隔离（本地 state），右栏导演台提供 P1-P4 场景注入。
 */

type DemoStatus = "running" | "failing" | "paused" | "recovering";

interface DemoRow {
  id: string;
  name: string;
  type: string;
  status: DemoStatus;
  failCount: number;
  lastRunAt: string;
  todayCount: number;
}

const FAIL_THRESHOLD = 3;

const INITIAL_ROWS: DemoRow[] = [
  { id: "d1", name: "科技动态 RSS", type: "RSS", status: "running", failCount: 0, lastRunAt: "12:00:03", todayCount: 24 },
  { id: "d2", name: "行业报告 API", type: "JSON", status: "running", failCount: 0, lastRunAt: "11:58:41", todayCount: 12 },
  { id: "d3", name: "竞品官网快照", type: "WEB", status: "running", failCount: 0, lastRunAt: "11:55:20", todayCount: 6 },
  { id: "d4", name: "社区讨论聚合", type: "RSS", status: "running", failCount: 0, lastRunAt: "11:50:12", todayCount: 31 },
  { id: "d5", name: "期刊目录订阅", type: "RSS", status: "running", failCount: 0, lastRunAt: "11:45:08", todayCount: 9 },
];

const STATUS_META: Record<DemoStatus, { label: string; tone: "success" | "warning" | "error" | "info" }> = {
  running: { label: "运行中", tone: "success" },
  failing: { label: "失败中", tone: "warning" },
  paused: { label: "已自动暂停", tone: "error" },
  recovering: { label: "恢复中", tone: "info" },
};

export default function FailLab(_props: { sources?: unknown[]; onMutated?: () => void }) {
  const [rows, setRows] = useState<DemoRow[]>(INITIAL_ROWS);
  const [scene, setScene] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("选择场景开始演示 · 失败计数 1-2 次为 warning，第 3 次触发自动暂停");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runToken = useRef(0);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const patchRow = useCallback((id: string, patch: Partial<DemoRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const schedule = (fn: () => void, ms: number) => {
    const token = runToken.current;
    const t = setTimeout(() => {
      if (runToken.current !== token) return;
      fn();
    }, ms);
    timers.current.push(t);
  };

  const reset = () => {
    runToken.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRows(INITIAL_ROWS.map((r) => ({ ...r })));
    setScene(null);
    setBusy(false);
    setHint("已重置 · 演示数据与真实源隔离");
  };

  // P1：单次失败后成功归零
  const sceneP1 = () => {
    setBusy(true);
    setScene("P1");
    setHint("P1 演示中 · 单次失败 → 下轮成功 → 计数归零");
    patchRow("d1", { status: "failing", failCount: 1 });
    schedule(() => {
      patchRow("d1", { status: "running", failCount: 0, lastRunAt: now(), todayCount: 25 });
      setHint("P1 完成 · 失败计数已归零");
      setBusy(false);
    }, 1400);
  };

  // P2：连续失败 3 次触发自动暂停（1→2→3 递进）
  const sceneP2 = () => {
    setBusy(true);
    setScene("P2");
    setHint("P2 演示中 · 连续失败递进 1/3 → 2/3 → 3/3 触发暂停");
    patchRow("d2", { status: "failing", failCount: 1, lastRunAt: "ERR · " + now() });
    schedule(() => patchRow("d2", { failCount: 2 }), 1200);
    schedule(() => {
      patchRow("d2", { status: "paused", failCount: 3 });
      setHint("P2 完成 · 连续失败达阈值，源已自动暂停（不自动重试）");
      setBusy(false);
    }, 2400);
  };

  // P3：开关操作失败回弹（视觉先到位 → 400ms 回弹 + 错误提示）
  const sceneP3 = () => {
    setBusy(true);
    setScene("P3");
    setHint("P3 演示中 · 开关操作失败回弹 + 错误反馈");
    const before = rows.find((r) => r.id === "d3");
    patchRow("d3", { status: before?.status === "running" ? "paused" : "running" });
    schedule(() => {
      patchRow("d3", { status: before?.status ?? "running" });
      setHint("P3 完成 · 开关已回弹原位");
      setBusy(false);
    }, 400);
  };

  // P4：手动恢复（需先 P2 制造暂停态）
  const sceneP4 = () => {
    const target = rows.find((r) => r.id === "d2");
    if (!target || target.status !== "paused") {
      setHint("P4 前置不满足 · 请先执行 P2 制造自动暂停态");
      return;
    }
    setBusy(true);
    setScene("P4");
    setHint("P4 演示中 · 恢复中 → 1s 后运行 · 计数归零");
    patchRow("d2", { status: "recovering" });
    schedule(() => {
      patchRow("d2", { status: "running", failCount: 0, lastRunAt: "成功 · " + now(), todayCount: target.todayCount + 1 });
      setHint("P4 完成 · 恢复完成，连续失败计数已归零");
      setBusy(false);
    }, 1000);
  };

  const resume = (id: string) => {
    setBusy(true);
    patchRow(id, { status: "recovering" });
    schedule(() => {
      patchRow(id, { status: "running", failCount: 0, lastRunAt: "成功 · " + now() });
      setHint("恢复完成 · 连续失败计数已归零");
      setBusy(false);
    }, 1000);
  };

  const kpis = useMemo(
    () => [
      { label: "活跃源", value: rows.filter((r) => r.status === "running" || r.status === "failing").length, unit: "个" },
      { label: "阈值", value: FAIL_THRESHOLD, unit: "次" },
      { label: "已自动暂停", value: rows.filter((r) => r.status === "paused").length, unit: "个" },
      { label: "失败重试", value: rows.filter((r) => r.status === "recovering").length, unit: "个" },
    ],
    [rows]
  );

  return (
    <section aria-labelledby="faillab-title" style={{ marginTop: tokens.spacing.xl }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: tokens.spacing.md, marginBottom: tokens.spacing.md }}>
        <h2 id="faillab-title" style={{ margin: 0, fontFamily: tokens.font.display, fontSize: 22, fontWeight: 600, color: "inherit", display: "inline-flex", gap: tokens.spacing.sm, alignItems: "baseline" }}>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: tokens.dark.accent }}>04</span>
          失败演示 · 采集源自动暂停
        </h2>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.dark.textFaint }}>GATHERER · FAIL LAB</span>
      </div>
      <MtKpiRow items={kpis} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: tokens.spacing.lg, marginTop: tokens.spacing.md, alignItems: "start" }}>
        <Table<DemoRow>
          rowKey="id"
          dataSource={rows}
          pagination={false}
          size="small"
          columns={[
            { title: "源名称", dataIndex: "name" },
            { title: "类型", dataIndex: "type", width: 80, render: (v: string) => <MtStatusTag tone="neutral" mono>{v}</MtStatusTag> },
            {
              title: "状态",
              dataIndex: "status",
              width: 130,
              render: (v: DemoStatus) => (
                <span role={v === "paused" ? "alert" : undefined}>
                  <MtStatusTag tone={STATUS_META[v].tone} showDot={v === "running"}>
                    {STATUS_META[v].label}
                  </MtStatusTag>
                </span>
              ),
              onCell: (row) =>
                row.status === "paused"
                  ? { style: { background: tokens.dark.rowErrorBg, boxShadow: `inset 2px 0 0 ${tokens.scale.error[6]}` } }
                  : {},
            },
            {
              title: "连续失败",
              dataIndex: "failCount",
              width: 110,
              render: (v: number) => (
                <span style={{ fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600, color: v === 0 ? tokens.dark.textFaint : v >= FAIL_THRESHOLD ? tokens.color.error : tokens.color.warning }}>
                  {v === 0 ? "0 / 3" : v >= FAIL_THRESHOLD ? `${v} / 3 · 触发暂停` : `${v} / 3`}
                </span>
              ),
            },
            { title: "最后采集", dataIndex: "lastRunAt", width: 130, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: v.startsWith("成功") ? tokens.color.success : undefined }}>{v}</span> },
            { title: "今日条数", dataIndex: "todayCount", width: 90, align: "right", render: (v: number) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600 }}>{v}</span> },
            {
              title: "操作",
              width: 90,
              render: (_: unknown, row: DemoRow) =>
                row.status === "paused" ? (
                  <Button type="link" size="small" style={{ paddingInline: 0 }} disabled={busy} onClick={() => resume(row.id)}>
                    启用
                  </Button>
                ) : row.status === "running" ? (
                  <Button
                    type="link"
                    size="small"
                    style={{ paddingInline: 0 }}
                    disabled={busy}
                    onClick={() => {
                      patchRow(row.id, { status: "paused" });
                      message.info("演示：源已暂停");
                    }}
                  >
                    暂停
                  </Button>
                ) : (
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.dark.textFaint }}>—</span>
                ),
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
          {[
            { key: "P1", label: "P1 单次失败归零", run: sceneP1 },
            { key: "P2", label: "P2 自动暂停", run: sceneP2 },
            { key: "P3", label: "P3 开关回弹", run: sceneP3 },
            { key: "P4", label: "P4 手动恢复", run: sceneP4 },
          ].map((s) => (
            <Button
              key={s.key}
              disabled={busy}
              aria-pressed={scene === s.key}
              onClick={s.run}
              style={scene === s.key ? { borderColor: tokens.admin.accent, color: tokens.admin.accentHover } : undefined}
            >
              {s.label}
            </Button>
          ))}
          <div aria-live="polite" style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.dark.textTertiary, minHeight: 32, borderTop: `1px solid ${tokens.dark.hairline}`, paddingTop: tokens.spacing.sm }}>
            {hint}
          </div>
          <Button size="small" disabled={busy} onClick={reset}>
            重置演示
          </Button>
          <details style={{ fontSize: 12, color: tokens.dark.textTertiary }}>
            <summary style={{ cursor: "pointer", fontFamily: tokens.font.mono, fontSize: 11 }}>规格速览</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: tokens.font.mono, fontSize: 11, margin: "8px 0 0" }}>{`running --失败--> failing(count+1)
failing --成功--> running(count=0)
failing --count>=3--> paused(自动)
paused --手动启用--> recovering --1s--> running`}</pre>
          </details>
        </aside>
      </div>
    </section>
  );
}

function now(): string {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}
