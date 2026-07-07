import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web app talks to the API over HTTP exactly like any external client would.
// In dev we proxy /api and /artwork to the API so cookies stay same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
