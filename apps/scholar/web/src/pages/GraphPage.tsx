import { useEffect, useRef, useState } from "react";
import { Button, message } from "antd";
import { Graph } from "@antv/g6";
import { tokens, useTheme } from "@mt/ui";
import { api, type GraphEdge, type GraphNode } from "../api";

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export default function GraphPage() {
  const theme = useTheme();
  const CATALOG = {
    ink: theme.ink,
    green: theme.primary,
    muted: theme.muted,
    rule: theme.rule ?? tokens.color.border,
    card: theme.card ?? theme.background,
    display: theme.displayFont,
    body: theme.bodyFont,
  };
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
          fill: CATALOG.green,
          fillOpacity: 0.85,
          stroke: CATALOG.ink,
          labelText: (d: unknown) => (d as { data: { label: string } }).data.label,
          labelFill: CATALOG.ink,
          labelFontFamily: CATALOG.body,
        },
      },
      edge: {
        style: {
          stroke: CATALOG.rule,
          labelText: (d: unknown) => (d as { data: { label: string } }).data.label,
          labelFill: CATALOG.muted,
          labelFontSize: 10,
          labelFontFamily: CATALOG.body,
        },
      },
    });
    g.render();
    g6Ref.current = g;
  }, [data, CATALOG.green, CATALOG.ink, CATALOG.rule, CATALOG.muted, CATALOG.body]);

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
    <div style={{ fontFamily: CATALOG.body, color: CATALOG.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid " + CATALOG.ink, paddingBottom: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: CATALOG.display, letterSpacing: 4, fontSize: 13 }}>
          知 识 图 谱 · CLASSIFICATION
        </span>
        <Button
          type="text"
          loading={loading}
          onClick={generate}
          style={{ color: CATALOG.green, border: "1px solid " + CATALOG.green, borderRadius: 0, letterSpacing: 2 }}
        >
          生成图谱
        </Button>
      </div>

      <div style={{ color: CATALOG.muted, fontSize: 12, marginBottom: 10 }}>
        实体 {data?.nodes.length ?? 0} · 关系 {data?.edges.length ?? 0} —— 知识之间的亲缘脉络
      </div>
      <div
        ref={containerRef}
        style={{ width: "100%", height: 420, border: "1px solid " + CATALOG.rule, background: CATALOG.card, padding: 8 }}
      />

      {data && data.nodes.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: CATALOG.display, fontSize: 13, letterSpacing: 2, marginBottom: 8 }}>
            类目卡片
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {data.nodes.map((n) => (
              <div
                key={n.id}
                style={{
                  border: "1px solid " + CATALOG.rule,
                  borderLeft: "3px solid " + CATALOG.green,
                  padding: "10px 12px",
                  background: CATALOG.card,
                }}
              >
                <div style={{ fontFamily: CATALOG.display, fontSize: 15, marginBottom: 4 }}>{n.name}</div>
                <div style={{ color: CATALOG.muted, fontSize: 12 }}>
                  {n.type || "未分类"} · 藏书 {n.entryCount} 卷
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
