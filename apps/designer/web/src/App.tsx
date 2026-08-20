import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu } from "antd";
import GeneratePage from "./pages/GeneratePage";
import ComponentList from "./pages/ComponentList";
import HistoryList from "./pages/HistoryList";

const MENU = [
  { key: "/generate", label: "生成" },
  { key: "/components", label: "组件库" },
  { key: "/history", label: "历史" },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = MENU.find((m) => location.pathname.startsWith(m.key))?.key ?? "/generate";
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header>
        <Menu theme="dark" mode="horizontal" selectedKeys={[selected]} items={MENU} onClick={(e) => navigate(e.key)} />
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/generate" replace />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/components" element={<ComponentList />} />
          <Route path="/history" element={<HistoryList />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/designer">
      <Shell />
    </BrowserRouter>
  );
}
