import { defineConfig } from "vite";

// GitHub Pages project site uses mode "pages" → base /aetherscape-3d/
// Local: npm run dev / npm run build (base /)
export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "/aetherscape-3d/" : "/",
  server: { host: "127.0.0.1", port: 4174 },
  preview: { host: "127.0.0.1", port: 4174 },
  build: { sourcemap: true },
}));
