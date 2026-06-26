import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev: forward API calls to the gateway so the browser stays same-origin.
    proxy: {
      '/api': 'http://localhost:8717',
    },
  },
});
