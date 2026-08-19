import { Button, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useState } from "react";
import { api } from "../api";
import type { PositionFormValues } from "./PositionForm";

export function ImageUploadPanel(props: { onParsed: (values: PositionFormValues) => void }) {
  const [loading, setLoading] = useState(false);

  return (
    <Upload
      accept="image/*"
      showUploadList={false}
      customRequest={async (options) => {
        const file = options.file as File;
        const form = new FormData();
        form.append("file", file);
        setLoading(true);
        try {
          const data = await api.parseImage(form);
          props.onParsed({
            company: data.company,
            title: data.title,
            city: data.city,
            salary: data.salary,
            source: "screenshot",
            jdRaw: "（截图识别）" + data.keywords.join("、"),
          });
          message.success("识别完成，请确认后保存");
        } catch (err) {
          message.error(String(err));
        } finally {
          setLoading(false);
        }
      }}
    >
      <Button icon={<UploadOutlined />} loading={loading}>
        上传截图识别
      </Button>
    </Upload>
  );
}
