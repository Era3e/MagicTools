import { Button, Card, Descriptions, Input, Select, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Position } from "../api";
import { StatusTag } from "../components/StatusTag";

const STATUS_OPTIONS = [
  { value: "waiting", label: "待投递" },
  { value: "applied", label: "已投递" },
  { value: "written", label: "笔试" },
  { value: "interview", label: "面试" },
  { value: "offer", label: "offer" },
  { value: "rejected", label: "拒绝" },
];

export default function PositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Position | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (id) {
      api.getPosition(id).then((p) => {
        setItem(p);
        setNotes(p.notes ?? "");
      });
    }
  }, [id]);

  if (!item) return <Card loading />;

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
    <Card title={item.company + " · " + item.title} extra={<Button onClick={() => navigate(-1)}>返回</Button>}>
      <Descriptions column={2}>
        <Descriptions.Item label="状态">
          <Space>
            <StatusTag status={item.status} />
            <Select value={item.status} style={{ width: 120 }} options={STATUS_OPTIONS} onChange={changeStatus} />
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="城市">{item.city || "-"}</Descriptions.Item>
        <Descriptions.Item label="薪资">{item.salary || "-"}</Descriptions.Item>
        <Descriptions.Item label="来源">{item.source}</Descriptions.Item>
      </Descriptions>
      {item.appliedUrl ? (
        <Button type="primary" href={item.appliedUrl} target="_blank" style={{ marginBottom: 16 }}>
          去投递
        </Button>
      ) : null}
      <Input.TextArea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="备注" />
    </Card>
  );
}
