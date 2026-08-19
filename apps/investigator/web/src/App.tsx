import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import SurveyList from "./pages/SurveyList";
import SurveyDetail from "./pages/SurveyDetail";

export default function App() {
  return (
    <BrowserRouter basename="/investigator">
      <Routes>
        <Route path="/" element={<Navigate to="/surveys" replace />} />
        <Route path="/surveys" element={<SurveyList />} />
        <Route path="/surveys/:id" element={<SurveyDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
