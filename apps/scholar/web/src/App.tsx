import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout, Menu } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import EntryList from "./pages/EntryList";
import SearchPage from "./pages/SearchPage";
import GraphPage from "./pages/GraphPage";
import SettingsPage from "./pages/SettingsPage";

const MENU = [
  { key: "/entries", label: "条目" },
  { key: "/search", label: "检索" },
  { key: "/graph", label: "图谱" },
  { key: "/settings", label: "设置" },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = MENU.find((m) => location.pathname.startsWith(m.key))?.key ?? "/entries";
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header>
        <Menu theme="dark" mode="horizontal" selectedKeys={[selected]} items={MENU} onClick={(e) => navigate(e.key)} />
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/entries" replace />} />
          <Route path="/entries" element={<EntryList />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/scholar">
      <Shell />
    </BrowserRouter>
  );
}
