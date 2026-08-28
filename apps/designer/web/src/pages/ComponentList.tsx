import { useEffect, useState } from "react";
import { Button, Card, Modal, Space, Table, Tag, Typography, message, Tooltip } from "antd";
import { api, downloadText, type ComponentItem } from "../api";
import { tokens } from "@mt/ui";

export default function ComponentList() {
  const [items, setItems] = useState<ComponentItem[]>([]);
  const [viewing, setViewing] = useState<ComponentItem | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [prResult, setPrResult] = useState<{ prUrl: string; prNumber: number; message: string } | null>(null);

  const refresh = () => api.listComponents().then(setItems).catch((err) => message.error(String(err)));

  useEffect(() => {
    refresh();
  }, []);

  const remove = async (id: string) => {
    try {
      await api.deleteComponent(id);
      message.success("已删除");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  const publish = async (id: string) => {
    setPublishingId(id);
    setPrResult(null);
    try {
      const res = await api.publishComponent(id);
      if (res.ok) {
        setPrResult({ prUrl: res.prUrl, prNumber: res.prNumber, message: res.message });
        message.success(res.message);
      }
    } catch (err) {
      message.error("PR 提交失败：" + String(err));
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <>
      <Card title="组件库">
        <Table<ComponentItem>
          rowKey="id"
          dataSource={items}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "名称", dataIndex: "name", render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
            { title: "描述", dataIndex: "description", render: (v: string) => v || "-" },
            {
              title: "沉淀时间",
              dataIndex: "createdAt",
              width: 180,
              render: (v: string) => new Date(v).toLocaleString(),
            },
            {
              title: "操作",
              width: 320,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => setViewing(row)}>查看</Button>
                  <Button size="small" onClick={() => downloadText(row.name + ".tsx", row.code)}>下载</Button>
                  <Tooltip title="一键 PR 到 @mt/ui 主仓">
                    <Button
                      size="small"
                      type="primary"
                      loading={publishingId === row.id}
                      onClick={() => publish(row.id)}
                    >
                      一键 PR
                    </Button>
                  </Tooltip>
                  <Button size="small" danger onClick={() => remove(row.id)}>删除</Button>
                </Space>
              ),
            },
          ]}
        />
        <Modal title={viewing?.name} open={Boolean(viewing)} onCancel={() => setViewing(null)} footer={null} width={720}>
          {viewing ? (
            <>
              <Tag>{viewing.description || "无描述"}</Tag>
              <pre style={{ maxHeight: 420, overflow: "auto", background: tokens.color.bgNeutral, padding: 12, borderRadius: 6 }}>
                {viewing.code}
              </pre>
            </>
          ) : null}
        </Modal>
      </Card>

      <Modal
        title="🎉 PR 已创建"
        open={Boolean(prResult)}
        onCancel={() => setPrResult(null)}
        footer={[
          <Button key="close" onClick={() => setPrResult(null)}>关闭</Button>,
          <Button key="open" type="primary" onClick={() => prResult && window.open(prResult.prUrl, "_blank")}>查看 PR #{prResult?.prNumber}</Button>,
        ]}
      >
        {prResult && (
          <>
            <Typography.Paragraph>
              <Typography.Text strong>组件已成功提交到 @mt/ui 主仓！</Typography.Text>
            </Typography.Paragraph>
            <Typography.Paragraph>
              PR 编号：<Tag color="blue">#{prResult.prNumber}</Tag>
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Link href={prResult.prUrl} target="_blank" rel="noreferrer">
                {prResult.prUrl}
              </Typography.Link>
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary">
              请在 GitHub 上完成 Code Review，合入后组件即自动生效。
            </Typography.Paragraph>
          </>
        )}
      </Modal>
    </>
  );
}
