import { useEffect, useState } from "react";
import { Card, Typography } from "antd";

export default function App() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    fetch("/api/designer/health")
      .then((res) => (res.ok ? setStatus("up") : setStatus("down")))
      .catch(() => setStatus("down"));
  }, []);
  return (
    <Card title="designer">
      <Typography.Text>服务状态: {status}</Typography.Text>
    </Card>
  );
}
