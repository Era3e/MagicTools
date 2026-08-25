import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell } from "@mt/ui";
import GeneratePage from "./pages/GeneratePage";
import ComponentList from "./pages/ComponentList";
import HistoryList from "./pages/HistoryList";

const GALLERY_THEME = {
  primary: "#111111",
  background: "#ffffff",
  ink: "#111111",
  muted: "#9ca3af",
  displayFont: '"Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
  bodyFont: '"Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
};

const ADMIN_NAV = [
  { key: "/admin/components", label: "组件馆藏" },
  { key: "/admin/history", label: "生成历史" },
];

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/components" replace />} />
      <Route path="/admin/components" element={<ComponentList />} />
      <Route path="/admin/history" element={<HistoryList />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) {
    const selected = ADMIN_NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/admin/components";
    return (
      <AdminShell
        title="设计"
        navItems={ADMIN_NAV}
        selectedKey={selected}
        onNavigate={(key) => navigate(key)}
        frontPath="/generate"
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  return (
    <UserShell
      title="组件画廊"
      subtitle="描述你的想象，取走你的组件"
      navItems={[{ key: "/generate", label: "定制生成" }]}
      selectedKey="/generate"
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/components"
      footerNote="设计 · Designer Gallery"
      theme={GALLERY_THEME}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/generate" replace />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/components" element={<Navigate to="/admin/components" replace />} />
        <Route path="/history" element={<Navigate to="/admin/history" replace />} />
        <Route path="/admin/*" element={<Navigate to="/admin/components" replace />} />
      </Routes>
    </UserShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/designer">
      <Shell />
    </BrowserRouter>
  );
}
