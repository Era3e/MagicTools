import { Button, Card, Descriptions, Form, Input, Space, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type AnalysisRequest } from "../api";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待处理", color: "default" },
  draft: { label: "草稿", color: "blue" },
  review: { label: "待审核", color: "orange" },
  approved: { label: "已通过", color: "green" },
  rejected: { label: "已驳回", color: "red" },
};

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<AnalysisRequest | null>(null);
  const [contextText, setContextText] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      api.getRequest(id).then((r) => {
        setItem(r);
        setContextText(r.contextText);
        setRepoUrl(r.repoUrl);
      });
    }
  }, [id]);

  if (!item) return <Card loading />;

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setLoading(true);
    try {
      await fn();
      message.success(okMsg);
      const fresh = await api.getRequest(item.id);
      setItem(fresh);
      setContextText(fresh.contextText);
      setRepoUrl(fresh.repoUrl);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  const s = STATUS_MAP[item.status];

  return (
    <Card
      title={"分析请求 · " + (item.surveyName || "未命名")}
      extra={
        <Space>
          <Tag color={s?.color}>{s?.label}</Tag>
          <Button onClick={() => navigate(-1)}>返回</Button>
        </Space>
      }
    >
      <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="仓库">{item.repoUrl || "-"}</Descriptions.Item>
        <Descriptions.Item label="推送状态">{item.pushedAt ? <Tag color="green">已推送</Tag> : <Tag>未推送</Tag>}</Descriptions.Item>
        {item.reviewComment ? <Descriptions.Item label="审核意见" span={2}>{item.reviewComment}</Descriptions.Item> : null}
      </Descriptions>

      <Form layout="vertical" style={{ marginBottom: 16 }}>
        <Form.Item label="补充上下文">
          <Input.TextArea rows={3} value={contextText} onChange={(e) => setContextText(e.target.value)} placeholder="需求背景、目标等补充说明" />
        </Form.Item>
        <Form.Item label="GitHub 仓库（owner/repo）">
          <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="如 Era3e/MagicTools" />
        </Form.Item>
        <Space>
          <Button
            type="primary"
            onClick={() => run(() => api.updateContext(item.id, { contextText, repoUrl }), "上下文已保存")}
          >
            保存上下文
          </Button>
          <Button loading={loading} onClick={() => run(() => api.generate(item.id), "已生成分析与方案")}>
            生成分析与方案
          </Button>
          <Button
            disabled={item.status !== "approved"}
            onClick={() => run(() => api.push(item.id), "已推送至 Manager 收件箱（requirement.created 事件），请通知项目经理在 Manager 后台手动拉取。")}
          >
            推送 Manager
          </Button>
        </Space>
      </Form>

      {item.analysisMd ? (
        <Card size="small" title="需求分析" style={{ marginBottom: 12 }}>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{item.analysisMd}</pre>
        </Card>
      ) : null}
      {item.designMd ? (
        <Card size="small" title="设计方案" style={{ marginBottom: 12 }}>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{item.designMd}</pre>
        </Card>
      ) : null}

      <Card size="small" title="审核">
        <Space>
          <Button
            type="primary"
            onClick={() => run(() => api.review(item.id, { approve: true, comment }), "已通过")}
          >
            通过
          </Button>
          <Input style={{ width: 320 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="审核意见（驳回必填）" />
          <Button
            danger
            onClick={() => run(() => api.review(item.id, { approve: false, comment }), "已驳回")}
          >
            驳回
          </Button>
        </Space>
      </Card>
    </Card>
  );
}
