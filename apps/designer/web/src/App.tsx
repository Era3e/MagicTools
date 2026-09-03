import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell } from "@mt/ui";
import GeneratePage from "./pages/GeneratePage";
import ComponentList from "./pages/ComponentList";
import HistoryList from "./pages/HistoryList";

const GALLERY_THEME = {
  primary: "#1c2530",
  background: "#fcfcfc",
  ink: "#1c2530",
  muted: "#8b98a8",
  displayFont: '"Noto Sans SC", "PingFang SC", "Helvetica Neue", sans-serif',
  bodyFont: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  accent: "#943d35",
  paper: "#f4f6f8",
  border: "#e3e6ea",
};

const ADMIN_NAV = [
  { key: "/admin/components", label: "组件馆藏" },
  { key: "/admin/history", label: "生成历史" },
];

const USER_NAV = [
  { key: "/generate", label: "定制生成" },
  { key: "/components", label: "组件馆藏" },
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

  const selected = USER_NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/generate";
  return (
    <UserShell
      title="组件画廊"
      subtitle="描述你的想象，取走你的组件"
      navItems={USER_NAV}
      selectedKey={selected}
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/components"
      footerNote="设计 · Designer Gallery"
      theme={GALLERY_THEME}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/generate" replace />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/components" element={<ComponentList />} />
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
