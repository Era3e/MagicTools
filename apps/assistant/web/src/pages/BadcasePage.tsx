import { useEffect, useState } from "react";
import { Button, Card, Input, message, Table, Tag } from "antd";
import { api, type Badcase } from "../api";

export default function BadcasePage() {
  const [items, setItems] = useState<Badcase[]>([]);
  const [expected, setExpected] = useState<Record<string, string>>({});

  const refresh = () => api.listBadcases().then(setItems).catch((err) => message.error(String(err)));
  useEffect(() => { void refresh(); }, []);

  const confirm = async (row: Badcase) => {
    try {
      const parsed = JSON.parse(expected[row.id] || "{}") as Record<string, unknown>;
      await api.confirmBadcase(row.id, {
        title: row.title,
        description: row.description,
        stage: row.stage,
        severity: row.severity,
        expected: parsed,
      });
      message.success("已确认分类");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  const run = async (fn: () => Promise<Badcase>, success: string) => {
    try {
      await fn();
      message.success(success);
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card title="Badcase 闭环">
      <Table<Badcase>
        rowKey="id"
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "标题", dataIndex: "title", ellipsis: true },
          { title: "来源", dataIndex: "source", width: 110 },
          { title: "阶段", dataIndex: "stage", width: 100 },
          { title: "状态", dataIndex: "status", width: 130, render: (v: string) => <Tag color={v === "closed" ? "success" : v === "rejected" ? "default" : "processing"}>{v}</Tag> },
          {
            title: "期望 JSON",
            width: 260,
            render: (_, row) => (
              <Input.TextArea
                aria-label={`expected-${row.id}`}
                rows={2}
                value={expected[row.id] ?? JSON.stringify(row.expected ?? {}, null, 2)}
                onChange={(event) => setExpected((old) => ({ ...old, [row.id]: event.target.value }))}
              />
            ),
          },
          {
            title: "操作",
            width: 250,
            render: (_, row) => (
              <>
                <Button size="small" onClick={() => confirm(row)}>确认</Button>
                <Button size="small" disabled={!["classified", "confirmed"].includes(row.status)} onClick={() => run(() => api.createBadcaseRegression(row.id), "回归样本已生成")}>回归</Button>
                <Button size="small" disabled={row.status !== "regression_ready" || Boolean(row.requirementId)} onClick={() => run(() => api.createBadcaseRequirement(row.id), "需求已创建")}>需求</Button>
              </>
            ),
          },
        ]}
      />
    </Card>
  );
}
