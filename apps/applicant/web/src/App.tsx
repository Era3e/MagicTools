import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@mt/ui";
import PositionList from "./pages/PositionList";
import PositionDetail from "./pages/PositionDetail";
import InterviewPage from "./pages/InterviewPage";
import ResumeCenter from "./pages/ResumeCenter";

const NAV = [
  { key: "/positions", label: "岗位" },
  { key: "/resumes", label: "简历" },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/positions";
  return (
    <AppShell title="求职" navItems={NAV} selectedKey={selected} onNavigate={(key) => navigate(key)}>
      <Routes>
        <Route path="/" element={<Navigate to="/positions" replace />} />
        <Route path="/positions" element={<PositionList />} />
        <Route path="/positions/:id" element={<PositionDetail />} />
        <Route path="/positions/:id/interviews" element={<InterviewPage />} />
        <Route path="/resumes" element={<ResumeCenter />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/applicant">
      <Shell />
    </BrowserRouter>
  );
}
