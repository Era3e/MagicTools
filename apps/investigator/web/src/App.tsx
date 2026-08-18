import { useEffect, useState } from "react";
import { Card, Typography } from "antd";

export default function App() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    fetch("/api/investigator/health")
      .then((res) => (res.ok ? setStatus("up") : setStatus("down")))
      .catch(() => setStatus("down"));
  }, []);
  return (
    <Card title="investigator">
      <Typography.Text>服务状态: {status}</Typography.Text>
    </Card>
  );
}
