import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
<<<<<<< HEAD:vite.config.ts
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.API_TARGET ?? "http://127.0.0.1:3001",
        // Keep the browser's Origin header so the API can validate it.
        changeOrigin: false,
      },
    },
  },
});
=======
    host: '0.0.0.0',
    port: 4173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
>>>>>>> origin/main:frontend/vite.config.ts
