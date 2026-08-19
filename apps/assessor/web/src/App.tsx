import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import RequestList from "./pages/RequestList";
import RequestDetail from "./pages/RequestDetail";

export default function App() {
  return (
    <BrowserRouter basename="/assessor">
      <Routes>
        <Route path="/" element={<Navigate to="/requests" replace />} />
        <Route path="/requests" element={<RequestList />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
