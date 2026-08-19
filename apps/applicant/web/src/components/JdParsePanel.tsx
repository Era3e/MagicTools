import { Button, Input, Space, message } from "antd";
import { useState } from "react";
import { api } from "../api";
import type { PositionFormValues } from "./PositionForm";

export function JdParsePanel(props: { onParsed: (values: PositionFormValues) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const parse = async () => {
    setLoading(true);
    try {
      const data = await api.parseJd(text);
      props.onParsed({
        company: data.company,
        title: data.title,
        city: data.city,
        salary: data.salary,
        source: "jd_text",
        jdRaw: text,
      });
      message.success("解析完成，请确认后保存");
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Input.TextArea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴 JD 原文（至少 10 字）" />
      <Button type="primary" loading={loading} onClick={parse} disabled={text.trim().length < 10}>
        解析为结构化岗位信息
      </Button>
    </Space>
  );
}
