import { Navigate, Route, BrowserRouter, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@mt/ui";
import ChatPage from "./pages/ChatPage";
import FeedbackPage from "./pages/FeedbackPage";
import IntentLogPage from "./pages/IntentLogPage";

const NAV = [
  { key: "/chat", label: "对话" },
  { key: "/feedback", label: "反馈" },
  { key: "/intent-logs", label: "意图日志" },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = NAV.find((m) => location.pathname.startsWith(m.key))?.key ?? "/chat";
  return (
    <AppShell title="助手" navItems={NAV} selectedKey={selected} onNavigate={(key) => navigate(key)}>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/intent-logs" element={<IntentLogPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/assistant">
      <Shell />
    </BrowserRouter>
  );
}
