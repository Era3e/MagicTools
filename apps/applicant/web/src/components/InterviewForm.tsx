import { Button, Form, Input, InputNumber } from "antd";
import { useState } from "react";

export function InterviewForm(props: { onSubmit: (values: { round: number; qaNotes: string; reflection: string }) => Promise<void> }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={async (values) => {
        setSaving(true);
        try {
          await props.onSubmit(values);
          form.resetFields();
        } finally {
          setSaving(false);
        }
      }}
    >
      <Form.Item name="round" label="轮次" initialValue={1}>
        <InputNumber min={1} max={10} />
      </Form.Item>
      <Form.Item name="qaNotes" label="问答记录" rules={[{ required: true }]}>
        <Input.TextArea rows={6} placeholder="问了什么，我怎么答的" />
      </Form.Item>
      <Form.Item name="reflection" label="自我反思">
        <Input.TextArea rows={3} placeholder="哪里答得不好，为什么" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving}>
        保存复盘
      </Button>
    </Form>
  );
}
