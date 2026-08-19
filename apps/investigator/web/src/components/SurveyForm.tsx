import { Form, Input, Modal, message } from "antd";
import { useState } from "react";

export interface SurveyFormValues {
  name: string;
  description?: string;
  appToken?: string;
  tableId?: string;
  answerFieldsText?: string;
}

export function SurveyForm(props: {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: SurveyFormValues) => Promise<void>;
}) {
  const [form] = Form.useForm<SurveyFormValues>();
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      title="新建调研主题"
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
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="主题名称" rules={[{ required: true }]}>
          <Input placeholder="如：2026 年度产品满意度调研" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="调研背景与目标（可选）" />
        </Form.Item>
        <Form.Item name="appToken" label="多维表格 app_token" rules={[{ required: true }]}>
          <Input placeholder="URL 中 base/ 后的字符串" />
        </Form.Item>
        <Form.Item name="tableId" label="数据表 table_id" rules={[{ required: true }]}>
          <Input placeholder="URL 中 table= 后的字符串" />
        </Form.Item>
        <Form.Item name="answerFieldsText" label="回答字段（逗号分隔，可多个）" rules={[{ required: true }]}>
          <Input placeholder="如：回答,建议" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
