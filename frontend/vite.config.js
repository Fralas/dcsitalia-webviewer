import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  server: {
    port: 3000,
    watch: {
      // The backend (luaZoneSync) rewrites this data file every ~30s with live
      // frontline zones. It lives in src/ only as a build-time bootstrap default;
      // the running app gets live zones from the /api/frontline-zones endpoint.
      // If Vite watches it, each write triggers an HMR update that bubbles up to
      // a non-refreshable module (tacticalMaps.js -> App.jsx) and forces a full
      // page reload on every view. Ignore it to stop the periodic refresh.
      ignored: [
        '**/src/config/frontlineZones.json',
        path.resolve(__dirname, 'src/config/frontlineZones.json'),
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/sfx': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
