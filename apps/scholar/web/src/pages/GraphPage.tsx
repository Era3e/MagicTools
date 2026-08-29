import { useEffect, useRef, useState } from "react";
import { Button, message, Tag } from "antd";
import { Graph } from "@antv/g6";
import type { IEvent } from "@antv/g6";
import { tokens, useTheme } from "@mt/ui";
import { api, type GraphEdge, type GraphNode } from "../api";

/** 从 G6 事件对象中安全提取目标元素 ID */
function getEventTargetId(evt: IEvent): string | null {
  const t = (evt as { target?: { id?: string } }).target;
  return t?.id ?? null;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface SelectedNode {
  id: string;
  name: string;
  type: string;
  entryCount: number;
}

interface SelectedEdge {
  id: string;
  from: string;
  to: string;
  label: string;
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
    link: theme.link ?? theme.primary,
    chipBg: theme.chipBg ?? theme.paper ?? theme.background,
    subtle: theme.subtle ?? theme.muted,
  };
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);
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
      behaviors: ["drag-canvas", "drag-element", "zoom-canvas", "click-select"],
      data: {
        nodes: data.nodes.map((n) => ({
          id: n.id,
          data: { label: n.name + (n.entryCount > 0 ? "（" + n.entryCount + "）" : ""), name: n.name, type: n.type, entryCount: n.entryCount },
        })),
        edges: data.edges
          .filter((e) => idByName.has(e.from) && idByName.has(e.to))
          .map((e) => ({ id: e.id, source: idByName.get(e.from)!, target: idByName.get(e.to)!, data: { label: e.label, from: e.from, to: e.to } })),
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
        state: {
          hover: { fillOpacity: 1, lineWidth: 2 },
          selected: { fill: CATALOG.green, lineWidth: 3, stroke: CATALOG.ink },
        },
      },
      edge: {
        style: {
          stroke: CATALOG.rule,
          lineWidth: 1.5,
          labelText: (d: unknown) => (d as { data: { label: string } }).data.label,
          labelFill: CATALOG.muted,
          labelFontSize: 10,
          labelFontFamily: CATALOG.body,
          labelBackgroundFill: CATALOG.card,
          labelPadding: [2, 4],
        },
        state: {
          hover: { stroke: CATALOG.green, lineWidth: 3 },
          selected: { stroke: CATALOG.green, lineWidth: 3 },
        },
      },
    });
    g.on("node:click", (evt: IEvent) => {
      const id = getEventTargetId(evt);
      if (!id) return;
      const node = data.nodes.find((n) => n.id === id);
      if (node) {
        setSelectedNode({ id: node.id, name: node.name, type: node.type, entryCount: node.entryCount });
        setSelectedEdge(null);
      }
    });
    g.on("edge:click", (evt: IEvent) => {
      const id = getEventTargetId(evt);
      if (!id) return;
      const edge = data.edges.find((e) => e.id === id);
      if (edge) {
        setSelectedEdge({ id: edge.id, from: edge.from, to: edge.to, label: edge.label });
        setSelectedNode(null);
      }
    });
    g.on("canvas:click", () => {
      setSelectedNode(null);
      setSelectedEdge(null);
    });
    g.render();
    g6Ref.current = g;
  }, [data, CATALOG.green, CATALOG.ink, CATALOG.rule, CATALOG.muted, CATALOG.body, CATALOG.card]);

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
        实体 {data?.nodes.length ?? 0} · 关系 {data?.edges.length ?? 0} —— 拖拽节点重新布局 · 点击查看详情
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
        <div
          ref={containerRef}
          style={{ width: "100%", height: 420, border: "1px solid " + CATALOG.rule, background: CATALOG.card, padding: 8 }}
        />
        <div style={{ border: "1px solid " + CATALOG.rule, background: CATALOG.card, padding: 14, minHeight: 420 }}>
          <div style={{ fontFamily: CATALOG.display, fontSize: 13, letterSpacing: 2, marginBottom: 10, borderBottom: "1px solid " + CATALOG.rule, paddingBottom: 6 }}>
            详情面板
          </div>
          {selectedNode ? (
            <SelectedNodePanel node={selectedNode} edges={data?.edges ?? []} onClose={() => setSelectedNode(null)} />
          ) : selectedEdge ? (
            <SelectedEdgePanel edge={selectedEdge} onClose={() => setSelectedEdge(null)} />
          ) : (
            <div style={{ color: CATALOG.muted, fontSize: 12, lineHeight: 1.6 }}>
              <p style={{ marginBottom: 8 }}>点击图谱中的节点或边查看详情。</p>
              <p style={{ marginBottom: 4, fontWeight: 600 }}>交互提示：</p>
              <ul style={{ paddingLeft: 14, listStyle: "disc" }}>
                <li>拖拽节点可重新布局</li>
                <li>滚轮缩放图谱</li>
                <li>拖拽画布平移视图</li>
                <li>点击空白处取消选中</li>
              </ul>
            </div>
          )}
        </div>
      </div>

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

function SelectedNodePanel({ node, edges, onClose }: { node: SelectedNode; edges: GraphEdge[]; onClose: () => void }) {
  const theme = useTheme();
  const c = {
    ink: theme.ink,
    muted: theme.muted,
    green: theme.primary,
    link: theme.link ?? theme.primary,
    chipBg: theme.chipBg ?? theme.paper ?? theme.background,
  };
  const related = edges.filter((e) => e.from === node.name || e.to === node.name);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 14, color: c.ink }}>{node.name}</strong>
        <Button size="small" type="text" onClick={onClose} style={{ fontSize: 11, padding: "0 4px" }}>×</Button>
      </div>
      <div style={{ marginBottom: 10 }}>
        <Tag color="green" style={{ marginRight: 6 }}>{node.type || "未分类"}</Tag>
        <span style={{ color: c.muted, fontSize: 12 }}>藏书 {node.entryCount} 卷</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: c.ink }}>关联关系 ({related.length})</div>
      {related.length === 0 ? (
        <div style={{ color: c.muted, fontSize: 12, fontStyle: "italic" }}>暂无关系</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {related.map((e) => (
            <div key={e.id} style={{ fontSize: 12, padding: "4px 8px", background: c.chipBg, borderRadius: 4 }}>
              <span style={{ color: c.link }}>{e.from}</span>
              <span style={{ color: c.muted, margin: "0 6px" }}>— {e.label} →</span>
              <span style={{ color: c.link }}>{e.to}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectedEdgePanel({ edge, onClose }: { edge: SelectedEdge; onClose: () => void }) {
  const theme = useTheme();
  const c = {
    ink: theme.ink,
    muted: theme.muted,
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 14, color: c.ink }}>{edge.label}</strong>
        <Button size="small" type="text" onClick={onClose} style={{ fontSize: 11, padding: "0 4px" }}>×</Button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <Tag color="green">{edge.from}</Tag>
        <span style={{ color: c.muted }}>—{edge.label}→</span>
        <Tag color="blue">{edge.to}</Tag>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: c.muted }}>
        该关系描述 <b>{edge.from}</b> 与 <b>{edge.to}</b> 之间的 <i>{edge.label}</i> 语义关联。
      </div>
    </div>
  );
}
