import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@mt/ui";
import EntryList from "./pages/EntryList";
import SearchPage from "./pages/SearchPage";
import GraphPage from "./pages/GraphPage";
import SettingsPage from "./pages/SettingsPage";

const NAV = [
  { key: "/entries", label: "条目" },
  { key: "/search", label: "检索" },
  { key: "/graph", label: "图谱" },
  { key: "/settings", label: "设置" },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/entries";
  return (
    <AppShell title="知识" navItems={NAV} selectedKey={selected} onNavigate={(key) => navigate(key)}>
      <Routes>
        <Route path="/" element={<Navigate to="/entries" replace />} />
        <Route path="/entries" element={<EntryList />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/scholar">
      <Shell />
    </BrowserRouter>
  );
}
