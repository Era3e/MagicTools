import { Button, Card, Select, Space, Table, Tabs, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Position } from "../api";
import { StatusTag } from "../components/StatusTag";
import { PositionForm, type PositionFormValues } from "../components/PositionForm";
import { JdParsePanel } from "../components/JdParsePanel";
import { ImageUploadPanel } from "../components/ImageUploadPanel";

export default function PositionList() {
  const [items, setItems] = useState<Position[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState<PositionFormValues | undefined>();
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listPositions(status).then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
        loading={loading}
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
        key={JSON.stringify(prefill ?? {})}
        open={creating}
        initialValues={prefill}
        onCancel={() => {
          setCreating(false);
          setPrefill(undefined);
        }}
        onSubmit={async (values: PositionFormValues) => {
          await api.createPosition(values);
          setCreating(false);
          setPrefill(undefined);
          refresh();
        }}
        extraPanel={
          <Tabs
            items={[
              {
                key: "manual",
                label: "手动录入",
                children: null,
              },
              {
                key: "jd",
                label: "JD 解析",
                children: (
                  <JdParsePanel
                    onParsed={(values) => {
                      setPrefill(values);
                    }}
                  />
                ),
              },
              {
                key: "image",
                label: "截图识别",
                children: (
                  <ImageUploadPanel
                    onParsed={(values) => {
                      setPrefill(values);
                    }}
                  />
                ),
              },
            ]}
          />
        }
      />
    </Card>
  );
}
