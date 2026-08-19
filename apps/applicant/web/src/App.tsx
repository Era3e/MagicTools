import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import PositionList from "./pages/PositionList";
import PositionDetail from "./pages/PositionDetail";
import InterviewPage from "./pages/InterviewPage";
import ResumeCenter from "./pages/ResumeCenter";

export default function App() {
  return (
    <BrowserRouter basename="/applicant">
      <Routes>
        <Route path="/" element={<Navigate to="/positions" replace />} />
        <Route path="/positions" element={<PositionList />} />
        <Route path="/positions/:id" element={<PositionDetail />} />
        <Route path="/positions/:id/interviews" element={<InterviewPage />} />
        <Route path="/resumes" element={<ResumeCenter />} />
      </Routes>
    </BrowserRouter>
  );
}
