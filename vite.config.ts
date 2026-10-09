import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The embed build becomes one self-contained page, so it keeps everything in a single script.
const singleFile = process.env.VITE_ROUTER === "memory";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: singleFile ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
});
