import type { CSSProperties } from "react";
import { Button, Card, Typography } from "antd";
import { MtEmptyState, MtStatusTag, tokens } from "@mt/ui";
import type { CanvasNode } from "../../canvas/schema";

const SPACING: Record<string, number> = { none: 0, sm: 8, md: 16, lg: 24 };

export interface RendererNodeProps {
  node: CanvasNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  isRoot?: boolean;
}

function containerStyle(node: CanvasNode): CSSProperties {
  return {
    display: "flex",
    flexDirection: node.props.direction === "horizontal" ? "row" : "column",
    gap: SPACING[String(node.props.gap ?? "md")] ?? 16,
    padding: SPACING[String(node.props.padding ?? "md")] ?? 16,
    minWidth: node.props.direction === "horizontal" ? 0 : "100%",
  };
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <span
      data-testid="node-overlay"
      style={{
        display: "inline-flex",
        gap: 6,
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 6,
        background: tokens.scale.ink[8],
        color: tokens.scale.ink[0],
        fontSize: 11,
        fontFamily: "JetBrains Mono, monospace",
        userSelect: "none",
        verticalAlign: "middle",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </span>
  );
}

function OverlayBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ all: "unset", cursor: "pointer", padding: "1px 4px" }}>
      {label}
    </button>
  );
}

function overlayFor(node: CanvasNode, selected: boolean, props: RendererNodeProps, isRoot?: boolean) {
  if (!selected) return null;
  return (
    <Overlay>
      {isRoot ? (
        <span>根容器</span>
      ) : (
        <>
          <OverlayBtn label="上移" onClick={() => props.onMove(node.id, -1)} />
          <OverlayBtn label="下移" onClick={() => props.onMove(node.id, 1)} />
          <OverlayBtn label="复制" onClick={() => props.onDuplicate(node.id)} />
          <OverlayBtn label="删除节点" onClick={() => props.onRemove(node.id)} />
        </>
      )}
    </Overlay>
  );
}

function textChildren(node: CanvasNode): React.ReactNode {
  const t = node.props.children;
  return typeof t === "string" && t ? t : undefined;
}

export default function RendererNode(props: RendererNodeProps) {
  const { node, selectedId, onSelect, isRoot } = props;
  const sel = selectedId === node.id;
  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };
  const selOutline: CSSProperties = sel && !isRoot ? { outline: "2px solid #1c2530", outlineOffset: 2, borderRadius: 4 } : {};

  if (node.component === "div") {
    return (
      <div style={{ ...containerStyle(node), cursor: isRoot ? "default" : "pointer", ...selOutline }} onClick={isRoot ? undefined : stop} data-node-id={node.id}>
        {node.children.map((c) => (
          <RendererNode key={c.id} {...props} node={c} isRoot={false} />
        ))}
        {overlayFor(node, sel, props, isRoot)}
        {isRoot && node.children.length === 0 ? (
          <MtEmptyState title="空画布" description="从左侧组件面板双击或拖入组件" />
        ) : null}
      </div>
    );
  }

  if (node.component === "Card") {
    return (
      <Card
        title={String(node.props.title ?? "")}
        style={{ cursor: "pointer", ...selOutline }}
        styles={{ body: { display: "flex", flexDirection: node.props.direction === "horizontal" ? "row" : "column", gap: SPACING[String(node.props.gap ?? "sm")] ?? 8 } }}
        onClick={stop}
      >
        {overlayFor(node, sel, props)}
        {node.children.map((c) => (
          <RendererNode key={c.id} {...props} node={c} isRoot={false} />
        ))}
      </Card>
    );
  }

  if (node.component === "Typography.Title") {
    return (
      <Typography.Title level={Number(node.props.level ?? 3) as 1 | 2 | 3 | 4} style={{ margin: 0, cursor: "pointer" }} onClick={stop}>
        {textChildren(node)}
        {overlayFor(node, sel, props)}
      </Typography.Title>
    );
  }

  if (node.component === "Typography.Text") {
    return (
      <Typography.Text strong={Boolean(node.props.strong)} style={{ cursor: "pointer" }} onClick={stop}>
        {textChildren(node)}
        {overlayFor(node, sel, props)}
      </Typography.Text>
    );
  }

  if (node.component === "Typography.Paragraph") {
    return (
      <Typography.Paragraph style={{ cursor: "pointer" }} onClick={stop}>
        {textChildren(node)}
        {overlayFor(node, sel, props)}
      </Typography.Paragraph>
    );
  }

  if (node.component === "Button") {
    return (
      <span onClick={stop}>
        <Button type={node.props.type as "primary" | "default" | "dashed" | "text" | undefined} block={Boolean(node.props.block)}>
          {textChildren(node)}
        </Button>
        {overlayFor(node, sel, props)}
      </span>
    );
  }

  if (node.component === "MtStatusTag") {
    return (
      <span onClick={stop} style={{ cursor: "pointer" }}>
        <MtStatusTag tone={node.props.tone as "neutral" | "success" | "warning" | "error" | "info" | "accent"} emphasis={node.props.emphasis as "soft" | "solid"} mono={Boolean(node.props.mono)}>
          {textChildren(node) ?? ""}
        </MtStatusTag>
        {overlayFor(node, sel, props)}
      </span>
    );
  }

  if (node.component === "MtEmptyState") {
    return (
      <span onClick={stop} style={{ cursor: "pointer", display: "inline-block" }}>
        <MtEmptyState title={String(node.props.title ?? "")} description={String(node.props.description ?? "")} />
        {overlayFor(node, sel, props)}
      </span>
    );
  }

  return <span data-node-id={node.id}>{node.component}</span>;
}
