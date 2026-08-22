import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@mt/ui";
import GeneratePage from "./pages/GeneratePage";
import ComponentList from "./pages/ComponentList";
import HistoryList from "./pages/HistoryList";

const NAV = [
  { key: "/generate", label: "生成" },
  { key: "/components", label: "组件库" },
  { key: "/history", label: "历史" },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/generate";
  return (
    <AppShell title="设计" navItems={NAV} selectedKey={selected} onNavigate={(key) => navigate(key)}>
      <Routes>
        <Route path="/" element={<Navigate to="/generate" replace />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/components" element={<ComponentList />} />
        <Route path="/history" element={<HistoryList />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/designer">
      <Shell />
    </BrowserRouter>
  );
}
