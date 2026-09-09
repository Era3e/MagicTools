import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell, appAccent } from "@mt/ui";
import SurveyList from "./pages/SurveyList";
import SurveyDetail from "./pages/SurveyDetail";

const ACCENT = appAccent("investigator");

const ARCHIVE_THEME = {
  primary: "#8a6a3b",
  background: "#f4f6f8",
  ink: "#28241c",
  muted: "#5f6c7c",
  displayFont: '"Noto Serif SC", "Source Serif 4", "Songti SC", serif',
  bodyFont: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  accent: "#8a6a3b",
  tint: "#f5efe4",
  panel: "#ffffff",
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
        title="调研工坊"
        navItems={ADMIN_NAV}
        selectedKey="/admin/surveys"
        onNavigate={(key) => navigate(key)}
        eyebrow={ACCENT.controlEyebrow ?? ACCENT.controlKey}
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  return (
    <UserShell
      title="调研工坊"
      subtitle={ACCENT.subtitle}
      eyebrow={ACCENT.frontEyebrow}
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
