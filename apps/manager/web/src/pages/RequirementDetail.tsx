import { Button, Card, Descriptions, Input, Select, Space, Tag, Timeline, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Requirement, type RequirementStatus } from "../api";

const STATUS_OPTIONS: Array<{ value: RequirementStatus; label: string }> = [
  { value: "waiting", label: "待分析" },
  { value: "designing", label: "设计中" },
  { value: "todo", label: "待开发" },
  { value: "developing", label: "开发中" },
  { value: "testing", label: "测试中" },
  { value: "accepting", label: "待验收" },
  { value: "done", label: "已完成" },
];

export default function RequirementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Requirement | null>(null);
  const [branch, setBranch] = useState("");
  const [prUrl, setPrUrl] = useState("");

  useEffect(() => {
    if (id) {
      api.getRequirement(id).then((r) => {
        setItem(r);
        setBranch(r.branch);
        setPrUrl(r.prUrl);
      });
    }
  }, [id]);

  if (!item) return <Card loading />;

  const refresh = async () => {
    const fresh = await api.getRequirement(item.id);
    setItem(fresh);
  };

  const changeStatus = async (status: string) => {
    await api.patchRequirement(item.id, { status });
    message.success("状态已更新");
    refresh();
  };

  const saveLinks = async () => {
    await api.patchRequirement(item.id, { branch, prUrl });
    message.success("已保存关联");
    refresh();
  };

  const refreshPr = async () => {
    try {
      const out = await api.refreshPr(item.id);
      setItem(out);
      message.success("PR 状态已刷新 → " + out.status);
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card title={item.title} extra={<Button onClick={() => navigate(-1)}>返回</Button>}>
      <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="状态">
          <Select value={item.status} style={{ width: 130 }} options={STATUS_OPTIONS} onChange={changeStatus} />
        </Descriptions.Item>
        <Descriptions.Item label="优先级">
          <Select
            value={item.priority}
            style={{ width: 100 }}
            options={[{ value: "P0", label: "P0" }, { value: "P1", label: "P1" }, { value: "P2", label: "P2" }]}
            onChange={(v) => api.patchRequirement(item.id, { priority: v }).then(refresh)}
          />
        </Descriptions.Item>
        <Descriptions.Item label="来源"><Tag>{item.source}</Tag></Descriptions.Item>
        <Descriptions.Item label="标签">{(item.labels ?? []).map((l) => <Tag key={l}>{l}</Tag>)}</Descriptions.Item>
      </Descriptions>

      <Space style={{ marginBottom: 16 }}>
        <Input style={{ width: 300 }} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="分支名（feat-项目-任务ID）" />
        <Input style={{ width: 360 }} value={prUrl} onChange={(e) => setPrUrl(e.target.value)} placeholder="PR 链接" />
        <Button onClick={saveLinks}>保存关联</Button>
        <Button onClick={refreshPr} disabled={!item.prUrl}>刷新 PR 状态</Button>
      </Space>

      {item.description ? (
        <Card size="small" title="描述" style={{ marginBottom: 12 }}>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{item.description}</pre>
        </Card>
      ) : null}

      {item.sourcePayload ? (
        <Card size="small" title="来源详情（Assessor 事件）" style={{ marginBottom: 12 }}>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}>
            {JSON.stringify(item.sourcePayload, null, 2)}
          </pre>
        </Card>
      ) : null}

      {item.timeline.length > 0 ? (
        <Card size="small" title="状态时间线">
          <Timeline
            items={[...item.timeline].reverse().map((t) => ({
              children: (
                <span>
                  {new Date(t.at).toLocaleString()}：{t.from} → {t.to}
                  {t.note ? "（" + t.note + "）" : ""}
                </span>
              ),
            }))}
          />
        </Card>
      ) : null}
    </Card>
  );
}
