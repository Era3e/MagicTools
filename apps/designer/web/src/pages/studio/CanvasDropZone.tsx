import { useDroppable } from "@dnd-kit/core";
import { tokens } from "@mt/ui";
import type { ReactNode } from "react";

export interface CanvasDropZoneProps {
  children: ReactNode;
}

/** 画布放置区：dnd-kit droppable 注册点（拖拽链路的 over 判定依赖此组件） */
export default function CanvasDropZone({ children }: CanvasDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-root", data: { type: "canvas-root" } });
  return (
    <main
      ref={setNodeRef}
      data-testid="studio-canvas"
      data-droppable-id="canvas-root"
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 420,
        padding: 20,
        border: `1px ${isOver ? "dashed" : "solid"} ${isOver ? tokens.color.info : tokens.color.border}`,
        borderRadius: tokens.radiusTokens.md,
        background: tokens.scale.graphite[0],
        backgroundImage: "radial-gradient(rgba(128,128,128,0.25) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        boxShadow: isOver ? `inset 0 0 0 2px ${tokens.scale.info[1]}` : undefined,
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
      onClick={() => {
        /* 取消选中由父级处理（子节点 stopPropagation 透传） */
      }}
    >
      {children}
    </main>
  );
}
