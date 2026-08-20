import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import FeedbackPage from "./pages/FeedbackPage";

export default function App() {
  return (
    <BrowserRouter basename="/assistant">
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
      </Routes>
    </BrowserRouter>
  );
}
