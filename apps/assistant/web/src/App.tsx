import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminShell, UserShell } from "@mt/ui";
import ChatPage from "./pages/ChatPage";
import FeedbackPage from "./pages/FeedbackPage";
import IntentLogPage from "./pages/IntentLogPage";

const QUIET_THEME = {
  primary: "#c2410c",
  background: "#fbfaf8",
  ink: "#27272a",
  muted: "#a1a1aa",
  displayFont: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  bodyFont: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
};

const USER_NAV = [{ key: "/chat", label: "对话" }];

const ADMIN_NAV = [
  { key: "/admin/feedback", label: "反馈处理" },
  { key: "/admin/intent-logs", label: "意图日志" },
];

function UserRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/feedback" element={<Navigate to="/admin/feedback" replace />} />
      <Route path="/intent-logs" element={<Navigate to="/admin/intent-logs" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin/feedback" replace />} />
    </Routes>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/feedback" replace />} />
      <Route path="/admin/feedback" element={<FeedbackPage />} />
      <Route path="/admin/intent-logs" element={<IntentLogPage />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) {
    const selected = ADMIN_NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/admin/feedback";
    return (
      <AdminShell
        title="助手"
        navItems={ADMIN_NAV}
        selectedKey={selected}
        onNavigate={(key) => navigate(key)}
        frontPath="/chat"
      >
        <AdminRoutes />
      </AdminShell>
    );
  }

  return (
    <UserShell
      title="智能助手"
      subtitle="有问题，就直接问"
      navItems={USER_NAV}
      selectedKey="/chat"
      onNavigate={(key) => navigate(key)}
      adminPath="/admin/feedback"
      footerNote="助手 · Assistant Console"
      theme={QUIET_THEME}
    >
      <UserRoutes />
    </UserShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/assistant">
      <Shell />
    </BrowserRouter>
  );
}
