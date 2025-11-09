import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        ws: true,
        // Strip /api/parties/main/ prefix and forward just the room name
        rewrite: (path) => path.replace(/^\/api(?:\/parties\/main)?/, ""),
      },
    },
  },
  optimizeDeps: {
    exclude: ["valtio-y"],
  },
});
