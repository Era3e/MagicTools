import { Button, Card, Select, Space, Table } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Position } from "../api";
import { StatusTag } from "../components/StatusTag";
import { PositionForm, type PositionFormValues } from "../components/PositionForm";

export default function PositionList() {
  const [items, setItems] = useState<Position[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.listPositions(status).then(setItems).catch((err) => console.error(err));
  }, [status]);

  return (
    <Card
      title="岗位列表"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="状态筛选"
            style={{ width: 140 }}
            value={status}
            onChange={(v) => setStatus(v)}
            options={[
              { value: "waiting", label: "待投递" },
              { value: "applied", label: "已投递" },
              { value: "written", label: "笔试" },
              { value: "interview", label: "面试" },
              { value: "offer", label: "offer" },
              { value: "rejected", label: "拒绝" },
            ]}
          />
          <Button type="primary" onClick={() => setCreating(true)}>
            新建岗位
          </Button>
        </Space>
      }
    >
      <Table<Position>
        rowKey="id"
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "公司", dataIndex: "company", render: (v: string, row) => <Link to={"/positions/" + row.id}>{v}</Link> },
          { title: "职位", dataIndex: "title" },
          { title: "城市", dataIndex: "city", width: 100 },
          { title: "状态", dataIndex: "status", width: 100, render: (v: string) => <StatusTag status={v} /> },
          { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (v: string) => new Date(v).toLocaleString() },
        ]}
      />
      <PositionForm
        open={creating}
        onCancel={() => setCreating(false)}
        onSubmit={async (values: PositionFormValues) => {
          await api.createPosition(values);
          setCreating(false);
          api.listPositions(status).then(setItems);
        }}
      />
    </Card>
  );
}
