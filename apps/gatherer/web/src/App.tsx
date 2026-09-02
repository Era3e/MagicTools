import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell } from "@mt/ui";
import SourceList from "./pages/SourceList";
import SourceDetail from "./pages/SourceDetail";
import ItemList from "./pages/ItemList";

const PRESS_THEME = {
  primary: "#1f3a5c",
  background: "#f7f7f4",
  ink: "#141a20",
  muted: "#5f6c7c",
  displayFont: '"JetBrains Mono", "Cascadia Mono", Consolas, "Noto Sans SC", monospace',
  bodyFont: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
};

const ADMIN_NAV = [{ key: "/admin/sources", label: "信息源管理" }];

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/sources" replace />} />
      <Route path="/admin/sources" element={<SourceList />} />
      <Route path="/admin/sources/:id" element={<SourceDetail />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) {
    return (
      <AdminShell
        title="采集"
        navItems={ADMIN_NAV}
        selectedKey="/admin/sources"
        onNavigate={(key) => navigate(key)}
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  return (
    <UserShell
      title="知识采集部"
      subtitle="网络世界的消息，由本报为你搜集"
      navItems={[]}
      selectedKey="/admin/sources"
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/sources"
      footerNote="采集 · Gatherer Press"
      theme={PRESS_THEME}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/admin/sources" replace />} />
        <Route path="/sources" element={<Navigate to="/admin/sources" replace />} />
        <Route path="/sources/:id" element={<SourceDetail />} />
        <Route path="/sources/:sourceId/items" element={<ItemList />} />
        <Route path="/admin/*" element={<Navigate to="/admin/sources" replace />} />
      </Routes>
    </UserShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/gatherer">
      <Shell />
    </BrowserRouter>
  );
}
