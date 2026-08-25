import { Button, Form, Input, Select, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { api, type Position, type Resume } from "../api";

const MAG = {
  ink: "#2b2620",
  brick: "#b4532a",
  paper: "#f8f5ef",
  muted: "#8a8175",
  rule: "#ddd5c7",
  display: 'Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", serif',
  body: '"Noto Serif SC", Georgia, serif',
};

interface QuotaInfo {
  configured: boolean;
  quota: unknown;
  error?: string;
}

export default function ResumeCenter() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [matchPositionId, setMatchPositionId] = useState<string | undefined>();
  const [rewriteInput, setRewriteInput] = useState({ sectionType: "work_experience", originalText: "" });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    api.listResumes().then((list) => {
      setResumes(list);
      setSelectedResumeId((prev) => (prev && list.some((r) => r.id === prev) ? prev : list[0]?.id));
    });
    api.listPositions().then(setPositions);
    api.resumeQuota().then(setQuota).catch(() => setQuota(null));
  };

  useEffect(refresh, []);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) ?? resumes[0];

  const analyze = async (id: string) => {
    try {
      const out = await api.analyzeResume(id);
      setResult(out);
      message.success("分析完成（" + (out.via === "clawcv" ? "ClawCV" : "本地降级") + "）");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  const rewrite = async (id: string) => {
    try {
      const out = await api.rewriteResume(id, rewriteInput);
      setResult(out);
      message.success("改写完成（" + (out.via === "clawcv" ? "ClawCV" : "本地降级") + "）");
    } catch (err) {
      message.error(String(err));
    }
  };

  const match = async (id: string) => {
    if (!matchPositionId) {
      message.warning("先选择目标岗位");
      return;
    }
    try {
      const out = await api.matchResume(id, matchPositionId);
      setResult(out);
      message.success("匹配完成（" + (out.via === "clawcv" ? "ClawCV" : "本地降级") + "）");
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <div style={{ fontFamily: MAG.body, color: MAG.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "3px double " + MAG.ink, paddingBottom: 12, marginBottom: 6 }}>
        <span style={{ fontFamily: MAG.display, letterSpacing: 4, fontSize: 12, color: MAG.brick }}>
          WORKSHOP · 简历工坊
        </span>
        <span style={{ fontFamily: MAG.display, fontSize: 12, fontStyle: "italic", color: MAG.muted }}>
          {quota?.configured ? "ClawCV 已配置" : "ClawCV 未配置（本地降级模式）"}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid " + MAG.ink, marginBottom: 16 }}>
        <span style={{ fontFamily: MAG.display, fontSize: 20 }}>我的简历</span>
        <Button size="small" style={{ borderRadius: 0, border: "1px solid " + MAG.ink }} onClick={() => setCreating(true)}>
          ＋ 新建简历
        </Button>
      </div>

      {resumes.map((r) => {
        const selected = r.id === selectedResumeId;
        return (
          <div
            key={r.id}
            onClick={() => setSelectedResumeId(r.id)}
            style={{
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "12px 4px 12px 12px",
              marginBottom: 8,
              borderLeft: "3px solid " + (selected ? MAG.brick : "transparent"),
              borderBottom: "1px solid " + MAG.rule,
              background: selected ? MAG.paper : "transparent",
            }}
          >
            <div>
              <span style={{ fontFamily: MAG.display, fontSize: 16 }}>{r.name}</span>
              <span style={{ color: MAG.muted, fontSize: 12, marginLeft: 10 }}>
                版本 {r.version} · 来源 {r.source}
              </span>
              {r.lastAnalysis ? (
                <Tag style={{ marginLeft: 10, borderRadius: 0, fontSize: 11 }}>
                  上次分析 via {(r.lastAnalysis as { via?: string }).via ?? "?"}
                </Tag>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              <Button size="small" style={{ borderRadius: 0 }} onClick={() => void analyze(r.id)}>
                分析
              </Button>
              <Button size="small" style={{ borderRadius: 0 }} onClick={() => void match(r.id)}>
                岗位匹配
              </Button>
            </div>
          </div>
        );
      })}

      <div
        style={{
          marginTop: 20,
          border: "1px solid " + MAG.rule,
          background: MAG.paper,
          padding: 16,
        }}
      >
        <div style={{ fontFamily: MAG.display, letterSpacing: 3, fontSize: 12, color: MAG.muted, marginBottom: 12 }}>
          REWRITE DESK · 改写台
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Select
            style={{ width: 320 }}
            placeholder="选择目标岗位做匹配"
            value={matchPositionId}
            onChange={setMatchPositionId}
            options={positions.map((p) => ({ value: p.id, label: p.company + " · " + p.title }))}
          />
          <Typography.Text style={{ color: MAG.muted, fontSize: 13 }}>
            {selectedResume ? "改写目标：" + selectedResume.name : "请先选择一份简历"}
          </Typography.Text>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <Select
            style={{ width: 200 }}
            value={rewriteInput.sectionType}
            onChange={(v) => setRewriteInput((s) => ({ ...s, sectionType: v }))}
            options={[
              { value: "work_experience", label: "工作经历" },
              { value: "project", label: "项目经历" },
              { value: "summary", label: "个人总结" },
              { value: "skills", label: "技能" },
            ]}
          />
          <Input
            placeholder="要改写的原文"
            value={rewriteInput.originalText}
            onChange={(e) => setRewriteInput((s) => ({ ...s, originalText: e.target.value }))}
          />
          <Button
            style={{ borderRadius: 0, border: "1px solid " + MAG.ink }}
            onClick={() => {
              if (selectedResume) void rewrite(selectedResume.id);
            }}
            disabled={!rewriteInput.originalText || !selectedResume}
          >
            改写
          </Button>
        </div>
        {result ? (
          <div style={{ marginTop: 12, borderTop: "1px dashed " + MAG.rule, paddingTop: 12 }}>
            <div style={{ fontFamily: MAG.display, fontSize: 11, letterSpacing: 2, color: MAG.brick, marginBottom: 6 }}>
              RESULT · 结果
            </div>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, fontFamily: MAG.body }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      <Form
        layout="vertical"
        style={{ display: creating ? "block" : "none", marginTop: 16, border: "1px solid " + MAG.rule, padding: 16, background: MAG.paper }}
        onFinish={async (values: { name: string; contentText: string }) => {
          await api.createResume(values);
          message.success("已创建");
          setCreating(false);
          refresh();
        }}
      >
        <div style={{ fontFamily: MAG.display, letterSpacing: 3, fontSize: 12, color: MAG.muted, marginBottom: 12 }}>
          NEW DRAFT · 新稿
        </div>
        <Form.Item name="name" rules={[{ required: true }]}>
          <Input placeholder="简历名称" style={{ borderRadius: 0 }} />
        </Form.Item>
        <Form.Item name="contentText" rules={[{ required: true }]}>
          <Input.TextArea placeholder="简历内容（ClawCV 读取或手动粘贴）" rows={4} style={{ borderRadius: 0 }} />
        </Form.Item>
        <Button type="primary" htmlType="submit" style={{ background: MAG.brick, borderRadius: 0 }}>
          保存新稿
        </Button>
      </Form>
    </div>
  );
}
