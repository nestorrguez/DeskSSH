import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Dev: forward API calls (and the terminal WebSocket) to the gateway so the
    // browser stays same-origin.
    proxy: {
      '/api': { target: 'http://localhost:8717', ws: true },
    },
  },
});
