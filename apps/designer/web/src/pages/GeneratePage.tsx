import { useState } from "react";
import { Button, Card, Input, Space, Tag, Typography, message } from "antd";
import { api, downloadText, type GenerateResult } from "../api";

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
    <Card title="组件生成">
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Input.TextArea
          placeholder="描述你要生成的组件，例如：一个带统计数字的卡片"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Input
          placeholder="设计稿图片 URL（可选）"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <Button type="primary" loading={loading} onClick={generate}>
          生成
        </Button>
        {result ? (
          <>
            <Space>
              <Typography.Text strong>{result.componentName}</Typography.Text>
              {result.status === "ok" ? <Tag color="green">生成成功</Tag> : <Tag color="red">生成失败</Tag>}
              {result.description ? <Typography.Text type="secondary">{result.description}</Typography.Text> : null}
              {result.status === "ok" ? (
                <>
                  <Button onClick={() => downloadText(result.componentName + ".tsx", result.code)}>下载</Button>
                  <Button type="primary" onClick={save}>沉淀</Button>
                </>
              ) : null}
            </Space>
            {result.code ? (
              <pre style={{ maxHeight: 260, overflow: "auto", background: "#f6f6f6", padding: 12, borderRadius: 6 }}>
                {result.code}
              </pre>
            ) : null}
            {previewId ? (
              <iframe
                title="preview"
                src={api.previewUrl(previewId)}
                sandbox="allow-scripts"
                style={{ width: "100%", height: 360, border: "1px solid #eee", borderRadius: 6 }}
              />
            ) : null}
          </>
        ) : null}
      </Space>
    </Card>
  );
}
