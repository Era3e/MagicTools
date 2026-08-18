import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/investigator/",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5002",
    },
  },
});
