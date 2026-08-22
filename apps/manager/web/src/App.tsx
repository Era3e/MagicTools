import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@mt/ui";
import RequirementList from "./pages/RequirementList";
import RequirementDetail from "./pages/RequirementDetail";
import IterationList from "./pages/IterationList";

const NAV = [
  { key: "/requirements", label: "需求" },
  { key: "/iterations", label: "迭代" },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/requirements";
  return (
    <AppShell title="管理" navItems={NAV} selectedKey={selected} onNavigate={(key) => navigate(key)}>
      <Routes>
        <Route path="/" element={<Navigate to="/requirements" replace />} />
        <Route path="/requirements" element={<RequirementList />} />
        <Route path="/requirements/:id" element={<RequirementDetail />} />
        <Route path="/iterations" element={<IterationList />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/manager">
      <Shell />
    </BrowserRouter>
  );
}
