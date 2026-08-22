import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@mt/ui";
import SourceList from "./pages/SourceList";
import SourceDetail from "./pages/SourceDetail";
import ItemList from "./pages/ItemList";

const NAV = [{ key: "/sources", label: "信息源" }];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/sources";
  return (
    <AppShell title="采集" navItems={NAV} selectedKey={selected} onNavigate={(key) => navigate(key)}>
      <Routes>
        <Route path="/" element={<Navigate to="/sources" replace />} />
        <Route path="/sources" element={<SourceList />} />
        <Route path="/sources/:id" element={<SourceDetail />} />
        <Route path="/sources/:sourceId/items" element={<ItemList />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/gatherer">
      <Shell />
    </BrowserRouter>
  );
}
