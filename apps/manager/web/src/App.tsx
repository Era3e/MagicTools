import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell, appAccent } from "@mt/ui";
import RequirementList from "./pages/RequirementList";
import RequirementBoard from "./pages/RequirementBoard";
import RequirementDetail from "./pages/RequirementDetail";
import IterationList from "./pages/IterationList";

const ACCENT = appAccent("manager");

const COCKPIT_THEME = {
  // UserShellTheme 标准字段（v2.3 派生口径：驾驶舱靛蓝 + 设计稿亮色锚点）
  primary: "#3a5f84",
  background: "#f4f6f8",
  ink: "#101a26",
  muted: "#5f6c7c",
  displayFont: '"Noto Serif SC", "Source Serif 4", "Songti SC", serif',
  bodyFont: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  // Flight Deck 扩展色板（页面通过 useTheme() 访问，避免页面硬编码）
  accent: "#3a5f84",
  tint: "#e9eef4",
  panel: "#ffffff",
  sky: "#3a5f84",
  board: "#fbfcfd",
  rule: "#d9dde3",
  border: "#c9d4de",
  mono: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
  sans: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
};

const USER_NAV = [{ key: "/requirements", label: "需求台" }];

const ADMIN_NAV = [
  { key: "/admin/requirements", label: "需求管理" },
  { key: "/admin/iterations", label: "迭代管理" },
];

function UserRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/requirements" replace />} />
      <Route path="/requirements" element={<RequirementBoard />} />
      <Route path="/requirements/:id" element={<RequirementDetail />} />
      <Route path="/iterations" element={<Navigate to="/admin/iterations" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin/requirements" replace />} />
    </Routes>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/requirements" replace />} />
      <Route path="/admin/requirements" element={<RequirementList />} />
      <Route path="/admin/requirements/:id" element={<RequirementDetail />} />
      <Route path="/admin/iterations" element={<IterationList />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) {
    const selected = ADMIN_NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/admin/requirements";
    return (
      <AdminShell
        title="交付管理"
        navItems={ADMIN_NAV}
        selectedKey={selected}
        onNavigate={(key) => navigate(key)}
        frontPath="/requirements"
        eyebrow={ACCENT.controlEyebrow ?? ACCENT.controlKey}
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  return (
    <UserShell
      title="交付驾驶舱"
      eyebrow={ACCENT.frontEyebrow}
      navItems={USER_NAV}
      selectedKey="/requirements"
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/requirements"
      footerNote="管理 · Manager Cockpit"
      theme={COCKPIT_THEME}
    >
      <UserRoutes />
    </UserShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/manager">
      <Shell />
    </BrowserRouter>
  );
}
