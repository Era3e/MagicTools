import { Button, Card, Divider, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Interview, type Position } from "../api";
import { AnalysisView } from "../components/AnalysisView";
import { InterviewForm } from "../components/InterviewForm";

export default function InterviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [position, setPosition] = useState<Position | null>(null);
  const [items, setItems] = useState<Interview[]>([]);

  const refresh = () => {
    if (id) api.listInterviews(id).then(setItems).catch((err) => console.error(err));
  };

  useEffect(() => {
    if (id) {
      api.getPosition(id).then(setPosition);
      refresh();
    }
  }, [id]);

  const analyze = async (interviewId: string) => {
    try {
      await api.analyzeInterview(interviewId);
      message.success("分析完成");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card
      title={position ? "面试复盘 · " + position.company + " " + position.title : "面试复盘"}
      extra={<Button onClick={() => navigate(-1)}>返回</Button>}
    >
      <InterviewForm
        onSubmit={async (values) => {
          if (!id) return;
          await api.createInterview(id, values);
          message.success("已保存");
          refresh();
        }}
      />
      <Divider />
      <Space direction="vertical" style={{ width: "100%" }}>
        {items.map((iv) => (
          <Card key={iv.id} size="small" title={"第 " + iv.round + " 面 · " + new Date(iv.happenedAt).toLocaleString()}>
            <Card size="small" type="inner" title="问答记录">
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{iv.qaNotes}</pre>
            </Card>
            {iv.reflection ? (
              <Card size="small" type="inner" title="自我反思" style={{ marginTop: 8 }}>
                <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{iv.reflection}</pre>
              </Card>
            ) : null}
            <div style={{ marginTop: 8 }}>
              <AnalysisView
                analysis={iv.analysis}
                onAnalyze={() => analyze(iv.id)}
                onExport={() => {
                  window.open(api.exportInterviewUrl(iv.id), "_blank");
                }}
              />
            </div>
          </Card>
        ))}
      </Space>
    </Card>
  );
}
