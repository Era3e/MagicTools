import { useEffect, useState } from "react";
import { Card, Typography } from "antd";

export default function App() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    fetch("/api/gatherer/health")
      .then((res) => (res.ok ? setStatus("up") : setStatus("down")))
      .catch(() => setStatus("down"));
  }, []);
  return (
    <Card title="gatherer">
      <Typography.Text>服务状态: {status}</Typography.Text>
    </Card>
  );
}
