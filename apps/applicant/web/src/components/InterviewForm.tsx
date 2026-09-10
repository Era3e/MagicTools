import { Button, DatePicker, Form, Input, InputNumber } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";

export interface InterviewSubmitValues {
  round: number;
  happenedAt: string;
  qaNotes: string;
  reflection: string;
  status: "scheduled" | "done";
}

export function InterviewForm(props: { onSubmit: (values: InterviewSubmitValues) => Promise<void> }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const submit = async (status: "scheduled" | "done") => {
    let values: Record<string, unknown>;
    try {
      values = status === "scheduled" ? await form.validateFields(["round", "happenedAt"]) : await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const at: Dayjs = (values.happenedAt as Dayjs | undefined) ?? dayjs();
      await props.onSubmit({
        round: values.round as number,
        happenedAt: at.toISOString(),
        qaNotes: status === "scheduled" ? "" : (values.qaNotes as string),
        reflection: ((values.reflection as string) ?? ""),
        status,
      });
      form.resetFields();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="round" label="轮次" initialValue={1}>
        <InputNumber min={1} max={10} />
      </Form.Item>
      <Form.Item name="happenedAt" label="面试时间" initialValue={dayjs()}>
        <DatePicker showTime style={{ width: "100%" }} />
      </Form.Item>
      <Form.Item name="qaNotes" label="问答记录" rules={[{ required: true, message: "请输入问答记录" }]}>
        <Input.TextArea rows={6} placeholder="问了什么，我怎么答的" />
      </Form.Item>
      <Form.Item name="reflection" label="自我反思">
        <Input.TextArea rows={3} placeholder="哪里答得不好，为什么" />
      </Form.Item>
      <Button type="primary" loading={saving} onClick={() => submit("done")} style={{ marginRight: 12 }}>
        保存复盘
      </Button>
      <Button loading={saving} onClick={() => submit("scheduled")}>
        记为计划
      </Button>
    </Form>
  );
}
