import { Alert, Space, Table, message } from "antd";
import { useEffect, useState } from "react";
import { MtStatusTag, tokens } from "@mt/ui";
import { api, type Capability } from "../api";

export default function CapabilityList() {
  const [items, setItems] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.listCapabilities().then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, []);
  return <Space direction="vertical" size="middle" style={{ width: "100%" }}>
    <Alert type="info" message="能力基线记录源码中观察到的行为，不代表已经验收或部署，也不计入在办需求和完成率。" />
    <Table<Capability> rowKey="id" dataSource={items} loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 700 }}
      columns={[
        { title: "项目", dataIndex: "project", width: 130 },
        { title: "能力", dataIndex: "title" },
        { title: "实现证据", width: 140, render: () => <MtStatusTag tone="info">源码已观察</MtStatusTag> },
        { title: "验收 / 部署", width: 160, render: () => <MtStatusTag tone="neutral">尚未核验</MtStatusTag> },
        { title: "源提交", dataIndex: "sourceCommit", width: 130, render: (v: string) => <span style={{ fontFamily: tokens.font.mono }}>{v.slice(0, 12)}</span> },
      ]}
      expandable={{ expandedRowRender: (row) => <div>
        <p style={{ whiteSpace: "pre-wrap" }}>{row.description}</p>
        <ul>{row.candidatePayload.verification_gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>
        <Space direction="vertical">{row.candidatePayload.evidence.map((e, i) =>
          <a key={i} href={e.url} target="_blank" rel="noreferrer">{e.path}:{e.line}</a>)}</Space>
      </div> }} />
  </Space>;
}
