import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell } from "@mt/ui";
import EntryList from "./pages/EntryList";
import SearchPage from "./pages/SearchPage";
import GraphPage from "./pages/GraphPage";
import SettingsPage from "./pages/SettingsPage";

const LIBRARY_THEME = {
  // UserShellTheme 标准字段
  primary: "#0e5a3a",
  background: "#f4f1e8",
  ink: "#23301f",
  muted: "#7c8577",
  displayFont: '"Palatino Linotype", "Book Antiqua", "Noto Serif SC", "Songti SC", serif',
  bodyFont: '"Noto Serif SC", "Palatino Linotype", serif',
  // Scholar 馆藏扩展色板（页面通过 useTheme() 访问）
  green: "#0e5a3a",
  rule: "#c8c0ab",
  paper: "#ede8da",
  card: "#faf8f2",
  display: '"Palatino Linotype", "Book Antiqua", "Noto Serif SC", "Songti SC", serif',
  link: "#0e5a3a",     // 强调链接色（替换原 #3370ff 蓝色，统一书院绿）
  chipBg: "#ede8da",   // 关系列表 chip 背景（替换原 rgba(0,0,0,0.04)）
  subtle: "#7c8577",   // 次次要灰文字（替换原 #86909c，统一用 muted）
};

const USER_NAV = [
  { key: "/entries", label: "馆藏条目" },
  { key: "/search", label: "书目检索" },
  { key: "/graph", label: "知识图谱" },
];

const ADMIN_NAV = [
  { key: "/admin/settings", label: "知识库设置" },
  { key: "/admin/entries", label: "条目编目" },
];

function UserRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/entries" replace />} />
      <Route path="/entries" element={<EntryList />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/graph" element={<GraphPage />} />
      <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin/settings" replace />} />
    </Routes>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/settings" replace />} />
      <Route path="/admin/settings" element={<SettingsPage />} />
      <Route path="/admin/entries" element={<EntryList />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) {
    const selected = ADMIN_NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/admin/settings";
    return (
      <AdminShell
        title="知识"
        navItems={ADMIN_NAV}
        selectedKey={selected}
        onNavigate={(key) => navigate(key)}
        frontPath="/entries"
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  const selected = USER_NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/entries";
  return (
    <UserShell
      title="知识书院"
      subtitle="每一则知识，皆入馆藏"
      navItems={USER_NAV}
      selectedKey={selected}
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/settings"
      footerNote="知识 · Scholar Athenaeum"
      theme={LIBRARY_THEME}
    >
      <UserRoutes />
    </UserShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/scholar">
      <Shell />
    </BrowserRouter>
  );
}
