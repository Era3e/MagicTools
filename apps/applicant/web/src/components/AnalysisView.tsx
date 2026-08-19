import { Button, Card, List, Space, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import type { InterviewAnalysis } from "../api";

export function AnalysisView(props: {
  analysis: InterviewAnalysis | null;
  onAnalyze: () => Promise<void>;
  onExport: () => void;
}) {
  if (!props.analysis) {
    return (
      <Space direction="vertical">
        <Typography.Text type="secondary">尚未分析</Typography.Text>
        <Button type="primary" onClick={props.onAnalyze}>
          生成复盘分析
        </Button>
      </Space>
    );
  }
  const a = props.analysis;
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      {a.quality ? <Card size="small">{a.quality}</Card> : null}
      {a.questions?.length ? (
        <List
          size="small"
          header="问题清单"
          dataSource={a.questions}
          renderItem={(q) => (
            <List.Item>
              <Space direction="vertical" size={0}>
                <Space>
                  <Tag>{q.category}</Tag>
                  <Typography.Text strong>{q.question}</Typography.Text>
                </Space>
                <Typography.Text type="secondary">{q.comment}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      ) : null}
      {a.suggestions?.length ? (
        <Card size="small" title="改进建议">
          {a.suggestions.map((s, i) => (
            <div key={i}>- {s}</div>
          ))}
        </Card>
      ) : null}
      {a.actionItems?.length ? (
        <Card
          size="small"
          title="行动项"
          extra={
            <Link to="/resumes">去简历中心改写相关经历</Link>
          }
        >
          {a.actionItems.map((s, i) => (
            <div key={i}>- [ ] {s}</div>
          ))}
        </Card>
      ) : null}
      <Space>
        <Button onClick={props.onAnalyze}>重新分析</Button>
        <Button onClick={props.onExport}>导出 markdown</Button>
      </Space>
    </Space>
  );
}
