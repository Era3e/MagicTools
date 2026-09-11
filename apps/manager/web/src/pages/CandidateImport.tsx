import { Alert, Button, Input, Modal, Space, Table, Typography } from "antd";
import { useRef, useState } from "react";
import { MtStatusTag, tokens } from "@mt/ui";
import { api, type Candidate, type ImportPreview, type ImportResult } from "../api";

export default function CandidateImport({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileReadGeneration = useRef(0);

  const resetInput = (value: string) => { setText(value); setPreview(null); setResult(null); setSelected([]); setError(""); };
  const loadFile = async (file?: File) => {
    if (!file) return;
    const generation = ++fileReadGeneration.current;
    resetInput("");
    setBusy(true);
    try {
      if (file.size > 90 * 1024) throw new Error("文件超过 90 KiB，请拆分批次");
      const value = await file.text();
      if (generation === fileReadGeneration.current) resetInput(value);
    } catch (err) {
      if (generation === fileReadGeneration.current) setError(err instanceof Error ? err.message : "读取文件失败");
    } finally {
      if (generation === fileReadGeneration.current) setBusy(false);
    }
  };

  const runPreview = async () => {
    setBusy(true); setError(""); setResult(null); setPreview(null); setSelected([]);
    try {
      const next = await api.previewCandidates(JSON.parse(text));
      setPreview(next);
      setSelected(next.status === "previewed" ? next.candidates.filter((c) => c.disposition === "new").map((c) => c.candidate_id) : []);
      setResult(next.result);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      const saved = await api.confirmCandidates(preview.id, preview.revision, selected);
      setResult(saved);
      setPreview({ ...preview, status: "confirmed", counts: { ...preview.counts, new: 0 } });
      onImported();
      setPreview(await api.getImportBatch(preview.id));
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const continueRemaining = async () => {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      const remaining = await api.previewRemainingCandidates(preview.id);
      setPreview(remaining); setResult(null);
      setSelected(remaining.candidates.filter((c) => c.disposition === "new").map((c) => c.candidate_id));
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  return <Modal title="导入需求候选" open={open} width={1000} onCancel={busy ? undefined : onClose}
    maskClosable={!busy} closable={!busy} footer={<Space>
      <Button disabled={busy} onClick={onClose}>关闭</Button>
      <Button type="primary" loading={busy} disabled={!preview || preview.status !== "previewed" || !selected.length}
        onClick={() => { void confirm(); }}>确认导入选中项</Button>
    </Space>}>
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert type="info" showIcon message="先预览，再确认选中的内容"
        description="能力基线单独归档，验收和部署状态仍待核验；规划需求保持待分析、人工开发，不会自动领取执行。" />
      <label>选择候选 JSON 文件（最多 90 KiB / 200 条）
        <input type="file" accept=".json,application/json" disabled={busy} aria-label="选择候选 JSON 文件"
          onChange={(event) => { void loadFile(event.target.files?.[0]); }} />
      </label>
      <Input.TextArea aria-label="候选 JSON" disabled={busy} rows={5} value={text}
        onChange={(event) => resetInput(event.target.value)} placeholder="也可以在这里粘贴候选数据 JSON" />
      <Button disabled={!text.trim()} loading={busy} onClick={() => { void runPreview(); }}>预览候选</Button>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {result ? <Alert type="success" showIcon
        message={`导入完成：能力基线 ${result.created.baseline} 条，规划需求 ${result.created.planned} 条`}
        description="记录已保存；重复候选复用已有记录，未覆盖人工内容。" /> : null}
      {preview ? <>
        <Typography.Paragraph>来源：{preview.repository} · 提交 {preview.sourceCommit.slice(0, 12)}</Typography.Paragraph>
        <Space wrap>
          <MtStatusTag tone="info">能力基线 {preview.counts.baseline}</MtStatusTag>
          <MtStatusTag tone="accent">规划需求 {preview.counts.planned}</MtStatusTag>
          <MtStatusTag tone="success">新增 {preview.counts.new}</MtStatusTag>
          <MtStatusTag tone="neutral">重复 {preview.counts.duplicate}</MtStatusTag>
          <MtStatusTag tone="warning">冲突 {preview.counts.conflict}</MtStatusTag>
        </Space>
        {preview.counts.conflict > 0 ? <Alert type="warning" message="冲突候选不能直接覆盖，请比较已有记录后重新整理候选。" /> : null}
        {preview.status === "confirmed" && preview.counts.new > 0 ?
          <Button disabled={busy} onClick={() => { void continueRemaining(); }}>继续预览未选候选</Button> : null}
        <Table<Candidate> rowKey="candidate_id" dataSource={preview.candidates} size="small" pagination={{ pageSize: 8 }} scroll={{ x: 680 }}
          rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys.map(String)),
            getCheckboxProps: (row) => ({ disabled: busy || preview.status === "confirmed" || row.disposition === "conflict" }) }}
          expandable={{ expandedRowRender: (row) => <div style={{ whiteSpace: "pre-wrap" }}>
            <p>{row.description}</p>
            <ul>{[...row.acceptance_criteria, ...row.verification_gaps].map((item, i) => <li key={i}>{item}</li>)}</ul>
            <Space direction="vertical">{row.evidence.map((e, i) => <a key={i} href={e.url} target="_blank" rel="noreferrer">{e.path}:{e.line}</a>)}</Space>
          </div> }}
          columns={[
            { title: "编号", dataIndex: "candidate_id", width: 120, render: (v: string) => <span style={{ fontFamily: tokens.font.mono }}>{v}</span> },
            { title: "项目", dataIndex: "project", width: 110 },
            { title: "标题", dataIndex: "title" },
            { title: "类别", dataIndex: "record_kind", width: 105, render: (v: string) => v === "baseline" ? "能力基线" : "规划需求" },
            { title: "处理", dataIndex: "disposition", width: 80, render: (v: string) => ({ new: "新增", duplicate: "复用", conflict: "冲突" })[v] ?? v },
          ]} />
      </> : null}
    </Space>
  </Modal>;
}
