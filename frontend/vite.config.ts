import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          xlsx: ['xlsx'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
    host: true,
    // التكامل مع الباك: أي /api/v1 يتحول إلى http://localhost:4000
    // يعمل فقط عند ضبط VITE_API_URL — وإلا يبقى الفرونت على MockAdapter.
    proxy: {
      '/api/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
