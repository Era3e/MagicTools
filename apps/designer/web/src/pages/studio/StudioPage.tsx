import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button, Input, message } from "antd";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { tokens } from "@mt/ui";
import { api, downloadText } from "../../api";
import { addNode, createEmptyDoc, createNode, duplicateNode, findNode, isContainerNode, moveNode, removeNode, renameComponent, setDocDescription, updateNodeProps, type CanvasDoc, type PropValue } from "../../canvas/schema";
import { schemaToCode } from "../../canvas/codegen";
import { metaByComponent } from "../../canvas/registry";
import Palette from "./Palette";
import PropForm from "./PropForm";
import CodePanel from "./CodePanel";
import RendererNode from "./CanvasRenderer";
import CanvasDropZone from "./CanvasDropZone";

interface StudioState {
  doc?: CanvasDoc;
}

export default function StudioPage() {
  const location = useLocation();
  const incoming = (location.state as StudioState | null)?.doc;
  const [doc, setDoc] = useState<CanvasDoc>(() => (incoming ? { ...incoming } : createEmptyDoc("MyComponent")));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState<string>("");
  const [codeDirty, setCodeDirty] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    setCode(schemaToCode(doc));
    setCodeDirty(false);
  }, [doc]);

  const selected = useMemo(() => (selectedId ? findNode(doc, selectedId) : undefined), [doc, selectedId]);
  const selectedMeta = selected ? metaByComponent(selected.component) : undefined;

  const targetContainerId = useMemo(() => {
    if (selected && isContainerNode(selected)) return selected.id;
    return doc.root.id;
  }, [doc, selected]);

  const addToCanvas = (key: string) => {
    const node = createNode(key);
    setDoc((d) => addNode(d, targetContainerId, node));
    setSelectedId(node.id);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { type?: string; key?: string } | undefined;
    if (data?.type === "palette" && data.key) setDraggingKey(data.key);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDraggingKey(null);
    const data = e.active.data.current as { type?: string; key?: string } | undefined;
    if (data?.type !== "palette" || !data.key) return;
    if (e.over) addToCanvas(data.key);
  };

  const applyCode = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      const res = await api.parseCode(code);
      setDoc({ ...(res.doc as CanvasDoc) });
      setSelectedId(null);
      message.success("代码已应用到画布");
    } catch (err) {
      setApplyError(String(err instanceof Error ? err.message : err));
    } finally {
      setApplying(false);
    }
  };

  const preview = async () => {
    try {
      const res = await api.preview(code);
      if (res.ok && res.previewId) {
        setPreviewId(res.previewId);
        message.success("预览已编译");
      } else {
        message.warning("编译失败：" + (res.error ?? "未知错误"));
      }
    } catch (err) {
      message.error(String(err));
    }
  };

  const save = async () => {
    try {
      const res = await api.addComponent({
        name: doc.componentName,
        description: doc.description ?? "",
        code,
        schema: doc,
      });
      message.success(res.duplicated ? "组件已存在，幂等跳过" : "已收入馆藏（含画布 schema）");
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <div className="pg-studio-page" style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
      <style>{`
@media (max-width: 920px) {
  .pg-studio-page .sp-main { flex-direction: column !important; }
  .pg-studio-page .sp-palette { width: 100% !important; flex-direction: row !important; overflow-x: auto; }
  .pg-studio-page .sp-palette > div { min-width: 140px; }
  .pg-studio-page .sp-props { width: 100% !important; }
}
`}</style>

      <header data-testid="studio-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>STUDIO · 画布工坊</span>
        <Input
          value={doc.componentName}
          onChange={(e) => setDoc((d) => renameComponent(d, e.target.value))}
          style={{ width: 180 }}
          size="small"
          aria-label="组件名"
          placeholder="组件名（PascalCase）"
        />
        <Input
          value={doc.description ?? ""}
          onChange={(e) => setDoc((d) => setDocDescription(d, e.target.value))}
          style={{ width: 240 }}
          size="small"
          aria-label="组件描述"
          placeholder="一句话描述（可选）"
        />
        <span style={{ flex: 1 }} />
        <Button size="small" onClick={preview}>预览</Button>
        <Button size="small" onClick={() => downloadText(doc.componentName + ".tsx", code)}>下载源码</Button>
        <Button size="small" type="primary" onClick={save}>收入馆藏</Button>
      </header>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="sp-main" style={{ display: "flex", gap: tokens.spacing.md, alignItems: "flex-start" }}>
          <div className="sp-palette" style={{ width: 232, flex: "none" }}>
            <Palette onAdd={addToCanvas} />
          </div>

          <CanvasDropZone>
            <div onClick={() => setSelectedId(null)}>
              <RendererNode
                node={doc.root}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(id, dir) => setDoc((d) => moveNode(d, id, dir))}
                onDuplicate={(id) => setDoc((d) => duplicateNode(d, id))}
                onRemove={(id) => {
                  setDoc((d) => removeNode(d, id));
                  setSelectedId(null);
                }}
                isRoot
              />
            </div>
          </CanvasDropZone>

          <aside className="sp-props" data-testid="studio-props" style={{ width: 288, flex: "none" }}>
            <div style={{ border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radiusTokens.md, padding: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, marginBottom: 10 }}>属性面板</div>
              {selected && selectedMeta ? (
                <PropForm
                  fields={selectedMeta.propFields}
                  values={selected.props}
                  onChange={(name, value: PropValue) => setDoc((d) => updateNodeProps(d, selected.id, { [name]: value }))}
                />
              ) : (
                <p style={{ fontSize: 12.5, opacity: 0.65, margin: 0 }}>选中节点后在此编辑属性；双击左侧组件卡片可快速添加到当前容器。</p>
              )}
            </div>
            {previewId ? (
              <div style={{ marginTop: 12, border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radiusTokens.md, overflow: "hidden" }}>
                <iframe title="studio-preview" src={api.previewUrl(previewId)} sandbox="allow-scripts" style={{ width: "100%", height: 300, border: "none" }} />
              </div>
            ) : null}
          </aside>
        </div>

        <DragOverlay>
          {draggingKey ? (
            <div style={{ padding: "8px 12px", background: tokens.scale.ink[8], color: tokens.scale.ink[0], borderRadius: 6, fontSize: 12 }}>
              {draggingKey}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <section style={{ border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radiusTokens.md, padding: 14 }}>
        <CodePanel code={code} dirty={codeDirty} onCodeChange={(c) => { setCode(c); setCodeDirty(true); setApplyError(null); }} onApply={applyCode} applying={applying} error={applyError} />
      </section>
    </div>
  );
}
