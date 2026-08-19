import { Form, Input, Modal, Select, message } from "antd";
import { useState } from "react";

export interface PositionFormValues {
  company: string;
  title: string;
  city?: string;
  salary?: string;
  source?: string;
  jdRaw?: string;
  notes?: string;
}

export function PositionForm(props: {
  open: boolean;
  initialValues?: PositionFormValues;
  onCancel: () => void;
  onSubmit: (values: PositionFormValues) => Promise<void>;
}) {
  const [form] = Form.useForm<PositionFormValues>();
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      title="新建岗位"
      open={props.open}
      confirmLoading={saving}
      onCancel={props.onCancel}
      onOk={async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
          await props.onSubmit(values);
          form.resetFields();
        } catch (err) {
          message.error(String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <Form form={form} layout="vertical" initialValues={props.initialValues}>
        <Form.Item name="company" label="公司" rules={[{ required: true }]}>
          <Input placeholder="公司名" />
        </Form.Item>
        <Form.Item name="title" label="职位" rules={[{ required: true }]}>
          <Input placeholder="职位名" />
        </Form.Item>
        <Form.Item name="city" label="城市">
          <Input placeholder="工作城市" />
        </Form.Item>
        <Form.Item name="salary" label="薪资">
          <Input placeholder="如 20-30K·14薪" />
        </Form.Item>
        <Form.Item name="source" label="来源" initialValue="manual">
          <Select
            options={[
              { value: "manual", label: "手动录入" },
              { value: "jd_text", label: "JD 文本解析" },
              { value: "screenshot", label: "截图识别" },
            ]}
          />
        </Form.Item>
        <Form.Item name="jdRaw" label="JD 原文">
          <Input.TextArea rows={5} placeholder="粘贴 JD 原文（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
