import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const stripCrossorigin = {
  name: "strip-crossorigin-links",
  transformIndexHtml: {
    order: "post",
    handler: (html) => html.replace(/(<link\b[^>]*?)\scrossorigin(?==|\s|>)/g, "$1"),
  },
};

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile({ inlinePattern: ["**/*.js"] }),
    stripCrossorigin,
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
