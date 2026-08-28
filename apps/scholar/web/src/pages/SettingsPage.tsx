import { useEffect, useState } from "react";
import { Button, Card, Descriptions, Input, Space, Tag, Modal, Table, message } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useTheme } from "@mt/ui";
import { api, type ConflictInfo } from "../api";

interface EmbeddingStatus {
  stub: boolean;
  provider: string;
  model: string;
  apiKeyConfigured: boolean;
}

export default function SettingsPage() {
  const theme = useTheme();
  const [vaultPath, setVaultPath] = useState("");
  const [status, setStatus] = useState<EmbeddingStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeContent, setMergeContent] = useState("");
  const [currentConflict, setCurrentConflict] = useState<ConflictInfo | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => setVaultPath(s.vaultPath)).catch((err) => message.error(String(err)));
    api.embeddingStatus().then(setStatus).catch((err) => message.error(String(err)));
    api.listConflicts().then(setConflicts).catch(() => setConflicts([]));
  }, []);

  const save = async () => {
    await api.patchSettings(vaultPath);
    message.success("vault 路径已保存");
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api.syncObsidian();
      message.success(
        "同步完成：扫描 " + r.scanned + "，导入 " + r.created + " 条，跳过 " + r.skipped + " 条" +
        (r.conflicts.length > 0 ? "，冲突 " + r.conflicts.length + " 条" : "")
      );
      if (r.conflicts.length > 0) {
        setConflicts(r.conflicts);
      }
    } catch (err) {
      message.error(String(err));
    } finally {
      setSyncing(false);
    }
  };

  const resolveOne = async (entryId: string, strategy: "keep-db" | "take-obsidian" | "merge", mergedContent?: string) => {
    setResolving(entryId);
    try {
      await api.resolveConflict(entryId, strategy, mergedContent);
      message.success("冲突已解决");
      setConflicts((prev) => prev.filter((c) => c.entryId !== entryId));
    } catch (err) {
      message.error(String(err));
    } finally {
      setResolving(null);
    }
  };

  const keepDb = (entry: ConflictInfo) => resolveOne(entry.entryId, "keep-db");
  const takeObsidian = (entry: ConflictInfo) => resolveOne(entry.entryId, "take-obsidian");

  const openMerge = (entry: ConflictInfo) => {
    setCurrentConflict(entry);
    setMergeContent(entry.dbContent); // 默认以数据库版本为基础
    setMergeModalOpen(true);
  };

  const confirmMerge = async () => {
    if (!currentConflict) return;
    await resolveOne(currentConflict.entryId, "merge", mergeContent);
    setMergeModalOpen(false);
    setCurrentConflict(null);
  };

  const conflictColumns = [
    { title: "文件路径", dataIndex: "sourceRef", key: "sourceRef", width: 200 },
    { title: "标题", dataIndex: "title", key: "title", width: 150 },
    {
      title: "数据库版本",
      key: "db",
      width: 250,
      render: (_: unknown, r: ConflictInfo) => (
        <div style={{ maxHeight: 80, overflow: "auto", fontSize: 12 }}>
          {r.dbContent.slice(0, 200)}
        </div>
      ),
    },
    {
      title: "Obsidian 版本",
      key: "obs",
      width: 250,
      render: (_: unknown, r: ConflictInfo) => (
        <div style={{ maxHeight: 80, overflow: "auto", fontSize: 12 }}>
          {r.obsidianContent.slice(0, 200)}
        </div>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 280,
      render: (_: unknown, r: ConflictInfo) => (
        <Space>
          <Button size="small" loading={resolving === r.entryId} onClick={() => keepDb(r)}>
            保留数据库
          </Button>
          <Button size="small" type="primary" loading={resolving === r.entryId} onClick={() => takeObsidian(r)}>
            采用 Obsidian
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openMerge(r)}>
            合并编辑
          </Button>
        </Space>
      ),
    },
  ];

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

      {conflicts.length > 0 && (
        <Card
          title={
            <Space>
              <span>待解决冲突</span>
              <Tag color="orange">{conflicts.length} 条</Tag>
            </Space>
          }
        >
          <Table
            rowKey="entryId"
            size="small"
            dataSource={conflicts}
            columns={conflictColumns}
            pagination={false}
            scroll={{ y: 300 }}
          />
        </Card>
      )}

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

      <Modal
        title={"合并编辑：" + (currentConflict?.title ?? "")}
        open={mergeModalOpen}
        onOk={confirmMerge}
        onCancel={() => setMergeModalOpen(false)}
        okText="确认合并"
        cancelText="取消"
        width={720}
      >
        {currentConflict && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <div style={{ fontSize: 12, color: theme.muted }}>
              左侧数据库版本，右侧 Obsidian 版本。编辑下方文本框进行合并。
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, marginBottom: 4, color: theme.muted }}>数据库版本</div>
                <div
                  style={{
                    maxHeight: 200,
                    overflow: "auto",
                    padding: 8,
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {currentConflict.dbContent}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, marginBottom: 4, color: theme.muted }}>Obsidian 版本</div>
                <div
                  style={{
                    maxHeight: 200,
                    overflow: "auto",
                    padding: 8,
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {currentConflict.obsidianContent}
                </div>
              </div>
            </div>
            <Input.TextArea
              rows={10}
              value={mergeContent}
              onChange={(e) => setMergeContent(e.target.value)}
              placeholder="在此编辑合并后的内容..."
            />
          </Space>
        )}
      </Modal>
    </Space>
  );
}
