import { useEffect, useState } from "react";
import { Button, Card, Modal, Space, Table, Tag, Typography, message } from "antd";
import { api, downloadText, type ComponentItem } from "../api";

export default function ComponentList() {
  const [items, setItems] = useState<ComponentItem[]>([]);
  const [viewing, setViewing] = useState<ComponentItem | null>(null);

  const refresh = () => api.listComponents().then(setItems).catch((err) => message.error(String(err)));

  useEffect(() => {
    refresh();
  }, []);

  const remove = async (id: string) => {
    try {
      await api.deleteComponent(id);
      message.success("已删除");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card title="组件库">
      <Table<ComponentItem>
        rowKey="id"
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "名称", dataIndex: "name", render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
          { title: "描述", dataIndex: "description", render: (v: string) => v || "-" },
          {
            title: "沉淀时间",
            dataIndex: "createdAt",
            width: 180,
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: "操作",
            width: 240,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => setViewing(row)}>查看</Button>
                <Button size="small" onClick={() => downloadText(row.name + ".tsx", row.code)}>下载</Button>
                <Button size="small" danger onClick={() => remove(row.id)}>删除</Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={viewing?.name} open={Boolean(viewing)} onCancel={() => setViewing(null)} footer={null} width={720}>
        {viewing ? (
          <>
            <Tag>{viewing.description || "无描述"}</Tag>
            <pre style={{ maxHeight: 420, overflow: "auto", background: "#f6f6f6", padding: 12, borderRadius: 6 }}>
              {viewing.code}
            </pre>
          </>
        ) : null}
      </Modal>
    </Card>
  );
}
