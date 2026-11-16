import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      host: process.env.VITE_HOST ?? env.VITE_HOST ?? "127.0.0.1",
      port: Number(process.env.VITE_PORT ?? env.VITE_PORT) || 5173,
      strictPort: true,
      proxy: { "/api": {
        target: process.env.API_TARGET ?? env.API_TARGET ?? "http://127.0.0.1:5000",
        changeOrigin: false,
      } },
    },
    preview: { host: "127.0.0.1", port: 4173 },
  };
});
