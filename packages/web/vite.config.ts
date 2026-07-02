import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sharedRuntime } from './vite-shared-runtime';

export default defineConfig({
  plugins: [sharedRuntime(), react(), tailwindcss()],
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
