import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the backend during development
      '/ingest': 'http://localhost:4000',
      '/items': 'http://localhost:4000',
      '/query': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
