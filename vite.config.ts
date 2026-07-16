import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// full React app on the subdomain root (no base prefix)
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2020', assetsInlineLimit: 4096 },
});
