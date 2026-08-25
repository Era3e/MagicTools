import { Button, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Interview, type Position } from "../api";
import { AnalysisView } from "../components/AnalysisView";
import { InterviewForm } from "../components/InterviewForm";

const MAG = {
  ink: "#2b2620",
  brick: "#b4532a",
  paper: "#f8f5ef",
  muted: "#8a8175",
  rule: "#ddd5c7",
  display: 'Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", serif',
  body: '"Noto Serif SC", Georgia, serif',
};

export default function InterviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [position, setPosition] = useState<Position | null>(null);
  const [items, setItems] = useState<Interview[]>([]);

  const refresh = useCallback(() => {
    if (!id) return;
    api.listInterviews(id).then(setItems).catch((err) => message.error(String(err)));
  }, [id]);

  useEffect(() => {
    if (id) {
      api.getPosition(id).then(setPosition).catch((err) => message.error(String(err)));
      refresh();
    }
  }, [id, refresh]);

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
    <div style={{ fontFamily: MAG.body, color: MAG.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "3px double " + MAG.ink, paddingBottom: 12, marginBottom: 6 }}>
        <span style={{ fontFamily: MAG.display, letterSpacing: 4, fontSize: 12, color: MAG.brick }}>
          DEBRIEF · 面试复盘
        </span>
        <Button type="text" onClick={() => navigate(-1)} style={{ color: MAG.muted, fontSize: 12 }}>
          ← 返回档案
        </Button>
      </div>

      {position ? (
        <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
          <h2 style={{ fontFamily: MAG.display, fontSize: 24, margin: 0 }}>
            {position.company} · {position.title}
          </h2>
          <div style={{ color: MAG.muted, fontSize: 13, marginTop: 4, fontStyle: "italic" }}>
            每一场对话，都是下一场的底稿
          </div>
        </div>
      ) : null}

      <div style={{ border: "1px solid " + MAG.rule, background: MAG.paper, padding: 16, marginBottom: 20 }}>
        <div style={{ fontFamily: MAG.display, letterSpacing: 3, fontSize: 12, color: MAG.muted, marginBottom: 12 }}>
          NEW ENTRY · 记录一场
        </div>
        <InterviewForm
          onSubmit={async (values) => {
            if (!id) return;
            await api.createInterview(id, values);
            message.success("已保存");
            refresh();
          }}
        />
      </div>

      {items.map((iv) => (
        <article
          key={iv.id}
          style={{
            borderTop: "1px solid " + MAG.ink,
            borderBottom: "1px solid " + MAG.rule,
            padding: "16px 4px",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontFamily: MAG.display, fontSize: 17 }}>
              第 {iv.round} 面
            </span>
            <span style={{ color: MAG.muted, fontSize: 12 }}>
              {new Date(iv.happenedAt).toLocaleString()}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontFamily: MAG.display, fontSize: 11, letterSpacing: 2, color: MAG.brick, marginBottom: 6 }}>
                Q&A · 问答记录
              </div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: MAG.body, fontSize: 13, lineHeight: 1.9 }}>
                {iv.qaNotes}
              </pre>
            </div>
            <div>
              <div style={{ fontFamily: MAG.display, fontSize: 11, letterSpacing: 2, color: MAG.brick, marginBottom: 6 }}>
                REFLECTION · 自我反思
              </div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: MAG.body, fontSize: 13, lineHeight: 1.9, color: MAG.muted }}>
                {iv.reflection || "（待补）"}
              </pre>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <AnalysisView
              analysis={iv.analysis}
              onAnalyze={() => analyze(iv.id)}
              onExport={() => {
                window.open(api.exportInterviewUrl(iv.id), "_blank");
              }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
