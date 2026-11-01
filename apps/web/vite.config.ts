import { defineConfig } from "vite";
export default defineConfig(({ command, mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    ...(command === "serve" &&
    mode !== "production" &&
    process.env.NODE_ENV !== "production" &&
    process.env.PROJECTX_WIDGET_TEST_PROXY === "1"
      ? {
          proxy: {
            "/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
          },
        }
      : {}),
  },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
}));
