import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile({ inlinePattern: ["**/*.js"] }),
  ],
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: (info) =>
          info.name?.endsWith(".css") ? "estilos.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
  },
});
