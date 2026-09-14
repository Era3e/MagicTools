import { Button, Card, Input, Space, Table, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHead, AdminToolbar, AdminToolbarCount, MtKpiRow, MtStatusTag, tokens } from "@mt/ui";
import { api, type EvidenceCandidate, type EvidenceTaskListItem } from "../api";

const CATEGORY_LABEL: Record<string, string> = {
  routes: "路由",
  controller: "接口",
  service: "业务",
  schema: "契约",
  tests: "测试",
};

export default function RepositoryEvidence() {
  const [items, setItems] = useState<EvidenceTaskListItem[]>([]);
  const [repo, setRepo] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<EvidenceCandidate[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await api.listEvidenceTasks()).items);
    } catch (error) {
      message.error(String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await api.reverseEngineer({ repo, commitSha });
      setSelected(result.candidates);
      message.success(`采集完成：${result.task.totalFiles} 个变更文件，命中 ${result.task.selectedFiles} 个源码证据`);
      await refresh();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const kpis = useMemo(() => [
    { label: "采集任务", value: items.length, unit: "个" },
    { label: "候选证据", value: items.reduce((sum, item) => sum + item.candidateCount, 0), unit: "条" },
    { label: "最近提交", value: items[0]?.commitSha.slice(0, 7) ?? "—", unit: "" },
    { label: "动机未知", value: "全部", unit: "" },
  ], [items]);

  return (
    <div>
      <AdminPageHead
        eyebrow="ADMIN · REPOSITORY EVIDENCE"
        title="仓库证据反向整理"
        badges={<MtStatusTag tone="neutral" mono>SHA · EVIDENCE</MtStatusTag>}
        description="按指定提交读取路由、Controller、Service、Schema 与测试文件，生成带源码行号的反向需求证据"
        actions={<Button type="primary" loading={submitting} disabled={!repo || !commitSha} onClick={submit}>反向整理</Button>}
        kpi={<MtKpiRow items={kpis} />}
      />
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>
            <label htmlFor="repository-evidence-repo" style={{ display: "block", marginBottom: 4 }}>GitHub 仓库</label>
            <Input id="repository-evidence-repo" style={{ width: 280 }} value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="owner/repo" />
          </span>
          <span>
            <label htmlFor="repository-evidence-sha" style={{ display: "block", marginBottom: 4 }}>提交 SHA</label>
            <Input id="repository-evidence-sha" style={{ width: 360 }} value={commitSha} onChange={(event) => setCommitSha(event.target.value)} placeholder="7-40 位 commit SHA" />
          </span>
        </Space>
      </Card>
      <AdminToolbar>
        <AdminToolbarCount>共 {items.length} 个采集任务 · 超过200个变更文件会显式失败</AdminToolbarCount>
      </AdminToolbar>
      <Table<EvidenceTaskListItem>
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10 }}
        onRow={(record) => ({ onClick: () => void api.getEvidenceTask(record.id).then((detail) => setSelected(detail.candidates)).catch((error) => message.error(String(error))) })}
        columns={[
          { title: "仓库", dataIndex: "repo", ellipsis: true },
          { title: "提交", dataIndex: "commitSha", width: 110, render: (value: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{value.slice(0, 8)}</span> },
          { title: "提交信息", dataIndex: "commitMessage", ellipsis: true },
          { title: "变更/命中", dataIndex: "totalFiles", width: 110, align: "right", render: (value: number, row) => `${value}/${row.selectedFiles}` },
          { title: "候选", dataIndex: "candidateCount", width: 80, align: "right" },
        ]}
      />
      {selected.length ? (
        <Card size="small" title="反向整理候选" style={{ marginTop: 16 }}>
          <Table<EvidenceCandidate>
            rowKey="id"
            dataSource={selected}
            pagination={false}
            columns={[
              { title: "类型", dataIndex: "category", width: 80, render: (value: string) => <Tag>{CATEGORY_LABEL[value] ?? value}</Tag> },
              { title: "候选", dataIndex: "title", ellipsis: true },
              { title: "动机", dataIndex: "motivation", width: 90, render: () => <Tag>unknown</Tag> },
              { title: "证据", dataIndex: "evidence", width: 260, render: (value: EvidenceCandidate["evidence"]) => (
                <a href={value.url} target="_blank" rel="noreferrer" style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                  {value.path}#L{value.startLine}-L{value.endLine}
                </a>
              ) },
              { title: "片段", dataIndex: "evidence", render: (value: EvidenceCandidate["evidence"]) => (
                <Typography.Text code style={{ whiteSpace: "pre-wrap" }}>{value.excerpt}</Typography.Text>
              ) },
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}
