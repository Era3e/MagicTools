import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import SourceList from "./pages/SourceList";
import SourceDetail from "./pages/SourceDetail";
import ItemList from "./pages/ItemList";

export default function App() {
  return (
    <BrowserRouter basename="/gatherer">
      <Routes>
        <Route path="/" element={<Navigate to="/sources" replace />} />
        <Route path="/sources" element={<SourceList />} />
        <Route path="/sources/:id" element={<SourceDetail />} />
        <Route path="/sources/:sourceId/items" element={<ItemList />} />
      </Routes>
    </BrowserRouter>
  );
}
