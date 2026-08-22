import { useEffect, useRef, useState } from "react";
import { Button, Card, List, Space, Tag, message } from "antd";
import { Graph } from "@antv/g6";
import { tokens } from "@mt/ui";
import { api, type GraphEdge, type GraphNode } from "../api";

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const g6Ref = useRef<Graph | null>(null);

  const load = () => api.getGraph().then(setData).catch((err) => message.error(String(err)));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!data || !containerRef.current) return;
    g6Ref.current?.destroy();
    const idByName = new Map(data.nodes.map((n) => [n.name, n.id]));
    const g = new Graph({
      container: containerRef.current,
      autoFit: "view",
      data: {
        nodes: data.nodes.map((n) => ({
          id: n.id,
          data: { label: n.name + (n.entryCount > 0 ? "（" + n.entryCount + "）" : "") },
        })),
        edges: data.edges
          .filter((e) => idByName.has(e.from) && idByName.has(e.to))
          .map((e) => ({ id: e.id, source: idByName.get(e.from)!, target: idByName.get(e.to)!, data: { label: e.label } })),
      },
      node: {
        style: {
          fill: tokens.color.primary,
          labelText: (d: unknown) => (d as { data: { label: string } }).data.label,
        },
      },
      edge: {
        style: {
          labelText: (d: unknown) => (d as { data: { label: string } }).data.label,
        },
      },
    });
    g.render();
    g6Ref.current = g;
  }, [data]);

  const generate = async () => {
    setLoading(true);
    try {
      const stats = await api.generateGraph();
      message.success("图谱已重建：实体 " + stats.entities + "，关系 " + stats.relations);
      await load();
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="知识图谱"
      extra={
        <Button type="primary" loading={loading} onClick={generate}>
          生成图谱
        </Button>
      }
    >
      <div style={{ marginBottom: 16 }}>
        实体 {data?.nodes.length ?? 0} · 关系 {data?.edges.length ?? 0}
      </div>
      <div ref={containerRef} style={{ width: "100%", height: 420, border: "1px solid " + tokens.color.border }} />
      <List<GraphNode>
        style={{ marginTop: 16 }}
        header={<div>实体列表（点击查看关联条目）</div>}
        dataSource={data?.nodes ?? []}
        renderItem={(n) => (
          <List.Item>
            <Space>
              <span>{n.name}</span>
              <Tag>{n.type || "未分类"}</Tag>
              <Tag color="blue">关联条目 {n.entryCount}</Tag>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
}
