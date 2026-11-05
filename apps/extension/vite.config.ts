import { resolve } from "node:path";
import { defineConfig } from "vite";

// background.ts, popup.html and blocked.html are separate entries; public/manifest.json is copied as-is.
export default defineConfig({
  root: "src",
  publicDir: resolve(import.meta.dirname, "public"),
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        background: resolve(import.meta.dirname, "src/background.ts"),
        popup: resolve(import.meta.dirname, "src/popup.html"),
        blocked: resolve(import.meta.dirname, "src/blocked.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
