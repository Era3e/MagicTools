import React from "react";
import ReactDOM from "react-dom/client";
import { MtThemeProvider } from "@mt/ui";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MtThemeProvider>
      <App />
    </MtThemeProvider>
  </React.StrictMode>
);
