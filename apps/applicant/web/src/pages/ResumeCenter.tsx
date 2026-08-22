import { Button, Card, Form, Input, List, Select, Space, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { tokens } from "@mt/ui";
import { api, apiResume, type Position, type Resume } from "../api";

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

  const refresh = () => {
    apiResume.list().then((list) => {
      setResumes(list);
      setSelectedResumeId((prev) => (prev && list.some((r) => r.id === prev) ? prev : list[0]?.id));
    });
    api.listPositions().then(setPositions);
    apiResume.quota().then(setQuota).catch(() => setQuota(null));
  };

  useEffect(refresh, []);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) ?? resumes[0];

  const analyze = async (id: string) => {
    try {
      const out = await apiResume.analyze(id);
      setResult(out);
      message.success("分析完成（" + (out.via === "clawcv" ? "ClawCV" : "本地降级") + "）");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  const rewrite = async (id: string) => {
    try {
      const out = await apiResume.rewrite(id, rewriteInput);
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
      const out = await apiResume.match(id, matchPositionId);
      setResult(out);
      message.success("匹配完成（" + (out.via === "clawcv" ? "ClawCV" : "本地降级") + "）");
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card
      title="简历中心"
      extra={
        <Space>
          <Typography.Text type={quota?.configured ? "secondary" : "warning"}>
            {quota?.configured ? "ClawCV 已配置" : "ClawCV 未配置（本地降级模式）"}
          </Typography.Text>
          <Form
            layout="inline"
            onFinish={async (values: { name: string; contentText: string }) => {
              await apiResume.create(values);
              message.success("已创建");
              refresh();
            }}
          >
            <Form.Item name="name" rules={[{ required: true }]}>
              <Input placeholder="简历名称" />
            </Form.Item>
            <Form.Item name="contentText" rules={[{ required: true }]}>
              <Input.TextArea placeholder="简历内容（ClawCV 读取或手动粘贴）" rows={3} style={{ width: 360 }} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              新建简历
            </Button>
          </Form>
        </Space>
      }
    >
      <List
        dataSource={resumes}
        rowKey="id"
        renderItem={(r) => {
          const selected = r.id === selectedResumeId;
          return (
            <List.Item
              onClick={() => setSelectedResumeId(r.id)}
              style={{
                cursor: "pointer",
                paddingLeft: 12,
                borderLeft: "3px solid " + (selected ? tokens.color.primary : "transparent"),
              }}
              actions={[
                <Button
                  key="a"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    void analyze(r.id);
                  }}
                >
                  分析
                </Button>,
                <Button
                  key="m"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    void match(r.id);
                  }}
                >
                  岗位匹配
                </Button>,
              ]}
            >
              <List.Item.Meta title={r.name} description={"版本 " + r.version + " · 来源 " + r.source} />
              {selected ? <Tag color={tokens.color.primary}>改写中</Tag> : null}
              {r.lastAnalysis ? <Tag>上次分析 via {(r.lastAnalysis as { via?: string }).via ?? "?"}</Tag> : null}
            </List.Item>
          );
        }}
      />
      <Space direction="vertical" style={{ width: "100%", marginTop: 16 }}>
        <Select
          style={{ width: 320 }}
          placeholder="选择目标岗位做匹配"
          value={matchPositionId}
          onChange={setMatchPositionId}
          options={positions.map((p) => ({ value: p.id, label: p.company + " · " + p.title }))}
        />
        <Typography.Text type="secondary">
          {selectedResume ? "改写目标：" + selectedResume.name : "请先选择一份简历"}
        </Typography.Text>
        <Space.Compact style={{ width: "100%" }}>
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
            onClick={() => {
              if (selectedResume) void rewrite(selectedResume.id);
            }}
            disabled={!rewriteInput.originalText || !selectedResume}
          >
            改写
          </Button>
        </Space.Compact>
        {result ? (
          <Card size="small" title="结果">
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
          </Card>
        ) : null}
      </Space>
    </Card>
  );
}
