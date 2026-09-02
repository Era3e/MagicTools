import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell } from "@mt/ui";
import RequestList from "./pages/RequestList";
import RequestDetail from "./pages/RequestDetail";

const BRIEF_THEME = {
  primary: "#6e3b28",
  background: "#f6f2ea",
  ink: "#251f1a",
  muted: "#7a7066",
  displayFont: '"Noto Serif SC", "Source Serif 4", "Songti SC", serif',
  bodyFont: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
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
        title="评审"
        navItems={ADMIN_NAV}
        selectedKey="/admin/requests"
        onNavigate={(key) => navigate(key)}
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  return (
    <UserShell
      title="评审文书房"
      subtitle="每一份方案，都经三读而定"
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
