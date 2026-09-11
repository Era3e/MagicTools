import { useDraggable } from "@dnd-kit/core";
import { tokens } from "@mt/ui";
import { PALETTE_GROUPS, REGISTRY } from "../../canvas/registry";

export interface PaletteProps {
  onAdd: (key: string) => void;
}

function PaletteCard({ metaKey, label, onAdd }: { metaKey: string; label: string; onAdd: (key: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: "palette-" + metaKey, data: { type: "palette", key: metaKey } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={"palette-" + metaKey}
      onDoubleClick={() => onAdd(metaKey)}
      title="拖入画布，或双击快速添加"
      style={{
        padding: "8px 10px",
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 6,
        background: tokens.color.bgUser,
        fontSize: 12.5,
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
        userSelect: "none",
      }}
    >
      {label}
    </div>
  );
}

export default function Palette({ onAdd }: PaletteProps) {
  return (
    <aside data-testid="palette" style={{ width: 232, flex: "none", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
      {PALETTE_GROUPS.map((group) => (
        <div key={group}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, marginBottom: 6 }}>{group}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {REGISTRY.filter((m) => m.group === group).map((m) => (
              <PaletteCard key={m.key} metaKey={m.key} label={m.label} onAdd={onAdd} />
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
