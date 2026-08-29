import { Button, Card, Form, Input, List, Spin, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { TimelineBurndown, useTheme, tokens } from "@mt/ui";
import { api, type Iteration, type Requirement } from "../api";

export default function IterationList() {
  const theme = useTheme();
  const [items, setItems] = useState<Iteration[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeReqs, setActiveReqs] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = () => api.listIterations().then(setItems);

  useEffect(() => {
    refresh();
  }, []);

  // 选中迭代 → 拉该迭代下所有需求
  useEffect(() => {
    if (!activeId) {
      setActiveReqs([]);
      return;
    }
    setLoading(true);
    api.listRequirements({ iterationId: activeId }).then((reqs) => {
      setActiveReqs(reqs);
    }).catch(() => {
      setActiveReqs([]);
    }).finally(() => setLoading(false));
  }, [activeId]);

  const active = items.find((i) => i.id === activeId) ?? null;

  return (
    <Card title="迭代管理">
      <Form
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={async (values) => {
          await api.createIteration(values);
          message.success("已创建迭代");
          refresh();
        }}
      >
        <Form.Item name="name" rules={[{ required: true }]}>
          <Input placeholder="迭代名称" />
        </Form.Item>
        <Form.Item name="startDate">
          <Input type="date" placeholder="开始日期" />
        </Form.Item>
        <Form.Item name="endDate">
          <Input type="date" placeholder="结束日期" />
        </Form.Item>
        <Button type="primary" htmlType="submit">新建迭代</Button>
      </Form>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", gap: 16 }}>
        {/* 左列：迭代列表 */}
        <div>
          <List
            dataSource={items}
            rowKey="id"
            renderItem={(it) => {
              const isActive = it.id === activeId;
              return (
                <List.Item
                  style={{
                    cursor: "pointer",
                    padding: "10px 12px",
                    background: isActive ? theme.primary + "12" : "transparent",
                    border: isActive ? `1px solid ${theme.primary}` : `1px solid ${theme.border ?? tokens.color.border}`,
                    borderRadius: tokens.radius,
                    marginBottom: 8,
                    transition: "all .15s",
                  }}
                  onClick={() => setActiveId(isActive ? null : it.id)}
                >
                  <List.Item.Meta
                    title={<span style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</span>}
                    description={
                      <span style={{ fontSize: 11, color: theme.muted }}>
                        {(it.startDate ?? "—")} → {(it.endDate ?? "—")}
                      </span>
                    }
                  />
                  <Tag color={isActive ? "green" : "default"}>迭代</Tag>
                </List.Item>
              );
            }}
          />
          {items.length === 0 && (
            <div style={{ color: theme.muted, fontSize: 12, textAlign: "center", padding: 24 }}>
              暂无迭代，先创建一个吧
            </div>
          )}
        </div>

        {/* 右列：燃尽图 + 概览 */}
        <div style={{ border: `1px solid ${theme.border ?? tokens.color.border}`, borderRadius: tokens.radius, padding: 16, minHeight: 280 }}>
          {!active ? (
            <div style={{ color: theme.muted, fontSize: 13, textAlign: "center", padding: 48 }}>
              👈 点击左侧迭代查看燃尽图
            </div>
          ) : !active.startDate || !active.endDate ? (
            <div style={{ color: theme.muted, fontSize: 13, textAlign: "center", padding: 48 }}>
              迭代「{active.name}」尚未设置开始/结束日期，无法渲染燃尽图。
              <br />
              请先编辑迭代补充日期。
            </div>
          ) : loading ? (
            <div style={{ textAlign: "center", padding: 48 }}><Spin /></div>
          ) : (
            <>
              {/* 需求概览指标条 */}
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <Metric label="总需求" value={activeReqs.length} />
                <Metric label="已完成" value={activeReqs.filter((r) => r.status === "done").length} color={theme.primary} />
                <Metric label="进行中" value={activeReqs.filter((r) => r.status === "developing" || r.status === "testing").length} color={tokens.color.warning} />
                <Metric label="待处理" value={activeReqs.filter((r) => r.status !== "done" && r.status !== "developing" && r.status !== "testing").length} color={theme.muted} />
              </div>
              <TimelineBurndown
                startDate={active.startDate}
                endDate={active.endDate}
                requirements={activeReqs}
                title={`「${active.name}」燃尽图`}
              />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color?: string }) {
  const theme = useTheme();
  return (
    <div style={{ textAlign: "center", minWidth: 64 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? theme.ink, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.muted }}>{label}</div>
    </div>
  );
}
