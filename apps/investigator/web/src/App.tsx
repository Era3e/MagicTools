import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@mt/ui";
import SurveyList from "./pages/SurveyList";
import SurveyDetail from "./pages/SurveyDetail";

const NAV = [{ key: "/surveys", label: "主题" }];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/surveys";
  return (
    <AppShell title="调研" navItems={NAV} selectedKey={selected} onNavigate={(key) => navigate(key)}>
      <Routes>
        <Route path="/" element={<Navigate to="/surveys" replace />} />
        <Route path="/surveys" element={<SurveyList />} />
        <Route path="/surveys/:id" element={<SurveyDetail />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/investigator">
      <Shell />
    </BrowserRouter>
  );
}
