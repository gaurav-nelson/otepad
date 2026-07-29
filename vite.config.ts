import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "img/**/*",
        "fonts/**/*",
        "privacy.html",
        "terms.html",
        "css/legal.css",
      ],
      manifest: {
        dir: "ltr",
        lang: "en",
        name: "otepad",
        short_name: "otepad",
        scope: "/",
        display: "standalone",
        start_url: "/",
        background_color: "#242525",
        theme_color: "#323332",
        orientation: "any",
        prefer_related_applications: false,
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: "img/icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "img/icon-96x96.png",
            sizes: "96x96",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "img/icon-128x128.png",
            sizes: "128x128",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "img/icon-144x144.png",
            sizes: "144x144",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "img/icon-152x152.png",
            sizes: "152x152",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "img/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "img/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "img/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "img/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "img/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/privacy\.html$/, /^\/terms\.html$/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
