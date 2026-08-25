import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { UserShell, AdminShell } from "@mt/ui";
import PositionWall from "./pages/PositionWall";
import PositionList from "./pages/PositionList";
import PositionDetail from "./pages/PositionDetail";
import InterviewPage from "./pages/InterviewPage";
import ResumeCenter from "./pages/ResumeCenter";

const USER_NAV = [
  { key: "/positions", label: "岗位博览" },
  { key: "/resumes", label: "简历工坊" },
];

const ADMIN_NAV = [{ key: "/admin/positions", label: "岗位管理" }];

function UserRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/positions" replace />} />
      <Route path="/positions" element={<PositionWall />} />
      <Route path="/positions/:id" element={<PositionDetail />} />
      <Route path="/positions/:id/interviews" element={<InterviewPage />} />
      <Route path="/resumes" element={<ResumeCenter />} />
      <Route path="/admin/*" element={<Navigate to="/admin/positions" replace />} />
    </Routes>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/positions" replace />} />
      <Route path="/admin/positions" element={<PositionList />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) {
    const selected = ADMIN_NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/admin/positions";
    return (
      <AdminShell
        title="求职"
        navItems={ADMIN_NAV}
        selectedKey={selected}
        onNavigate={(key) => navigate(key)}
        frontPath="/positions"
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  const selected = USER_NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/positions";
  return (
    <UserShell
      title="求职"
      subtitle="每一次投递，都值得被认真对待"
      navItems={USER_NAV}
      selectedKey={selected}
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/positions"
    >
      <UserRoutes />
    </UserShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/applicant">
      <Shell />
    </BrowserRouter>
  );
}
