import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "BayBlaze Admin",
        short_name: "Admin",
        theme_color: "#111111",
        background_color: "#f8f5ef",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icons/bayblaze-admin-icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "/icons/bayblaze-admin-icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          }
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
