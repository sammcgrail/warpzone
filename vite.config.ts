import { defineConfig } from 'vite';
// subdomain app (warpzone.sebland.com) — served from root, no base prefix
export default defineConfig({
  build: { target: 'es2020', assetsInlineLimit: 4096 },
});
