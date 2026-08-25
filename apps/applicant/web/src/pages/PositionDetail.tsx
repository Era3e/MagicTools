import { Button, Input, Select, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Position } from "../api";
import { StatusTag } from "../components/StatusTag";
import { POSITION_STATUS_OPTIONS } from "../status";

const MAG = {
  ink: "#2b2620",
  brick: "#b4532a",
  paper: "#f8f5ef",
  muted: "#8a8175",
  rule: "#ddd5c7",
  display: 'Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", serif',
  body: '"Noto Serif SC", Georgia, serif',
};

export default function PositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Position | null>(null);
  const [notes, setNotes] = useState("");
  const [greeting, setGreeting] = useState("");
  const [greetingLoading, setGreetingLoading] = useState(false);

  useEffect(() => {
    if (id) {
      api.getPosition(id).then((p) => {
        setItem(p);
        setNotes(p.notes ?? "");
      });
    }
  }, [id]);

  if (!item) return <div style={{ fontFamily: MAG.body, color: MAG.muted, textAlign: "center", padding: 60 }}>翻页中……</div>;

  const changeStatus = async (status: string) => {
    const updated = await api.updatePosition(item.id, { status });
    setItem(updated);
    message.success("状态已更新");
  };

  const saveNotes = async () => {
    const updated = await api.updatePosition(item.id, { notes });
    setItem(updated);
    message.success("备注已保存");
  };

  return (
    <article style={{ fontFamily: MAG.body, color: MAG.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "3px double " + MAG.ink, paddingBottom: 12, marginBottom: 6 }}>
        <span style={{ fontFamily: MAG.display, letterSpacing: 4, fontSize: 12, color: MAG.brick }}>
          FEATURE · 机会档案
        </span>
        <Button type="text" onClick={() => navigate(-1)} style={{ color: MAG.muted, fontSize: 12 }}>
          ← 返回博览
        </Button>
      </div>

      <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
        <div style={{ fontFamily: MAG.display, fontSize: 15, color: MAG.brick, letterSpacing: 2, marginBottom: 6 }}>
          {item.company}
        </div>
        <h1 style={{ fontFamily: MAG.display, fontSize: 34, margin: "0 0 12px", fontWeight: 700 }}>
          {item.title}
        </h1>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, color: MAG.muted, fontSize: 13 }}>
          {item.city ? <span>📍 {item.city}</span> : null}
          {item.salary ? <span>{item.salary}</span> : null}
          <span>来源 · {item.source}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid " + MAG.ink,
          borderBottom: "1px solid " + MAG.ink,
          padding: "10px 4px",
          marginBottom: 20,
        }}
      >
        <Space>
          <StatusTag status={item.status} />
          <Select value={item.status} size="small" style={{ width: 120 }} options={POSITION_STATUS_OPTIONS} onChange={changeStatus} />
        </Space>
        <Space>
          {item.appliedUrl ? (
            <Button type="primary" href={item.appliedUrl} target="_blank" style={{ background: MAG.brick, borderRadius: 0 }}>
              去投递
            </Button>
          ) : null}
          <Button
            loading={greetingLoading}
            onClick={async () => {
              setGreetingLoading(true);
              try {
                const out = await api.generateGreeting(item.id);
                setGreeting(out.greeting);
              } catch (err) {
                message.error(String(err));
              } finally {
                setGreetingLoading(false);
              }
            }}
            style={{ borderRadius: 0 }}
          >
            生成打招呼话术
          </Button>
        </Space>
      </div>

      {greeting ? (
        <blockquote
          style={{
            margin: "0 0 20px",
            padding: "14px 18px",
            borderLeft: "3px solid " + MAG.brick,
            background: MAG.paper,
            fontFamily: MAG.display,
            fontStyle: "italic",
            fontSize: 15,
            lineHeight: 1.9,
          }}
        >
          {greeting}
        </blockquote>
      ) : null}

      <div>
        <div style={{ fontFamily: MAG.display, letterSpacing: 3, fontSize: 12, color: MAG.muted, marginBottom: 8 }}>
          EDITOR'S NOTES · 手记
        </div>
        <Input.TextArea
          rows={6}
          variant="borderless"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="写点备忘——面试要点、联系人、跟进节奏……"
          style={{ background: MAG.paper, padding: 12, fontFamily: MAG.body }}
        />
      </div>
    </article>
  );
}
