import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell, appAccent } from "@mt/ui";
import RequestList from "./pages/RequestList";
import RequestDetail from "./pages/RequestDetail";

const ACCENT = appAccent("assessor");

const BRIEF_THEME = {
  primary: "#6e3b28",
  background: "#f4f6f8",
  ink: "#251f1a",
  muted: "#5f6c7c",
  displayFont: '"Noto Serif SC", "Source Serif 4", "Songti SC", serif',
  bodyFont: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  accent: "#6e3b28",
  tint: "#f2e9e4",
  panel: "#ffffff",
};

const ADMIN_NAV = [{ key: "/admin/requests", label: "分析请求审批" }];

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/requests" replace />} />
      <Route path="/admin/requests" element={<RequestList />} />
      <Route path="/admin/requests/:id" element={<RequestDetail />} />
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
        title="评审工坊"
        navItems={ADMIN_NAV}
        selectedKey="/admin/requests"
        onNavigate={(key) => navigate(key)}
        eyebrow={ACCENT.controlEyebrow ?? ACCENT.controlKey}
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  return (
    <UserShell
      title="评审工坊"
      subtitle={ACCENT.subtitle}
      eyebrow={ACCENT.frontEyebrow}
      navItems={[]}
      selectedKey="/admin/requests"
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/requests"
      footerNote="评审 · Assessor Bureau"
      theme={BRIEF_THEME}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/admin/requests" replace />} />
        <Route path="/requests" element={<Navigate to="/admin/requests" replace />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/admin/*" element={<Navigate to="/admin/requests" replace />} />
      </Routes>
    </UserShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/assessor">
      <Shell />
    </BrowserRouter>
  );
}
