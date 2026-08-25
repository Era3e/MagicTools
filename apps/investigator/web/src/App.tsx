import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell } from "@mt/ui";
import SurveyList from "./pages/SurveyList";
import SurveyDetail from "./pages/SurveyDetail";

const ARCHIVE_THEME = {
  primary: "#8a6d3b",
  background: "#f7f3ea",
  ink: "#2d2a24",
  muted: "#8c8578",
  displayFont: '"Courier New", "Noto Serif SC", monospace',
  bodyFont: '"Noto Serif SC", "Courier New", monospace',
};

const ADMIN_NAV = [{ key: "/admin/surveys", label: "主题档案管理" }];

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/surveys" replace />} />
      <Route path="/admin/surveys" element={<SurveyList />} />
      <Route path="/admin/surveys/:id" element={<SurveyDetail />} />
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
        title="调研"
        navItems={ADMIN_NAV}
        selectedKey="/admin/surveys"
        onNavigate={(key) => navigate(key)}
        frontPath="/admin/surveys"
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  return (
    <UserShell
      title="调研档案馆"
      subtitle="每一次寻访，都立卷归档"
      navItems={[]}
      selectedKey="/admin/surveys"
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/surveys"
      footerNote="调研 · Investigator Archive"
      theme={ARCHIVE_THEME}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/admin/surveys" replace />} />
        <Route path="/surveys" element={<Navigate to="/admin/surveys" replace />} />
        <Route path="/surveys/:id" element={<SurveyDetail />} />
        <Route path="/admin/*" element={<Navigate to="/admin/surveys" replace />} />
      </Routes>
    </UserShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/investigator">
      <Shell />
    </BrowserRouter>
  );
}
