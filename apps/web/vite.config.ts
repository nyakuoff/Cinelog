import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';

// Stamp dist/sw.js with a per-build id so each deploy gets its own cache name.
const swBuildId = {
  name: 'sw-build-id',
  apply: 'build' as const,
  closeBundle() {
    const f = 'dist/sw.js';
    writeFileSync(f, readFileSync(f, 'utf8').replace(/__BUILD_ID__/g, Date.now().toString(36)));
  },
};

// The web app talks to the API over HTTP exactly like any external client would.
// In dev we proxy /api and /artwork to the API so cookies stay same-origin.
export default defineConfig({
  plugins: [react(), swBuildId],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
