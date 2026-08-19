import { Button, Card, Descriptions, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Source } from "../api";

export default function SourceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [source, setSource] = useState<Source | null>(null);
  const [testResult, setTestResult] = useState<Array<{ url: string; title: string }> | null>(null);

  useEffect(() => {
    if (id) api.getSource(id).then(setSource);
  }, [id]);

  if (!source) return <Card loading />;

  const test = async () => {
    try {
      const out = await api.testSource(source.id);
      setTestResult(out.items);
      message.success("试采成功：" + out.items.length + " 条");
    } catch (err) {
      message.error(String(err));
    }
  };

  const collect = async () => {
    try {
      const out = await api.collectSource(source.id);
      message.success("采集完成：新增 " + out.new + " 条（跳过 " + out.skipped + " 条）");
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card
      title={"信息源 · " + source.name}
      extra={
        <Space>
          <Button onClick={() => navigate(-1)}>返回</Button>
          <Button onClick={test}>试采</Button>
          <Button type="primary" onClick={collect}>立即采集</Button>
        </Space>
      }
    >
      <Descriptions column={2} size="small">
        <Descriptions.Item label="类型">{source.type}</Descriptions.Item>
        <Descriptions.Item label="URL">{source.url}</Descriptions.Item>
        <Descriptions.Item label="定时">{source.cron || "-"}</Descriptions.Item>
        <Descriptions.Item label="状态">{source.status}</Descriptions.Item>
      </Descriptions>
      {testResult ? (
        <Card size="small" title="试采结果" style={{ marginTop: 12 }}>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(testResult, null, 2)}</pre>
        </Card>
      ) : null}
    </Card>
  );
}
