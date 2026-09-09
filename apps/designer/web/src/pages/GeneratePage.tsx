import { useState } from "react";
import { Button, Input, message } from "antd";
import { api, downloadText, type GenerateResult } from "../api";
import { MtStatusTag, tokens, useTheme } from "@mt/ui";

export default function GeneratePage() {
  const theme = useTheme();
  const GALLERY = {
    ink: theme.ink,
    accent: theme.accent ?? theme.primary,
    tint: theme.tint ?? theme.paper ?? theme.background,
    muted: theme.muted,
    panel: theme.panel ?? "#ffffff",
    paper: theme.paper ?? theme.background,
    border: theme.border ?? theme.muted,
    display: theme.displayFont,
    sans: theme.bodyFont,
  };
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [genNo, setGenNo] = useState(127);

  const generate = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setResult(null);
    setPreviewId(null);
    setGenNo((n) => n + 1);
    try {
      const res = await api.generate({ prompt: text, imageUrl: imageUrl.trim() || undefined });
      setResult(res);
      if (res.status === "ok") {
        const p = await api.preview(res.code);
        if (p.ok && p.previewId) setPreviewId(p.previewId);
        else message.warning("预览编译失败：" + (p.error ?? "未知错误"));
      } else {
        message.error("生成失败：" + (res.error ?? "未知错误"));
      }
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!result || result.status !== "ok") return;
    try {
      const res = await api.addComponent({ name: result.componentName, description: result.description, code: result.code });
      message.success(res.duplicated ? "组件已存在，幂等跳过" : "已沉淀为组件库");
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <div className="pg-studio" style={{ fontFamily: GALLERY.sans, color: GALLERY.ink, display: "flex", flexDirection: "column", gap: tokens.spacing.xl }}>
      <style>{`
@media (max-width: 920px) {
  .pg-studio .pg-hero-grid { grid-template-columns: minmax(0, 1fr) !important; }
  .pg-studio .pg-booth { grid-template-columns: minmax(0, 1fr) !important; }
  .pg-studio .pg-booth > div { border-left: none !important; padding-left: 0 !important; border-top: 1px solid ${GALLERY.border}; padding-top: 16px; }
  .pg-studio .pg-booth > div:first-child { border-top: none !important; padding-top: 0 !important; }
  .pg-studio .pg-hero-title { font-size: 32px !important; }
}
@media (max-width: 720px) {
  .pg-studio .pg-result { grid-template-columns: minmax(0, 1fr) !important; }
}
`}</style>
      {/* Hero：7fr/5fr 非对称——画廊文案 + 委托单 */}
      <section className="pg-hero-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(300px, 5fr)", gap: tokens.spacing.lg, alignItems: "start" }}>
        <div style={{ paddingTop: tokens.spacing.md }}>
          <div style={{ fontFamily: tokens.font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: GALLERY.accent, fontWeight: 600, marginBottom: 12 }}>
            COMMISSION · 定制生成
          </div>
          <h1 className="pg-hero-title" style={{ margin: "0 0 14px", fontFamily: GALLERY.display, fontSize: 44, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
            下一件展品，
            <br />
            由你描述
          </h1>
          <p style={{ margin: "0 0 10px", color: GALLERY.muted, fontSize: 15, lineHeight: 1.85, maxWidth: 480 }}>
            用一句自然语言描述你要的组件，工坊代为调色、排版、成型。成品即时预览，满意即入馆藏。
          </p>
          <p style={{ margin: 0, color: GALLERY.muted, fontSize: 15, lineHeight: 1.85, maxWidth: 480 }}>
            也可以附上一张设计稿的图片链接，让模型按图施工。
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
          {/* 委托单卡 */}
          <div style={{ background: GALLERY.panel, border: "1px solid " + GALLERY.border, borderRadius: tokens.radiusTokens.md, padding: 16, display: "flex", flexDirection: "column", gap: 10, boxShadow: tokens.shadow.card }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: GALLERY.display, fontSize: 15, fontWeight: 600 }}>委托单</span>
              <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: GALLERY.muted }}>NO.{String(genNo).padStart(4, "0")}</span>
            </div>
            <label style={{ fontSize: 12, color: GALLERY.muted }}>描述你要的组件</label>
            <Input.TextArea
              placeholder="例如：一个带统计数字的深色卡片，右上角带趋势箭头"
              variant="borderless"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              style={{ background: GALLERY.paper, borderRadius: tokens.radiusTokens.sm, padding: "8px 10px", fontSize: 14 }}
            />
            <Input
              placeholder="设计稿图片 URL（可选）"
              variant="borderless"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ background: GALLERY.paper, borderRadius: tokens.radiusTokens.sm, padding: "6px 10px", color: GALLERY.muted, fontSize: 12 }}
            />
            <Button
              type="primary"
              loading={loading}
              onClick={generate}
              style={{ height: 44, background: GALLERY.accent, fontWeight: 600, letterSpacing: 4 }}
            >
              生 成
            </Button>
          </div>

          {/* 生成状态条 */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: GALLERY.panel, border: "1px solid " + GALLERY.border, borderRadius: tokens.radiusTokens.md, padding: "10px 14px" }}>
              <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: GALLERY.muted }}>GEN #{genNo} · 排版中</span>
              <div style={{ flex: 1, height: 3, background: GALLERY.paper, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "62%", background: GALLERY.accent, animation: "mt-pulse 1.2s ease-in-out infinite" }} />
              </div>
              <MtStatusTag tone="info">生成中</MtStatusTag>
            </div>
          ) : null}
        </div>
      </section>

      {/* 成品区 */}
      {result && !loading ? (
        result.status === "ok" ? (
          <section className="pg-result" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 5fr) minmax(300px, 7fr)", gap: tokens.spacing.md, alignItems: "stretch" }}>
            <div style={{ background: GALLERY.panel, border: "1px solid " + GALLERY.border, borderRadius: tokens.radiusTokens.md, padding: 16, display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: GALLERY.display, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{result.componentName}</div>
              <div style={{ color: GALLERY.muted, fontSize: 12, marginBottom: 12, flex: 1 }}>{result.description}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="small" onClick={() => downloadText(result.componentName + ".tsx", result.code)}>
                  下载源码
                </Button>
                <Button size="small" type="primary" onClick={save} style={{ background: GALLERY.accent }}>
                  收入馆藏
                </Button>
              </div>
            </div>
            <div style={{ border: "1px solid " + GALLERY.border, background: GALLERY.paper, borderRadius: tokens.radiusTokens.md, minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {previewId ? (
                <iframe
                  title="preview"
                  src={api.previewUrl(previewId)}
                  sandbox="allow-scripts"
                  style={{ width: "100%", height: 360, border: "none" }}
                />
              ) : (
                <span style={{ color: GALLERY.muted, fontSize: 12 }}>展品编译中……</span>
              )}
            </div>
          </section>
        ) : (
          <div style={{ border: "1px dashed " + GALLERY.accent, padding: 24, textAlign: "center", color: GALLERY.accent, borderRadius: tokens.radiusTokens.md }}>
            <MtStatusTag tone="error">生成失败</MtStatusTag>
            <div style={{ marginTop: 8, fontSize: 13 }}>{result.error ?? "未知错误"}</div>
          </div>
        )
      ) : null}

      {/* 展位说明 */}
      <section className="pg-booth" style={{ background: GALLERY.panel, border: "1px solid " + GALLERY.border, borderRadius: tokens.radiusTokens.md, padding: tokens.spacing.lg, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: tokens.spacing.lg }}>
        {[
          { no: "01", title: "描述委托", desc: "用自然语言写下你要的组件，或附设计稿链接。" },
          { no: "02", title: "工坊成型", desc: "模型按委托生成 TSX 源码，并即时编译预览。" },
          { no: "03", title: "入馆陈展", desc: "满意即收入组件馆藏，可一键 PR 到 @mt/ui。" },
        ].map((s, i) => (
          <div key={s.no} style={{ paddingLeft: i === 0 ? 0 : tokens.spacing.lg, borderLeft: i === 0 ? undefined : "1px solid " + GALLERY.border }}>
            <div style={{ fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600, color: GALLERY.accent, marginBottom: 6 }}>{s.no}</div>
            <div style={{ fontFamily: GALLERY.display, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
            <div style={{ color: GALLERY.muted, fontSize: 13, lineHeight: 1.7 }}>{s.desc}</div>
          </div>
        ))}
      </section>
      <style>{`@keyframes mt-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}
