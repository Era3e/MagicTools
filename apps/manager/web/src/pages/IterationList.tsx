import { Button, Card, Form, Input, List, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { api, type Iteration } from "../api";

export default function IterationList() {
  const [items, setItems] = useState<Iteration[]>([]);

  const refresh = () => api.listIterations().then(setItems);

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card title="迭代管理">
      <Form
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={async (values) => {
          await api.createIteration(values);
          message.success("已创建迭代");
          refresh();
        }}
      >
        <Form.Item name="name" rules={[{ required: true }]}>
          <Input placeholder="迭代名称" />
        </Form.Item>
        <Form.Item name="startDate">
          <Input type="date" placeholder="开始日期" />
        </Form.Item>
        <Form.Item name="endDate">
          <Input type="date" placeholder="结束日期" />
        </Form.Item>
        <Button type="primary" htmlType="submit">新建迭代</Button>
      </Form>
      <List
        dataSource={items}
        rowKey="id"
        renderItem={(it) => (
          <List.Item>
            <List.Item.Meta
              title={it.name}
              description={(it.startDate ?? "-") + " ~ " + (it.endDate ?? "-")}
            />
            <Tag>迭代</Tag>
          </List.Item>
        )}
      />
    </Card>
  );
}
