import { useState } from "react";
import { Button, Input, Tag, message } from "antd";
import { api, downloadText, type GenerateResult } from "../api";

const GALLERY = {
  ink: "#111111",
  accent: "#dc2626",
  muted: "#9ca3af",
  paper: "#fafafa",
  border: "#e5e5e5",
  sans: '"Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
};

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const generate = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setResult(null);
    setPreviewId(null);
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
    <div style={{ fontFamily: GALLERY.sans, color: GALLERY.ink }}>
      <div style={{ textAlign: "center", letterSpacing: 10, fontSize: 11, color: GALLERY.muted, marginBottom: 20 }}>
        C O M M I S S I O N · 定 制 生 成
      </div>

      <div style={{ border: "1px solid " + GALLERY.ink, padding: "20px 24px 16px", marginBottom: 24 }}>
        <Input.TextArea
          placeholder="描述你要生成的组件，例如：一个带统计数字的卡片"
          variant="borderless"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ fontSize: 16, marginBottom: 8 }}
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid " + GALLERY.border, paddingTop: 12 }}>
          <Input
            placeholder="设计稿图片 URL（可选）"
            variant="borderless"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            style={{ color: GALLERY.muted }}
          />
          <Button
            type="text"
            loading={loading}
            onClick={generate}
            style={{ border: "1px solid " + GALLERY.ink, borderRadius: 0, letterSpacing: 4, fontWeight: 600, paddingInline: 20 }}
          >
            生 成
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ height: 360, display: "flex", alignItems: "center", justifyContent: "center", color: GALLERY.muted, border: "1px dashed " + GALLERY.border }}>
          正在为你调色……
        </div>
      ) : null}

      {result && !loading ? (
        result.status === "ok" ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 5fr) minmax(300px, 7fr)", gap: 20, alignItems: "stretch" }}>
            <section style={{ border: "1px solid " + GALLERY.ink, padding: 16, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{result.componentName}</div>
              <div style={{ color: GALLERY.muted, fontSize: 12, marginBottom: 12, flex: 1 }}>{result.description}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  size="small"
                  onClick={() => downloadText(result.componentName + ".tsx", result.code)}
                  style={{ borderRadius: 0 }}
                >
                  下载源码
                </Button>
                <Button
                  size="small"
                  type="primary"
                  onClick={save}
                  style={{ borderRadius: 0, background: GALLERY.ink }}
                >
                  收入馆藏
                </Button>
              </div>
            </section>
            <section style={{ border: "1px solid " + GALLERY.border, background: GALLERY.paper, minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
            </section>
          </div>
        ) : (
          <div style={{ border: "1px dashed " + GALLERY.accent, padding: 24, textAlign: "center", color: GALLERY.accent }}>
            <Tag color="red">生成失败</Tag>
            <div style={{ marginTop: 8, fontSize: 13 }}>{result.error ?? "未知错误"}</div>
          </div>
        )
      ) : null}
    </div>
  );
}
