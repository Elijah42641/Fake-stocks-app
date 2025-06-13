// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Vite dev server port (default)
    proxy: {
      // Proxy API requests to your backend (port 4000)
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // For production build (if frontend is served from backend)
  base: "/", // Set to your subpath if needed (e.g., '/static/')
});
