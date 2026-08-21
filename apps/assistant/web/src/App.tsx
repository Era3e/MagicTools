import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu } from "antd";
import ChatPage from "./pages/ChatPage";
import FeedbackPage from "./pages/FeedbackPage";
import IntentLogPage from "./pages/IntentLogPage";

const MENU = [
  { key: "/chat", label: "对话" },
  { key: "/feedback", label: "反馈" },
  { key: "/intent-logs", label: "意图日志" },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = MENU.find((m) => location.pathname.startsWith(m.key))?.key ?? "/chat";
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header>
        <Menu theme="dark" mode="horizontal" selectedKeys={[selected]} items={MENU} onClick={(e) => navigate(e.key)} />
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/intent-logs" element={<IntentLogPage />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/assistant">
      <Shell />
    </BrowserRouter>
  );
}
