import { defineConfig } from "vite";

// GitHub Pages project site: /aetherscape-3d/
// Local dev/preview stay at /
const base = process.env.GITHUB_PAGES === "1" ? "/aetherscape-3d/" : "/";

export default defineConfig({
  base,
  server: { host: "127.0.0.1", port: 4174 },
  preview: { host: "127.0.0.1", port: 4174 },
  build: { sourcemap: true },
});
