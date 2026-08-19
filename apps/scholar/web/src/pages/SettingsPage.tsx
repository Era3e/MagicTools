import { useEffect, useState } from "react";
import { Button, Card, Descriptions, Input, Space, Tag, message } from "antd";
import { api } from "../api";

interface EmbeddingStatus {
  stub: boolean;
  provider: string;
  model: string;
  apiKeyConfigured: boolean;
}

export default function SettingsPage() {
  const [vaultPath, setVaultPath] = useState("");
  const [status, setStatus] = useState<EmbeddingStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => setVaultPath(s.vaultPath)).catch((err) => message.error(String(err)));
    api.embeddingStatus().then(setStatus).catch((err) => message.error(String(err)));
  }, []);

  const save = async () => {
    await api.patchSettings(vaultPath);
    message.success("vault 路径已保存");
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api.syncObsidian();
      message.success("同步完成：扫描 " + r.scanned + "，导入 " + r.created + " 条，跳过 " + r.skipped + " 条");
    } catch (err) {
      message.error(String(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <Card title="Obsidian 同步">
        <Space.Compact style={{ width: 480 }}>
          <Input placeholder="vault 目录路径（服务器本机）" value={vaultPath} onChange={(e) => setVaultPath(e.target.value)} />
          <Button type="primary" onClick={save}>
            保存
          </Button>
        </Space.Compact>
        <Button style={{ marginLeft: 12 }} loading={syncing} onClick={sync}>
          同步 Obsidian
        </Button>
      </Card>
      <Card title="Embedding 状态">
        <Descriptions size="small">
          <Descriptions.Item label="供应商">{status?.provider ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="模型">{status?.model ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="模式">
            {status ? <Tag color={status.stub ? "orange" : "green"}>{status.stub ? "桩模式" : "真实调用"}</Tag> : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="API Key">{status?.apiKeyConfigured ? "已配置" : "未配置"}</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}
