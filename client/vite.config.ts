import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export default defineConfig({
  plugins: [
    react(),
    ...(isTest
      ? []
      : [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["pwa-icon.svg"],
            manifest: {
              name: "Pétanque · Apéro",
              short_name: "Pétanque",
              theme_color: "#C65D3B",
              background_color: "#F5EFE1",
              display: "standalone",
              start_url: "/",
              icons: [
                {
                  src: "/pwa-icon.svg",
                  sizes: "any",
                  type: "image/svg+xml",
                  purpose: "any maskable",
                },
              ],
            },
            workbox: {
              navigateFallback: "/index.html",
              globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
            },
          }),
        ]),
  ],
  build: { emptyOutDir: false },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
