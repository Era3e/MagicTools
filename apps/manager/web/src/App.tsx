import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import RequirementList from "./pages/RequirementList";
import RequirementDetail from "./pages/RequirementDetail";
import IterationList from "./pages/IterationList";

export default function App() {
  return (
    <BrowserRouter basename="/manager">
      <Routes>
        <Route path="/" element={<Navigate to="/requirements" replace />} />
        <Route path="/requirements" element={<RequirementList />} />
        <Route path="/requirements/:id" element={<RequirementDetail />} />
        <Route path="/iterations" element={<IterationList />} />
      </Routes>
    </BrowserRouter>
  );
}
