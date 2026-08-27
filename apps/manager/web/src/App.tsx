import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell } from "@mt/ui";
import RequirementList from "./pages/RequirementList";
import RequirementBoard from "./pages/RequirementBoard";
import RequirementDetail from "./pages/RequirementDetail";
import IterationList from "./pages/IterationList";

const COCKPIT_THEME = {
  // UserShellTheme 标准字段
  primary: "#0ea5e9",
  background: "#f0f4f8",
  ink: "#0f172a",
  muted: "#64748b",
  displayFont: '"Consolas", "Microsoft YaHei", monospace',
  bodyFont: '"Segoe UI", "Microsoft YaHei", sans-serif',
  // Flight Deck 扩展色板（页面通过 useTheme() 访问，避免页面硬编码）
  sky: "#0ea5e9",
  panel: "#f8fafc",
  bg: "#e8eef5",
  border: "#cbd5e1",
  mono: '"Consolas", "Microsoft YaHei", monospace',
  sans: '"Segoe UI", "Microsoft YaHei", sans-serif',
};

const USER_NAV = [{ key: "/requirements", label: "需求台" }];

const ADMIN_NAV = [
  { key: "/admin/requirements", label: "需求管理" },
  { key: "/admin/iterations", label: "迭代管理" },
];

function UserRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/requirements" replace />} />
      <Route path="/requirements" element={<RequirementBoard />} />
      <Route path="/requirements/:id" element={<RequirementDetail />} />
      <Route path="/iterations" element={<Navigate to="/admin/iterations" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin/requirements" replace />} />
    </Routes>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/requirements" replace />} />
      <Route path="/admin/requirements" element={<RequirementList />} />
      <Route path="/admin/requirements/:id" element={<RequirementDetail />} />
      <Route path="/admin/iterations" element={<IterationList />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) {
    const selected = ADMIN_NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/admin/requirements";
    return (
      <AdminShell
        title="管理"
        navItems={ADMIN_NAV}
        selectedKey={selected}
        onNavigate={(key) => navigate(key)}
        frontPath="/requirements"
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  return (
    <UserShell
      title="交付驾驶舱"
      subtitle="需求在轨，交付有期"
      navItems={USER_NAV}
      selectedKey="/requirements"
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/requirements"
      footerNote="管理 · Manager Cockpit"
      theme={COCKPIT_THEME}
    >
      <UserRoutes />
    </UserShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/manager">
      <Shell />
    </BrowserRouter>
  );
}
